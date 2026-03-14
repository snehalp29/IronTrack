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
  createWorkoutTemplateSchema,
  listWorkoutTemplatesQuerySchema,
  reorderWorkoutTemplateSchema,
  updateWorkoutTemplateSchema,
} from './dto/workout-template.schemas';
import type {
  CreateWorkoutTemplateDto,
  ListWorkoutTemplatesQuery,
  ReorderWorkoutTemplateDto,
  UpdateWorkoutTemplateDto,
} from './dto/workout-template.schemas';
import { WorkoutTemplatesService } from './workout-templates.service';

@Controller('workout-templates')
export class WorkoutTemplatesController {
  constructor(
    private readonly workoutTemplatesService: WorkoutTemplatesService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: { sub: string },
    @Query(new ZodValidationPipe(listWorkoutTemplatesQuerySchema))
    query: ListWorkoutTemplatesQuery,
  ) {
    return this.workoutTemplatesService.list(user.sub, query);
  }

  @Get(':id')
  async getById(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.workoutTemplatesService.getById(user.sub, id);
  }

  @Post()
  async create(
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(createWorkoutTemplateSchema))
    body: CreateWorkoutTemplateDto,
  ) {
    return this.workoutTemplatesService.create(user.sub, body);
  }

  @Patch('reorder')
  async reorder(
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(reorderWorkoutTemplateSchema))
    body: ReorderWorkoutTemplateDto,
  ) {
    return this.workoutTemplatesService.reorder(user.sub, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { sub: string },
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWorkoutTemplateSchema))
    body: UpdateWorkoutTemplateDto,
  ) {
    return this.workoutTemplatesService.update(user.sub, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.workoutTemplatesService.softDelete(user.sub, id);
  }
}
