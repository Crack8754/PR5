import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

export function configureApp(app: INestApplication): void {
  app.useGlobalFilters(new HttpExceptionFilter(app.get(HttpAdapterHost)));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();
}
