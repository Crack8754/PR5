import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProjectInput, Project, ProjectChanges, UpdateProjectInput } from './project';
import { DuplicateProjectNameError, PROJECTS_REPOSITORY, ProjectsRepository } from './ports/projects.repository';

@Injectable()
export class ProjectsService {
  constructor(@Inject(PROJECTS_REPOSITORY) private readonly repository: ProjectsRepository) {}

  async create(input: CreateProjectInput): Promise<Project> {
    const name = this.normalizeName(input.name);
    await this.ensureUniqueName(name);
    const now = new Date().toISOString();
    try {
      return await this.repository.create({
        name,
        description: input.description?.trim() ?? '',
        status: input.status,
        createdAt: now,
        updatedAt: now,
        internalNote: 'Created by ProjectsService',
        deletedAt: null,
      });
    } catch (error) {
      if (error instanceof DuplicateProjectNameError) throw this.nameConflict(name);
      throw error;
    }
  }

  findAll(): Promise<Project[]> {
    return this.repository.findAll();
  }

  async findOne(id: number): Promise<Project> {
    const project = await this.repository.findOne(id);
    if (!project) throw this.notFound(id);
    return project;
  }

  async update(id: number, input: UpdateProjectInput): Promise<Project> {
    await this.findOne(id);
    if (input.name === undefined && input.description === undefined && input.status === undefined) {
      throw new BadRequestException({ errorCode: 'EMPTY_UPDATE', message: 'Provide name, description or status to update' });
    }
    const changes: ProjectChanges = { updatedAt: new Date().toISOString() };
    if (input.name !== undefined) {
      changes.name = this.normalizeName(input.name);
      await this.ensureUniqueName(changes.name, id);
    }
    if (input.description !== undefined) changes.description = input.description.trim();
    if (input.status !== undefined) changes.status = input.status;
    try {
      const project = await this.repository.update(id, changes);
      if (!project) throw this.notFound(id);
      return project;
    } catch (error) {
      if (error instanceof DuplicateProjectNameError) throw this.nameConflict(changes.name!);
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    if (!await this.repository.remove(id)) throw this.notFound(id);
  }

  private async ensureUniqueName(name: string, exceptId?: number): Promise<void> {
    const existing = await this.repository.findByName(name);
    if (existing && existing.id !== exceptId) throw this.nameConflict(name);
  }

  private normalizeName(name: string): string {
    const normalized = name.trim();
    if (!normalized) throw new BadRequestException('Project name cannot be blank');
    return normalized;
  }

  private notFound(id: number): NotFoundException {
    return new NotFoundException({
      errorCode: 'PROJECT_NOT_FOUND',
      message: `Project with id ${id} was not found`,
    });
  }

  private nameConflict(name: string): ConflictException {
    return new ConflictException({
      errorCode: 'PROJECT_NAME_CONFLICT',
      message: `Project with name "${name}" already exists`,
    });
  }
}
