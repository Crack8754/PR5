import { ApiBody, ApiExtraModels, ApiOperation, ApiParam, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ApiProjectErrors } from '../openapi/api-project-errors.decorator';
import { createProjectExample, projectExample, updateProjectExample } from '../openapi/examples';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiExtraModels(CreateProjectDto, UpdateProjectDto, ProjectResponseDto, ApiErrorDto)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Створити проєкт', description: 'Назва унікальна після trim, з урахуванням регістру. Status обов’язковий. Дані зберігаються в пам’яті.' })
  @ApiBody({ required: true, schema: { $ref: getSchemaPath(CreateProjectDto) }, examples: {
    studyFlow: { summary: 'Повний запит', value: createProjectExample },
    minimal: { summary: 'Без опису', value: { name: 'New project', status: 'draft' } },
  } })
  @ApiResponse({ status: 201, description: 'Проєкт створено.', content: {
    'application/json': { schema: { $ref: getSchemaPath(ProjectResponseDto) }, example: projectExample },
  } })
  @ApiProjectErrors('/projects', { body: true, conflict: true })
  async create(@Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
    return ProjectResponseDto.from(await this.projectsService.create(dto));
  }

  @Get()
  @ApiOperation({ summary: 'Отримати список проєктів', description: 'Повертає всі проєкти. Якщо записів немає — порожній масив. Пагінації та фільтрації немає.' })
  @ApiResponse({ status: 200, description: 'Список проєктів.', content: {
    'application/json': { schema: { type: 'array', items: { $ref: getSchemaPath(ProjectResponseDto) } },
      examples: { populated: { value: [projectExample] }, empty: { value: [] } } },
  } })
  @ApiProjectErrors('/projects')
  async findAll(): Promise<ProjectResponseDto[]> {
    return (await this.projectsService.findAll()).map(ProjectResponseDto.from);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Отримати проєкт за ID', description: 'ParseIntPipe перетворює ID на число. Для відсутнього запису повертається 404.' })
  @ApiParam({ name: 'id', required: true, type: 'integer', example: 1, description: 'Цілий числовий ID; нечислові значення повертають 400.' })
  @ApiResponse({ status: 200, description: 'Знайдений проєкт.', content: {
    'application/json': { schema: { $ref: getSchemaPath(ProjectResponseDto) }, example: projectExample },
  } })
  @ApiProjectErrors('/projects/1', { id: true })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ProjectResponseDto> {
    return ProjectResponseDto.from(await this.projectsService.findOne(id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Частково оновити проєкт', description: 'Принаймні одне поле. Непередані поля зберігаються; description: "" очищає опис. Власну назву можна залишити.' })
  @ApiParam({ name: 'id', required: true, type: 'integer', example: 1, description: 'Цілий числовий ID.' })
  @ApiBody({ required: true, schema: { $ref: getSchemaPath(UpdateProjectDto) }, examples: {
    complete: { summary: 'Завершити проєкт', value: updateProjectExample },
    rename: { summary: 'Змінити назву', value: { name: 'StudyFlow v2' } },
    clearDescription: { summary: 'Очистити опис', value: { description: '' } },
  } })
  @ApiResponse({ status: 200, description: 'Оновлений проєкт.', content: {
    'application/json': { schema: { $ref: getSchemaPath(ProjectResponseDto) }, example: { ...projectExample, ...updateProjectExample } },
  } })
  @ApiProjectErrors('/projects/1', { body: true, id: true, conflict: true, update: true })
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    return ProjectResponseDto.from(await this.projectsService.update(id, dto));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Видалити проєкт', description: 'Після успішного видалення повертається 204 без тіла. Повторне видалення повертає 404.' })
  @ApiParam({ name: 'id', required: true, type: 'integer', example: 1, description: 'Цілий числовий ID.' })
  @ApiResponse({ status: 204, description: 'Проєкт видалено; тіло відповіді відсутнє.' })
  @ApiProjectErrors('/projects/1', { id: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.projectsService.remove(id);
  }
}
