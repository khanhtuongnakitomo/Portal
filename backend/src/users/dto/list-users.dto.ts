import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role, UserStatus } from '../../generated/prisma/client.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class ListUsersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
