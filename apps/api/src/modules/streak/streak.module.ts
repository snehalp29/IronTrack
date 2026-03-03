import { Module } from '@nestjs/common';

import { StreakService } from '../../services/streak.service';

@Module({
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
