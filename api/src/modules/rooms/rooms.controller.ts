import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { CreateRoomDto, CreateBedDto } from './dto/create-room.dto';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('Rooms & Sections')
@ApiBearerAuth()
@Controller('api')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Get('rooms')
  @ApiOperation({ summary: 'List all rooms, beds, and room heads' })
  async findAll() {
    return this.roomsService.findAll();
  }

  @Post('rooms')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Create a new room (Admin only)' })
  async createRoom(@Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(dto);
  }

  @Patch('rooms/:id/head')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Assign or update Room Head for a room (Admin only)' })
  async assignRoomHead(
    @Param('id') roomId: string,
    @Body('headMemberId') headMemberId: string | null,
  ) {
    return this.roomsService.assignRoomHead(roomId, headMemberId);
  }

  @Post('beds')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Add a bed to a room (Admin only)' })
  async createBed(@Body() dto: CreateBedDto) {
    return this.roomsService.createBed(dto);
  }

  @Patch('rooms/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update room details (Admin only)' })
  async updateRoom(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; headMemberId?: string | null },
  ) {
    return this.roomsService.updateRoom(id, dto);
  }

  @Delete('rooms/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete room (Admin only)' })
  async deleteRoom(@Param('id') id: string) {
    return this.roomsService.deleteRoom(id);
  }

  @Patch('beds/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Update bed details and price (Admin only)' })
  async updateBed(
    @Param('id') id: string,
    @Body() dto: { name?: string; defaultRentFils?: string },
  ) {
    return this.roomsService.updateBed(id, dto);
  }

  @Delete('beds/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Delete bed (Admin only)' })
  async deleteBed(@Param('id') id: string) {
    return this.roomsService.deleteBed(id);
  }
}
