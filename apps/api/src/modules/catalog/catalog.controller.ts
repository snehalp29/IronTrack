import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

const CATALOG_CACHE_CONTROL =
  'public, max-age=86400, stale-while-revalidate=3600';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('muscle-groups')
  async muscleGroups(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', CATALOG_CACHE_CONTROL);
    return this.catalogService.muscleGroups();
  }

  @Public()
  @Get('equipment')
  async equipment(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', CATALOG_CACHE_CONTROL);
    return this.catalogService.equipment();
  }
}
