import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  batchCreateSetsSchema,
  createSetSchema,
  toggleSetCompletionSchema,
  updateSetSchema,
} from './dto/session.schemas';
import { SessionsService } from './sessions.service';

@Controller('session-exercises')
export class SessionSetsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post(':seId/sets')
  async createSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Body(new ZodValidationPipe(createSetSchema)) body: unknown,
  ) {
    return this.sessionsService.createSet(
      user.sub,
      sessionExerciseId,
      body as any,
    );
  }

  @Patch(':seId/sets/:id')
  async updateSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSetSchema)) body: unknown,
  ) {
    return this.sessionsService.updateSet(
      user.sub,
      sessionExerciseId,
      id,
      body as any,
    );
  }

  @Delete(':seId/sets/:id')
  async removeSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Param('id') id: string,
  ) {
    return this.sessionsService.deleteSet(user.sub, sessionExerciseId, id);
  }

  @Patch(':seId/sets/:id/complete')
  async completeSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(toggleSetCompletionSchema)) body: unknown,
  ) {
    return this.sessionsService.toggleSetCompletion(
      user.sub,
      sessionExerciseId,
      id,
      body as any,
    );
  }

  @Post(':seId/sets/batch')
  async batchCreate(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Body(new ZodValidationPipe(batchCreateSetsSchema)) body: unknown,
  ) {
    return this.sessionsService.batchCreateSets(
      user.sub,
      sessionExerciseId,
      body as any,
    );
  }
}
