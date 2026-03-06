import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StreakService } from '../../services/streak.service';

@Controller('streaks')
export class StreakController {
  constructor(private readonly streakService: StreakService) {}

  @Get('workout')
  async workout(@CurrentUser() user: { sub: string }) {
    return this.streakService.getWorkoutStreak(user.sub);
  }
}
