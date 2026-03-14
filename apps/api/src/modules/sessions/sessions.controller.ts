import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  addSessionExerciseSchema,
  applySessionSupersetSchema,
  listSessionsQuerySchema,
  reorderSessionExercisesSchema,
  startSessionSchema,
  swapSessionExerciseSchema,
  updateSessionExerciseSchema,
  updateSessionSchema,
} from './dto/session.schemas';
import type {
  AddSessionExerciseDto,
  ApplySessionSupersetDto,
  ListSessionsQuery,
  ReorderSessionExercisesDto,
  StartSessionDto,
  SwapSessionExerciseDto,
  UpdateSessionDto,
  UpdateSessionExerciseDto,
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
  @HttpCode(200)
  async finish(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.sessionsService.finishSession(user.sub, id);
  }

  @Get()
  async list(
    @CurrentUser() user: { sub: string },
    @Query(new ZodValidationPipe(listSessionsQuerySchema))
    query: ListSessionsQuery,
  ) {
    return this.sessionsService.listSessions(user.sub, query);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    await this.sessionsService.softDeleteSession(user.sub, id);
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

  @Patch(':sessionId/exercises/superset')
  async applySuperset(
    @CurrentUser() user: { sub: string },
    @Param('sessionId') sessionId: string,
    @Body(new ZodValidationPipe(applySessionSupersetSchema))
    body: ApplySessionSupersetDto,
  ) {
    return this.sessionsService.applySessionSuperset(user.sub, sessionId, body);
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
  @HttpCode(204)
  async removeExercise(
    @CurrentUser() user: { sub: string },
    @Param('sessionId') sessionId: string,
    @Param('id') id: string,
  ) {
    await this.sessionsService.deleteSessionExercise(user.sub, sessionId, id);
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
}
