import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MembersService } from './members.service';
import { CreateMemberDto, AssignSectionsDto } from './dto/create-member.dto';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser, JwtPayloadUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Members & Section Assignments')
@ApiBearerAuth()
@Controller('api/members')
export class MembersController {
  constructor(private membersService: MembersService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Add a new member by email, password, and assign sections (Admin only)' })
  async createMember(
    @CurrentUser() user: JwtPayloadUser,
    @Body() dto: CreateMemberDto,
  ) {
    return this.membersService.createMember(user.id, dto);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'List all household members with assigned sections (Admin only)' })
  async findAll() {
    return this.membersService.findAll();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Get a specific member by ID (Admin only)' })
  async findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Patch(':id/sections')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Assign or update sections (ROOM, MESS, WATER) and Room Head status for a member (Admin only)' })
  async assignSections(
    @Param('id') id: string,
    @Body() dto: AssignSectionsDto,
  ) {
    return this.membersService.assignSections(id, dto);
  }

  @Patch(':id/toggle-active')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Enable or disable a household member (Admin only)' })
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.membersService.toggleMemberActive(user.id, id);
  }

  @Patch(':id/toggle-admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Grant or revoke Admin role for a member (Admin only)' })
  async toggleAdmin(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.membersService.toggleAdminRole(user.id, id);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Remove a member (Admin only)' })
  async deleteMember(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.membersService.deleteMember(user.id, id);
  }
}
