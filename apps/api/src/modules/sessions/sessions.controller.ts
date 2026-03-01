import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  addSessionExerciseSchema,
  batchCreateSetsSchema,
  createSetSchema,
  listSessionsQuerySchema,
  reorderSessionExercisesSchema,
  startSessionSchema,
  swapSessionExerciseSchema,
  toggleSetCompletionSchema,
  updateSessionExerciseSchema,
  updateSessionSchema,
  updateSetSchema,
} from './dto/session.schemas';
import type {
  AddSessionExerciseDto,
  BatchCreateSetsDto,
  CreateSetDto,
  ReorderSessionExercisesDto,
  StartSessionDto,
  SwapSessionExerciseDto,
  ToggleSetCompletionDto,
  UpdateSessionDto,
  UpdateSessionExerciseDto,
  UpdateSetDto,
} from './dto/session.schemas';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  async start(
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(startSessionSchema)) body: StartSessionDto,
  ) {
    return this.sessionsService.startSession(user.sub, body);
  }

  @Get('active')
  async active(@CurrentUser() user: { sub: string }) {
    return this.sessionsService.getActiveSession(user.sub);
  }

  @Get(':id')
  async getById(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.sessionsService.getSession(user.sub, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSessionSchema)) body: UpdateSessionDto,
  ) {
    return this.sessionsService.updateSession(user.sub, id, body);
  }

  @Post(':id/finish')
  async finish(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.sessionsService.finishSession(user.sub, id);
  }

  @Get()
  async list(
    @CurrentUser() user: { sub: string },
    @Query() query: Record<string, unknown>,
  ) {
    const parsed = listSessionsQuerySchema.parse(query);
    return this.sessionsService.listSessions(user.sub, parsed);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.sessionsService.softDeleteSession(user.sub, id);
  }

  @Post(':sessionId/exercises')
  async addExercise(
    @CurrentUser() user: { sub: string },
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(addSessionExerciseSchema))
    body: AddSessionExerciseDto,
  ) {
    return this.sessionsService.addSessionExercise(user.sub, sessionId, body);
  }

  @Patch(':sessionId/exercises/:id')
  async updateExercise(
    @CurrentUser() user: { sub: string },
    @Param('sessionId') sessionId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSessionExerciseSchema))
    body: UpdateSessionExerciseDto,
  ) {
    return this.sessionsService.updateSessionExercise(
      user.sub,
      sessionId,
      id,
      body,
    );
  }

  @Delete(':sessionId/exercises/:id')
  async removeExercise(
    @CurrentUser() user: { sub: string },
    @Param('sessionId') sessionId: string,
    @Param('id') id: string,
  ) {
    return this.sessionsService.deleteSessionExercise(user.sub, sessionId, id);
  }

  @Patch(':sessionId/exercises/reorder')
  async reorderExercises(
    @CurrentUser() user: { sub: string },
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(reorderSessionExercisesSchema))
    body: ReorderSessionExercisesDto,
  ) {
    return this.sessionsService.reorderSessionExercises(
      user.sub,
      sessionId,
      body,
    );
  }

  @Post(':sessionId/exercises/swap')
  async swapExercise(
    @CurrentUser() user: { sub: string },
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(swapSessionExerciseSchema))
    body: SwapSessionExerciseDto,
  ) {
    return this.sessionsService.swapSessionExercise(user.sub, sessionId, body);
  }

  @Post('session-exercises/:seId/sets')
  async createSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Body(new ZodValidationPipe(createSetSchema)) body: CreateSetDto,
  ) {
    return this.sessionsService.createSet(user.sub, sessionExerciseId, body);
  }

  @Patch('session-exercises/:seId/sets/:id')
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

  @Delete('session-exercises/:seId/sets/:id')
  async removeSet(
    @CurrentUser() user: { sub: string },
    @Param('seId') sessionExerciseId: string,
    @Param('id') id: string,
  ) {
    return this.sessionsService.deleteSet(user.sub, sessionExerciseId, id);
  }

  @Patch('session-exercises/:seId/sets/:id/complete')
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

  @Post('session-exercises/:seId/sets/batch')
  async batchSetCreate(
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
