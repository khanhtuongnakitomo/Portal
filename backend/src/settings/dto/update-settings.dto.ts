import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  openTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  closeTime?: string;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(1440)
  maxDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  maxAdvanceDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxActiveBookingsPerUser?: number;
}
