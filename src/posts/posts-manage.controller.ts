import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { PostsManageService } from './posts-manage.service.js';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto.js';

@Controller()
export class PostsManageController {
  constructor(private readonly posts: PostsManageService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('posts')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.posts.create(user, dto);
  }

  @Patch('posts/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(user, id, dto);
  }

  @HttpCode(200)
  @Delete('posts/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.posts.remove(user, id);
  }

  @Get('me/posts')
  listPublished(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.posts.listMine(user.id, 'PUBLISHED', q);
  }

  // PHẢI khai báo TRƯỚC me/posts/:id, nếu không "drafts" bị hiểu là một id
  @Get('me/posts/drafts')
  listDrafts(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.posts.listMine(user.id, 'DRAFT', q);
  }

  @Get('me/posts/:id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.posts.getMine(user.id, id);
  }
}
