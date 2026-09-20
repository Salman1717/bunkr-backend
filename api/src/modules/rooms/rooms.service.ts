import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoomDto, CreateBedDto } from './dto/create-room.dto';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.room.findMany({
      include: {
        headMember: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        beds: {
          include: {
            memberships: {
              where: { endDate: null },
              include: {
                member: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createRoom(dto: CreateRoomDto) {
    const existing = await this.prisma.room.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Room with name ${dto.name} already exists`);
    }

    const room = await this.prisma.room.create({
      data: {
        name: dto.name,
        description: dto.description,
        headMemberId: dto.headMemberId || null,
      },
      include: { headMember: true, beds: true },
    });

    if (dto.headMemberId) {
      await this.prisma.member.update({
        where: { id: dto.headMemberId },
        data: { isRoomHead: true },
      });
    }

    return room;
  }

  async assignRoomHead(roomId: string, headMemberId: string | null) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }

    if (headMemberId) {
      const member = await this.prisma.member.findUnique({
        where: { id: headMemberId },
      });

      if (!member) {
        throw new NotFoundException(`Member with ID ${headMemberId} not found`);
      }

      await this.prisma.member.update({
        where: { id: headMemberId },
        data: { isRoomHead: true },
      });
    }

    return this.prisma.room.update({
      where: { id: roomId },
      data: { headMemberId },
      include: { headMember: true, beds: true },
    });
  }

  async createBed(dto: CreateBedDto) {
    const room = await this.prisma.room.findUnique({
      where: { id: dto.roomId },
    });

    if (!room) {
      throw new NotFoundException(`Room with ID ${dto.roomId} not found`);
    }

    const defaultRentFils = dto.defaultRentFils ? BigInt(dto.defaultRentFils) : 65000n;

    return this.prisma.bed.create({
      data: {
        roomId: dto.roomId,
        name: dto.name,
        defaultRentFils,
      },
    });
  }
}
