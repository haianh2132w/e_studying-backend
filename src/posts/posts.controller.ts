import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { PostsService } from './posts.service.js';
import { PostQueryDto } from './dto/post-query.dto.js';

@Public()
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(@Query() query: PostQueryDto) {
    return this.posts.list(query);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.posts.getById(id);
  }
}