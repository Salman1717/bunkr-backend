import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'Room 1 (Master)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Master Bedroom with balcony' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'member-uuid' })
  @IsString()
  @IsOptional()
  headMemberId?: string;
}

export class CreateBedDto {
  @ApiProperty({ example: 'room-uuid' })
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty({ example: 'Bed A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: '75000', description: 'Bed rent in fils (750 AED = 75000 fils)' })
  @IsString()
  @IsOptional()
  defaultRentFils?: string;
}
