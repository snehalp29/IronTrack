import { Module } from '@nestjs/common';

import { StreakService } from '../../services/streak.service';
import { StreakController } from './streak.controller';

@Module({
  controllers: [StreakController],
  providers: [StreakService],
  exports: [StreakService],
})
export class StreakModule {}
