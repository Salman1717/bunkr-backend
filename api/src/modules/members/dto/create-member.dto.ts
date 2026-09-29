import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { MembershipType } from '@prisma/client';

export class CreateMemberDto {
  @ApiProperty({ example: 'member@bunkr.ae' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isRoomHead?: boolean;

  @ApiPropertyOptional({ enum: MembershipType, isArray: true, example: ['ROOM', 'MESS', 'WATER'] })
  @IsArray()
  @IsOptional()
  sections?: MembershipType[];

  @ApiPropertyOptional({ example: 'bed-uuid-1' })
  @IsString()
  @IsOptional()
  bedId?: string;
}

export class AssignSectionsDto {
  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isRoomHead?: boolean;

  @ApiPropertyOptional({ enum: MembershipType, isArray: true, example: ['ROOM', 'MESS', 'WATER'] })
  @IsArray()
  @IsOptional()
  sections?: MembershipType[];

  @ApiPropertyOptional({ example: 'bed-uuid-1' })
  @IsString()
  @IsOptional()
  bedId?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ example: 'member@bunkr.ae' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'NewPassword123!' })
  @IsString()
  @IsOptional()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isRoomHead?: boolean;

  @ApiPropertyOptional({ enum: MembershipType, isArray: true, example: ['ROOM', 'MESS', 'WATER'] })
  @IsArray()
  @IsOptional()
  sections?: MembershipType[];

  @ApiPropertyOptional({ example: 'bed-uuid-1' })
  @IsString()
  @IsOptional()
  bedId?: string;
}

