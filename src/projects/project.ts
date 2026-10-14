export enum ProjectStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
}

export interface Project {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  internalNote: string;
  deletedAt: string | null;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status: ProjectStatus;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;
export type NewProject = Omit<Project, 'id'>;
export type ProjectChanges = Partial<Pick<Project, 'name' | 'description' | 'status' | 'updatedAt'>>;
