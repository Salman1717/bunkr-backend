import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMemberDto, AssignSectionsDto } from './dto/create-member.dto';
import { MembershipType } from '@prisma/client';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async createMember(actorId: string, dto: CreateMemberDto) {
    const existing = await this.prisma.member.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException(`Member with email ${dto.email} already exists`);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    return this.prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          isAdmin: dto.isAdmin ?? false,
          isRoomHead: dto.isRoomHead ?? false,
        },
      });

      if (dto.sections && dto.sections.length > 0) {
        for (const secType of dto.sections) {
          await tx.membership.create({
            data: {
              memberId: member.id,
              type: secType,
              bedId: secType === 'ROOM' ? dto.bedId : null,
              startDate: new Date(),
            },
          });
        }
      }

      const { passwordHash: _, ...result } = await tx.member.findUniqueOrThrow({
        where: { id: member.id },
        include: {
          memberships: {
            include: {
              bed: { include: { room: true } },
            },
          },
        },
      });

      return result;
    });
  }

  async assignSections(memberId: string, dto: AssignSectionsDto) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isRoomHead !== undefined) {
        await tx.member.update({
          where: { id: memberId },
          data: { isRoomHead: dto.isRoomHead },
        });
      }

      if (dto.sections !== undefined) {
        // Clear active memberships
        await tx.membership.deleteMany({
          where: { memberId },
        });

        for (const secType of dto.sections) {
          await tx.membership.create({
            data: {
              memberId,
              type: secType,
              bedId: secType === 'ROOM' ? dto.bedId : null,
              startDate: new Date(),
            },
          });
        }
      }

      const { passwordHash: _, ...result } = await tx.member.findUniqueOrThrow({
        where: { id: memberId },
        include: {
          memberships: {
            include: {
              bed: { include: { room: true } },
            },
          },
        },
      });

      return result;
    });
  }

  async toggleMemberActive(actorId: string, memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: { isActive: !member.isActive },
    });

    const { passwordHash, ...result } = updated;
    return result;
  }

  async toggleAdminRole(actorId: string, memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    const updated = await this.prisma.member.update({
      where: { id: memberId },
      data: { isAdmin: !member.isAdmin },
    });

    const { passwordHash, ...result } = updated;
    return result;
  }

  async deleteMember(actorId: string, memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    await this.prisma.member.delete({
      where: { id: memberId },
    });

    return { message: `Member ${member.email} deleted successfully` };
  }

  async findAll() {
    const members = await this.prisma.member.findMany({
      include: {
        memberships: {
          include: {
            bed: { include: { room: true } },
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    return members.map(({ passwordHash, ...m }) => m);
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            bed: { include: { room: true } },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${id} not found`);
    }

    const { passwordHash, ...rest } = member;
    return rest;
  }
}
