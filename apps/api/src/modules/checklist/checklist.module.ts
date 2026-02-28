import { Module } from '@nestjs/common';

import { StreakService } from '../../services/streak.service';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';

@Module({
  controllers: [ChecklistController],
  providers: [ChecklistService, StreakService],
  exports: [ChecklistService],
})
export class ChecklistModule {}
