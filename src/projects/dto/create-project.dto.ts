import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { CreateProjectInput, ProjectStatus } from '../project';

export class CreateProjectDto implements CreateProjectInput {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(3, 100)
  @ApiProperty({ description: 'Назва після обрізання крайніх пробілів; унікальна з урахуванням регістру.', minLength: 3, maxLength: 100, example: 'StudyFlow' })
  name!: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ description: 'Опис; крайні пробіли обрізаються сервісом. Порожній рядок очищає опис.', maxLength: 500, example: 'Система керування навчальними проєктами' })
  description?: string;

  @IsEnum(ProjectStatus)
  @ApiProperty({ description: 'Стан проєкту.', enum: ProjectStatus, example: ProjectStatus.Active })
  status!: ProjectStatus;
}
