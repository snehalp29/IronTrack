import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('muscle-groups')
  async muscleGroups() {
    return this.catalogService.muscleGroups();
  }

  @Public()
  @Get('equipment')
  async equipment() {
    return this.catalogService.equipment();
  }
}
