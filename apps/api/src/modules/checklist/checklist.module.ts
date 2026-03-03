import { Module } from '@nestjs/common';

import { StreakModule } from '../streak/streak.module';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';

@Module({
  imports: [StreakModule],
  controllers: [ChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class ChecklistModule {}
