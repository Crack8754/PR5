import { Injectable } from '@nestjs/common';
import { NewProject, Project, ProjectChanges } from '../project';
import { DuplicateProjectNameError, ProjectsRepository } from '../ports/projects.repository';

@Injectable()
export class InMemoryProjectsRepository implements ProjectsRepository {
  private readonly projects = new Map<number, Project>();
  private nextId = 1;

  async create(input: NewProject): Promise<Project> {
    this.assertUniqueName(input.name);
    const project = { ...input, id: this.nextId++ };
    this.projects.set(project.id, project);
    return { ...project };
  }

  async findAll(): Promise<Project[]> {
    return [...this.projects.values()].map((project) => ({ ...project }));
  }

  async findOne(id: number): Promise<Project | null> {
    const project = this.projects.get(id);
    return project ? { ...project } : null;
  }

  async findByName(name: string): Promise<Project | null> {
    const project = [...this.projects.values()].find((item) => item.name === name);
    return project ? { ...project } : null;
  }

  async update(id: number, changes: ProjectChanges): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;
    if (changes.name !== undefined) this.assertUniqueName(changes.name, id);
    const updated = { ...project, ...changes };
    this.projects.set(id, updated);
    return { ...updated };
  }

  async remove(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  private assertUniqueName(name: string, exceptId?: number): void {
    // Без await між перевіркою та записом: паралельні запити не створять дублікат.
    if ([...this.projects.values()].some((project) => project.name === name && project.id !== exceptId)) {
      throw new DuplicateProjectNameError();
    }
  }
}
