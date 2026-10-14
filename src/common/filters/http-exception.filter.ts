import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { randomUUID } from 'node:crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const context = host.switchToHttp();
    const response = context.getResponse();
    // body-parser кидає звичайну Error, а не Nest HttpException.
    const oversizedBody = exception instanceof Error && 'type' in exception
      && exception.type === 'entity.too.large' && 'status' in exception && exception.status === 413;
    const statusCode = exception instanceof HttpException
      ? exception.getStatus() : oversizedBody ? 413 : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse()
      : oversizedBody ? 'request entity too large' : undefined;
    const details = typeof payload === 'object' && payload !== null
      ? payload as Record<string, unknown> : {};
    const traceId = randomUUID();
    const defaults: Record<number, string> = {
      400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN',
      404: 'NOT_FOUND', 409: 'CONFLICT', 413: 'PAYLOAD_TOO_LARGE',
      500: 'INTERNAL_SERVER_ERROR',
    };
    let errorCode = typeof details.errorCode === 'string'
      ? details.errorCode : defaults[statusCode] ?? `HTTP_${statusCode}`;
    const rawMessage = typeof payload === 'string' ? payload : details.message;
    let message = typeof rawMessage === 'string' ? rawMessage
      : Array.isArray(rawMessage) ? rawMessage.filter((item) => typeof item === 'string').join('; ')
      : 'Request failed';
    if (statusCode === 400 && Array.isArray(rawMessage)) errorCode = 'VALIDATION_ERROR';

    // Внутрішні помилки логуються з traceId, але їхні деталі не виходять за межі API.
    if (statusCode >= 500) {
      message = 'Internal server error';
      errorCode = defaults[statusCode] ?? `HTTP_${statusCode}`;
      this.logger.error(`[${traceId}] ${httpAdapter.getRequestUrl(context.getRequest())}`,
        exception instanceof Error ? exception.stack : 'Unknown exception');
    }
    httpAdapter.setHeader(response, 'X-Trace-Id', traceId);
    httpAdapter.reply(response, {
      statusCode,
      errorCode,
      message,
      path: httpAdapter.getRequestUrl(context.getRequest()),
      timestamp: new Date().toISOString(),
      traceId,
    }, statusCode);
  }
}
