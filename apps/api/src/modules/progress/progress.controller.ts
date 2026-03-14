import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  type WeeklyProgressQueryDto,
  weeklyProgressQuerySchema,
} from './dto/progress.schemas';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('weekly')
  async weekly(
    @CurrentUser() user: { sub: string },
    @Query(new ZodValidationPipe(weeklyProgressQuerySchema))
    query: WeeklyProgressQueryDto,
  ) {
    return this.progressService.weekly(user.sub, query.startDate);
  }
}
