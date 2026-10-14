import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import { Project, ProjectStatus } from '../project';

@Exclude()
export class ProjectResponseDto {
  @Expose()
  @ApiProperty({ type: 'integer', minimum: 1, description: 'Послідовний числовий ID.', example: 1 })
  id!: number;

  @Expose()
  @ApiProperty({ minLength: 3, maxLength: 100, description: 'Унікальна назва.', example: 'StudyFlow' })
  name!: string;

  @Expose()
  @ApiProperty({ maxLength: 500, description: 'Опис або порожній рядок.', example: 'Система керування навчальними проєктами' })
  description!: string;

  @Expose()
  @ApiProperty({ enum: ProjectStatus, description: 'Стан проєкту.', example: ProjectStatus.Active })
  status!: ProjectStatus;

  @Expose()
  @ApiProperty({ format: 'date-time', description: 'Час створення UTC, ISO 8601.', example: '2026-09-23T10:00:00.000Z' })
  createdAt!: string;

  static from(project: Project): ProjectResponseDto {
    return plainToInstance(ProjectResponseDto, project, { excludeExtraneousValues: true });
  }
}
