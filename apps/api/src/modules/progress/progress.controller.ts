import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('weekly')
  async weekly(
    @CurrentUser() user: { sub: string },
    @Query('startDate') startDate?: string,
  ) {
    return this.progressService.weekly(user.sub, startDate);
  }
}
