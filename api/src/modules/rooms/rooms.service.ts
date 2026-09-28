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

  async updateRoom(id: string, dto: { name?: string; description?: string; headMemberId?: string | null }) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Room with ID ${id} not found`);

    if (dto.name && dto.name !== room.name) {
      const existing = await this.prisma.room.findUnique({ where: { name: dto.name } });
      if (existing) throw new ConflictException(`Room with name ${dto.name} already exists`);
    }

    if (dto.headMemberId) {
      await this.prisma.member.update({
        where: { id: dto.headMemberId },
        data: { isRoomHead: true },
      });
    }

    return this.prisma.room.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        headMemberId: dto.headMemberId,
      },
      include: { headMember: true, beds: true },
    });
  }

  async updateBed(id: string, dto: { name?: string; defaultRentFils?: string }) {
    const bed = await this.prisma.bed.findUnique({ where: { id } });
    if (!bed) throw new NotFoundException(`Bed with ID ${id} not found`);

    return this.prisma.bed.update({
      where: { id },
      data: {
        name: dto.name,
        defaultRentFils: dto.defaultRentFils ? BigInt(dto.defaultRentFils) : undefined,
      },
    });
  }

  async deleteBed(id: string) {
    const bed = await this.prisma.bed.findUnique({ where: { id } });
    if (!bed) throw new NotFoundException(`Bed with ID ${id} not found`);
    return this.prisma.bed.delete({ where: { id } });
  }

  async deleteRoom(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException(`Room with ID ${id} not found`);
    return this.prisma.room.delete({ where: { id } });
  }
}
