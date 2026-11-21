import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { ClassesService } from './classes.service.js';
import { ClassQueryDto } from './dto/class-query.dto.js';

@Public()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  list(@Query() query: ClassQueryDto) {
    return this.classes.list(query);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.classes.getById(id);
  }
}