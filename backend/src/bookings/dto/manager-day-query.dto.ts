import { IsOptional, Matches } from 'class-validator';

export class ManagerDayQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
