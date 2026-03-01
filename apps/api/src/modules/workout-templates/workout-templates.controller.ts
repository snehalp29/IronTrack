import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createWorkoutTemplateSchema,
  reorderWorkoutTemplateSchema,
  updateWorkoutTemplateSchema,
} from './dto/workout-template.schemas';
import type {
  CreateWorkoutTemplateDto,
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
  async list(@CurrentUser() user: { sub: string }) {
    return this.workoutTemplatesService.list(user.sub);
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
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.workoutTemplatesService.softDelete(user.sub, id);
  }
}
