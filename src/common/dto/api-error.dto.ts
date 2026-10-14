import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ type: 'integer', minimum: 400, maximum: 599, example: 404 })
  statusCode!: number;

  @ApiProperty({ description: 'Стабільний код для клієнта. Інші HTTP-помилки можуть мати код HTTP_<status>.', example: 'PROJECT_NOT_FOUND' })
  errorCode!: string;

  @ApiProperty({ description: 'Людинозрозуміле повідомлення; помилки DTO об’єднані через крапку з комою.', example: 'Project with id 10 was not found' })
  message!: string;

  @ApiProperty({ description: 'Шлях запиту, включно з query string, якщо є.', example: '/projects/10' })
  path!: string;

  @ApiProperty({ format: 'date-time', description: 'Час помилки UTC.', example: '2026-09-23T10:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ format: 'uuid', description: 'UUID v4; також повертається в заголовку X-Trace-Id.', example: '550e8400-e29b-41d4-a716-446655440000' })
  traceId!: string;
}
