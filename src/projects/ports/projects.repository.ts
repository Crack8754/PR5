import { NewProject, Project, ProjectChanges } from '../project';

export const PROJECTS_REPOSITORY = Symbol('PROJECTS_REPOSITORY');

// Помилка port не залежить від HTTP; сервіс перетворює її на ConflictException.
export class DuplicateProjectNameError extends Error {
  constructor() {
    super('Project name must be unique');
    this.name = 'DuplicateProjectNameError';
  }
}

export interface ProjectsRepository {
  // Адаптер генерує числовий ID та атомарно забезпечує унікальність назви.
  // create/update кидають DuplicateProjectNameError при конфлікті.
  create(project: NewProject): Promise<Project>;
  findAll(): Promise<Project[]>;
  findOne(id: number): Promise<Project | null>;
  findByName(name: string): Promise<Project | null>;
  update(id: number, changes: ProjectChanges): Promise<Project | null>;
  remove(id: number): Promise<boolean>;
}
