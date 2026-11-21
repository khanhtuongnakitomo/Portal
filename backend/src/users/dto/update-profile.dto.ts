import { Transform, Type } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @Type(() => Object)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  fullName!: string;
}
