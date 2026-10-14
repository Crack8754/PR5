import { Module } from '@nestjs/common';
import { PROJECTS_REPOSITORY } from './ports/projects.repository';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { InMemoryProjectsRepository } from './repositories/in-memory-projects.repository';

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    { provide: PROJECTS_REPOSITORY, useClass: InMemoryProjectsRepository },
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
