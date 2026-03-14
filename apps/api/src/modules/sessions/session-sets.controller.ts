import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  batchCreateSetsSchema,
  createSetSchema,
  toggleSetCompletionSchema,
  updateSetSchema,
} from './dto/session.schemas';
import type {
  BatchCreateSetsDto,
  CreateSetDto,
  ToggleSetCompletionDto,
  UpdateSetDto,
} from './dto/session.schemas';
import { SessionsService } from './sessions.service';

@Controller('session-exercises')
export class SessionSetsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post(':seId/sets')
  async createSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Body(new ZodValidationPipe(createSetSchema)) body: CreateSetDto,
  ) {
    return this.sessionsService.createSet(user.sub, sessionExerciseId, body);
  }

  @Patch(':seId/sets/:id')
  async updateSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSetSchema)) body: UpdateSetDto,
  ) {
    return this.sessionsService.updateSet(
      user.sub,
      sessionExerciseId,
      id,
      body,
    );
  }

  @Delete(':seId/sets/:id')
  @HttpCode(204)
  async removeSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Param('id') id: string,
  ) {
    await this.sessionsService.deleteSet(user.sub, sessionExerciseId, id);
  }

  @Patch(':seId/sets/:id/complete')
  async completeSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(toggleSetCompletionSchema))
    body: ToggleSetCompletionDto,
  ) {
    return this.sessionsService.toggleSetCompletion(
      user.sub,
      sessionExerciseId,
      id,
      body,
    );
  }

  @Post(':seId/sets/batch')
  async batchCreate(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Body(new ZodValidationPipe(batchCreateSetsSchema))
    body: BatchCreateSetsDto,
  ) {
    return this.sessionsService.batchCreateSets(
      user.sub,
      sessionExerciseId,
      body,
    );
  }
}
