import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Projects API — ПР5')
    .setDescription('Продовження ПР3–ПР4. Навчальний CRUD API з in-memory repository. Дані зникають після перезапуску. Bearer-схему додано для документування: перевірки токенів немає, усі операції доступні без авторизації. Репозиторій: https://github.com/Crack8754/PR5')
    .setVersion('1.0.0')
    .setLicense('UNLICENSED', 'https://choosealicense.com/no-permission/')
    .setContact('Crack8754', 'https://github.com/Crack8754', '')
    .setExternalDoc('GitHub — практична робота 5', 'https://github.com/Crack8754/PR5')
    .addServer('/', 'Поточний сервер API')
    .addTag('Projects', 'Створення, перегляд, зміна та видалення проєктів.')
    .addBearerAuth({
      type: 'http', scheme: 'bearer',
      description: 'Необов’язковий Authorization: Bearer <token>. У цій роботі немає auth guard або перевірки токенів; схема не забезпечує захист.',
    }, 'bearer')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // Порожня альтернатива означає анонімний доступ: контракт відповідає API без auth guard.
  document.security = [{}, { bearer: [] }];
  for (const name of ['CreateProjectDto', 'UpdateProjectDto', 'ProjectResponseDto', 'ApiErrorDto']) {
    const schema = document.components?.schemas?.[name];
    if (schema && !('$ref' in schema)) schema.additionalProperties = false;
  }
  const update = document.components?.schemas?.UpdateProjectDto;
  if (update && !('$ref' in update)) update.minProperties = 1;
  return document;
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, createOpenApiDocument(app), {
    jsonDocumentUrl: '/openapi.json',
    customSiteTitle: 'Projects API — ПР5',
    swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
  });
}
