import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

/** T19 — uploads, jobs, progresso (SSE) e cota. */
@Module({
  controllers: [UploadsController, JobsController],
  providers: [UploadsService, JobsService],
  exports: [JobsService],
})
export class JobsModule {}
