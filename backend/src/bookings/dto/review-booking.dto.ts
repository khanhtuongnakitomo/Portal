import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectBookingDto {
  @IsString()
  @MaxLength(1000)
  note!: string;
}
