import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CheckoutKeyDto extends ReviewBookingDto {
  @Type(() => Object)
  @IsString()
  passCode!: string;
}

export class RejectBookingDto {
  @IsString()
  @MaxLength(1000)
  note!: string;
}
