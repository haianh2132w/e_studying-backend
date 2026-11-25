import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service.js';
import { UploadsController } from './uploads.controller.js';
import { AccessModule } from '../access/access.module.js';
import { OwnershipModule } from '../ownership/ownership.module.js';

@Module({
  imports:[AccessModule,OwnershipModule],
  providers: [UploadsService],
  controllers: [UploadsController]
})
export class UploadsModule {}
