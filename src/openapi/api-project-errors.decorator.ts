import { applyDecorators } from '@nestjs/common';
import { ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { errorExample } from './examples';

export function ApiProjectErrors(path: string, options: { body?: boolean; id?: boolean; conflict?: boolean; update?: boolean } = {}) {
  const response = (status: number, description: string, examples: Record<string, { value: object }>) =>
    ApiResponse({
      status, description,
      headers: {
        'X-Trace-Id': { description: 'Ідентифікатор помилки, тотожний traceId у тілі.', schema: { type: 'string', format: 'uuid' } },
      },
      content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorDto) }, examples } },
    });
  const decorators = [
    response(500, 'Неочікувана помилка сервера; внутрішні деталі приховано.', {
      internal: { value: errorExample(500, 'INTERNAL_SERVER_ERROR', 'Internal server error', path) },
    }),
  ];
  // JSON parser виконується до controller навіть для GET із помилково переданим тілом.
  const badRequests: Record<string, { value: object }> = {
    malformedJson: { value: errorExample(400, 'BAD_REQUEST', 'Unexpected end of JSON input', path) },
  };
  if (options.body) {
    badRequests.validation = { value: errorExample(400, 'VALIDATION_ERROR', 'name must be longer than or equal to 3 characters', path) };
    badRequests.unknownField = { value: errorExample(400, 'VALIDATION_ERROR', 'property internalNote should not exist', path) };
  }
  if (options.id) {
    badRequests.invalidId = { value: errorExample(400, 'BAD_REQUEST', 'Validation failed (numeric string is expected)', '/projects/abc') };
    decorators.push(response(404, 'Проєкт із заданим числовим ID не знайдено.', {
      notFound: { value: errorExample(404, 'PROJECT_NOT_FOUND', 'Project with id 10 was not found', '/projects/10') },
    }));
  }
  if (options.update) badRequests.emptyUpdate = { value: errorExample(400, 'EMPTY_UPDATE', 'Provide name, description or status to update', path) };
  if (Object.keys(badRequests).length) decorators.push(response(400, 'Некоректний запит.', badRequests));
  if (options.conflict) decorators.push(response(409, 'Назва вже зайнята іншим проєктом.', {
    duplicate: { value: errorExample(409, 'PROJECT_NAME_CONFLICT', 'Project with name "StudyFlow" already exists', path) },
  }));
  decorators.push(response(413, 'Тіло запиту перевищує ліміт JSON parser (100 KB).', {
    tooLarge: { value: errorExample(413, 'PAYLOAD_TOO_LARGE', 'request entity too large', path) },
  }));
  return applyDecorators(...decorators);
}
