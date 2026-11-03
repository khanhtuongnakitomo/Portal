import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Role } from '../../generated/prisma/client.js';

export class UpdateUserRoleDto {
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({
    description: 'Required when changing the account to USER',
    example: 'SE123456',
  })
  @ValidateIf((dto: UpdateUserRoleDto) => dto.role === Role.USER || dto.studentCode !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  studentCode?: string;
}
