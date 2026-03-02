import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createExerciseSchema,
  listExercisesQuerySchema,
  updateExerciseSchema,
  upsertExerciseNoteSchema,
} from './dto/exercise.schemas';
import type {
  CreateExerciseDto,
  ListExercisesQuery,
  UpdateExerciseDto,
  UpsertExerciseNoteDto,
} from './dto/exercise.schemas';
import { ExercisesService } from './exercises.service';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  async list(
    @CurrentUser() user: { sub: string },
    @Query(new ZodValidationPipe(listExercisesQuerySchema))
    query: ListExercisesQuery,
  ) {
    return this.exercisesService.list(user.sub, query);
  }

  @Get(':id')
  async getById(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.exercisesService.getById(user.sub, id);
  }

  @Post()
  async create(
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(createExerciseSchema)) body: CreateExerciseDto,
  ) {
    return this.exercisesService.create(user.sub, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExerciseSchema)) body: UpdateExerciseDto,
  ) {
    return this.exercisesService.update(user.sub, id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.exercisesService.softDelete(user.sub, id);
  }

  @Get(':id/history')
  async history(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.exercisesService.history(
      user.sub,
      id,
      Number(page ?? 1),
      Number(pageSize ?? 20),
    );
  }

  @Put(':id/note')
  async upsertNote(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(upsertExerciseNoteSchema))
    body: UpsertExerciseNoteDto,
  ) {
    return this.exercisesService.upsertNote(user.sub, id, body);
  }
}
