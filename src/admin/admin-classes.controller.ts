import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminClassesService } from './admin-classes.service.js';
import { AdminListQueryDto, CreateClassDto, UpdateClassDto, UpdateActiveDto } from './dto/admin-course-class.dto.js';

@Roles('ADMIN')
@Controller('admin/classes')
export class AdminClassesController {
  constructor(private readonly classes: AdminClassesService) {}

  @Get()
  list(@Query() q: AdminListQueryDto) {
    return this.classes.list(q);
  }

  @Post()
  create(@Body() dto: CreateClassDto) {
    return this.classes.create(dto);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.classes.getOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClassDto) {
    return this.classes.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActiveDto) {
    return this.classes.setStatus(id, dto.isActive);
  }
}