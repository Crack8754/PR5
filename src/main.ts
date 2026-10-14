import { setupSwagger } from './openapi/swagger';
import 'reflect-metadata';
import { NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

export async function createApp(options: NestApplicationOptions = {}) {
  const app = await NestFactory.create(AppModule, options);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  configureApp(app);
  setupSwagger(app);
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3000);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
