import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RentService } from './rent.service';
import { UpdateAdjustmentDto, ToggleLockDto, MarkPaidDto } from './dto/rent.dto';
import { RoomHeadOrAdminGuard } from '../../common/guards/room-head-or-admin.guard';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Room Rent Management')
@ApiBearerAuth()
@Controller('api/rent')
export class RentController {
  constructor(private rentService: RentService) {}

  @Get('statements')
  @ApiOperation({ summary: 'Get room rent statements for a target billing month (defaults to next month)' })
  @ApiQuery({ name: 'billingMonth', required: false, example: '2026-10' })
  @ApiQuery({ name: 'roomId', required: false })
  async getStatements(
    @Query('billingMonth') billingMonth?: string,
    @Query('roomId') roomId?: string,
  ) {
    return this.rentService.getStatements(billingMonth, roomId);
  }

  @Patch('statements/:id/adjustment')
  @UseGuards(RoomHeadOrAdminGuard)
  @ApiOperation({ summary: 'Update previous balance and custom adjustments for a member rent statement (Room Head or Admin)' })
  async updateAdjustment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: UpdateAdjustmentDto,
  ) {
    const actorName = `${user.email}`;
    return this.rentService.updateAdjustment(id, actorName, dto);
  }

  @Patch('statements/:id/lock')
  @UseGuards(RoomHeadOrAdminGuard)
  @ApiOperation({ summary: 'Lock or unlock rent statement calculations to prevent further edits (Room Head or Admin)' })
  async toggleLock(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: ToggleLockDto,
  ) {
    const actorName = `${user.email}`;
    return this.rentService.toggleLock(id, actorName, dto);
  }

  @Patch('statements/:id/pay')
  @UseGuards(RoomHeadOrAdminGuard)
  @ApiOperation({ summary: 'Mark rent statement as paid, specify amount paid, payment method, and approver name (Room Head or Admin)' })
  async markPaid(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: MarkPaidDto,
  ) {
    const actorName = user.firstName ? `${user.firstName} ${user.lastName}` : user.email;
    return this.rentService.markPaid(id, actorName, dto);
  }
}
