import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateAdjustmentDto {
  @ApiPropertyOptional({ example: '5000' })
  @IsString()
  @IsOptional()
  previousBalanceFils?: string;

  @ApiPropertyOptional({ example: '-10000' })
  @IsString()
  @IsOptional()
  adjustmentFils?: string;

  @ApiPropertyOptional({ example: 'Previous month half payment carryover' })
  @IsString()
  @IsOptional()
  adjustmentReason?: string;
}

export class ToggleLockDto {
  @IsOptional()
  isLocked?: boolean;
}

export class MarkPaidDto {
  @ApiPropertyOptional({ example: '70000' })
  @IsString()
  @IsOptional()
  amountPaidFils?: string;

  @ApiPropertyOptional({ example: 'Cash' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'Salman' })
  @IsString()
  @IsOptional()
  approvedBy?: string;

  @ApiPropertyOptional({ example: 'Paid full rent via Cash to Room Head' })
  @IsString()
  @IsOptional()
  notes?: string;
}
