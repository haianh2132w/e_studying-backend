import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service.js';

@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryModule]
})
export class CloudinaryModule { }
