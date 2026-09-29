import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAdjustmentDto, ToggleLockDto, MarkPaidDto } from './dto/rent.dto';
import { RentStatus } from '@prisma/client';

@Injectable()
export class RentService {
  constructor(private prisma: PrismaService) {}

  // Helper to convert BigInt fields to strings for clean JSON response
  private formatStatement(st: any) {
    return {
      ...st,
      baseRentFils: st.baseRentFils ? st.baseRentFils.toString() : '0',
      previousBalanceFils: st.previousBalanceFils ? st.previousBalanceFils.toString() : '0',
      adjustmentFils: st.adjustmentFils ? st.adjustmentFils.toString() : '0',
      totalPayableFils: st.totalPayableFils ? st.totalPayableFils.toString() : '0',
      amountPaidFils: st.amountPaidFils ? st.amountPaidFils.toString() : '0',
    };
  }

  // Get next month string in YYYY-MM format
  private getNextMonthString(): string {
    const now = new Date();
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const year = nextMonthDate.getFullYear();
    const month = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  // Get previous month string in YYYY-MM format given a month string
  private getPreviousMonthString(billingMonth: string): string {
    const [yearStr, monthStr] = billingMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  async getStatements(billingMonth?: string, roomId?: string) {
    const targetMonth = billingMonth || this.getNextMonthString();
    const prevMonth = this.getPreviousMonthString(targetMonth);

    // Fetch all members with ROOM membership
    const membersWithRoom = await this.prisma.member.findMany({
      where: {
        isActive: true,
        memberships: {
          some: { type: 'ROOM' },
        },
      },
      include: {
        memberships: {
          where: { type: 'ROOM' },
          include: { bed: { include: { room: true } } },
        },
      },
    });

    // For each member, ensure a statement exists for targetMonth
    for (const member of membersWithRoom) {
      const existing = await this.prisma.roomRentStatement.findUnique({
        where: {
          memberId_billingMonth: {
            memberId: member.id,
            billingMonth: targetMonth,
          },
        },
      });

      if (!existing) {
        const roomMembership = member.memberships[0];
        const bed = roomMembership?.bed;
        const baseRentFils = bed?.defaultRentFils || 65000n; // Default 650 AED in fils

        // Check if there was an unpaid balance from previous month
        let previousBalanceFils = 0n;
        const prevStatement = await this.prisma.roomRentStatement.findUnique({
          where: {
            memberId_billingMonth: {
              memberId: member.id,
              billingMonth: prevMonth,
            },
          },
        });

        if (prevStatement && prevStatement.totalPayableFils > prevStatement.amountPaidFils) {
          previousBalanceFils = prevStatement.totalPayableFils - prevStatement.amountPaidFils;
        }

        const totalPayableFils = baseRentFils + previousBalanceFils;

        await this.prisma.roomRentStatement.create({
          data: {
            memberId: member.id,
            roomId: bed?.roomId || null,
            bedId: bed?.id || null,
            billingMonth: targetMonth,
            baseRentFils,
            previousBalanceFils,
            adjustmentFils: 0n,
            totalPayableFils,
            amountPaidFils: 0n,
            status: RentStatus.PENDING,
            isLocked: false,
          },
        });
      }
    }

    // Fetch all statements for targetMonth
    const statements = await this.prisma.roomRentStatement.findMany({
      where: {
        billingMonth: targetMonth,
        ...(roomId && roomId !== 'ALL' && roomId !== 'UNASSIGNED' ? { roomId } : {}),
      },
      include: {
        member: {
          include: {
            memberships: {
              include: { bed: { include: { room: true } } },
            },
          },
        },
      },
      orderBy: { member: { firstName: 'asc' } },
    });

    return statements.map((st) => this.formatStatement(st));
  }

  async updateAdjustment(statementId: string, actorName: string, dto: UpdateAdjustmentDto) {
    const statement = await this.prisma.roomRentStatement.findUnique({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(`Statement with ID ${statementId} not found`);
    }

    if (statement.isLocked) {
      throw new BadRequestException('This rent statement is locked. Unlock it first to make adjustments.');
    }

    const prevBal = dto.previousBalanceFils !== undefined
      ? BigInt(dto.previousBalanceFils)
      : statement.previousBalanceFils;

    const adj = dto.adjustmentFils !== undefined
      ? BigInt(dto.adjustmentFils)
      : statement.adjustmentFils;

    const totalPayableFils = statement.baseRentFils + prevBal + adj;

    const updated = await this.prisma.roomRentStatement.update({
      where: { id: statementId },
      data: {
        previousBalanceFils: prevBal,
        adjustmentFils: adj,
        adjustmentReason: dto.adjustmentReason !== undefined ? dto.adjustmentReason : statement.adjustmentReason,
        totalPayableFils,
      },
      include: {
        member: {
          include: {
            memberships: {
              include: { bed: { include: { room: true } } },
            },
          },
        },
      },
    });

    return this.formatStatement(updated);
  }

  async toggleLock(statementId: string, actorName: string, dto: ToggleLockDto) {
    const statement = await this.prisma.roomRentStatement.findUnique({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(`Statement with ID ${statementId} not found`);
    }

    const newLockState = dto.isLocked !== undefined ? dto.isLocked : !statement.isLocked;
    const newStatus = newLockState && statement.status === RentStatus.PENDING ? RentStatus.LOCKED : statement.status;

    const updated = await this.prisma.roomRentStatement.update({
      where: { id: statementId },
      data: {
        isLocked: newLockState,
        status: newStatus,
      },
      include: {
        member: {
          include: {
            memberships: {
              include: { bed: { include: { room: true } } },
            },
          },
        },
      },
    });

    return this.formatStatement(updated);
  }

  async markPaid(statementId: string, actorName: string, dto: MarkPaidDto) {
    const statement = await this.prisma.roomRentStatement.findUnique({
      where: { id: statementId },
    });

    if (!statement) {
      throw new NotFoundException(`Statement with ID ${statementId} not found`);
    }

    const amountPaidFils = dto.amountPaidFils !== undefined
      ? BigInt(dto.amountPaidFils)
      : statement.totalPayableFils;

    const isFullyPaid = amountPaidFils >= statement.totalPayableFils;
    const status = isFullyPaid ? RentStatus.PAID : RentStatus.PARTIAL;

    const updated = await this.prisma.roomRentStatement.update({
      where: { id: statementId },
      data: {
        amountPaidFils,
        status,
        isLocked: true,
        paidAt: new Date(),
        paymentMethod: dto.paymentMethod || 'Cash',
        approvedBy: dto.approvedBy || actorName,
        notes: dto.notes || statement.notes,
      },
      include: {
        member: {
          include: {
            memberships: {
              include: { bed: { include: { room: true } } },
            },
          },
        },
      },
    });

    return this.formatStatement(updated);
  }
}
