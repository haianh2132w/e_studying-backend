import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { HomeService } from './home.service.js';

@Public()
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  getHome() {
    return this.home.getHome();
  }
}