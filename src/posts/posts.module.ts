import { Module } from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { PostsController } from './posts.controller.js';
import { PostsManageService } from './posts-manage.service.js';
import { PostsManageController } from './posts-manage.controller.js';

@Module({
  providers: [PostsService, PostsManageService],
  controllers: [PostsController, PostsManageController],
})
export class PostsModule {}
