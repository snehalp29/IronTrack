import { Module } from '@nestjs/common';

import { CompletionService } from '../../services/completion.service';
import { PrDetectionService } from '../../services/pr-detection.service';
import { SupersetService } from '../../services/superset.service';
import { VolumeService } from '../../services/volume.service';
import { StreakModule } from '../streak/streak.module';
import { SessionSetsController } from './session-sets.controller';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [StreakModule],
  controllers: [SessionsController, SessionSetsController],
  providers: [
    SessionsService,
    PrDetectionService,
    VolumeService,
    CompletionService,
    SupersetService,
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
