import { Body, Controller, Get, Put, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ChecklistService } from './checklist.service';
import {
  checklistQuerySchema,
  checklistWeekQuerySchema,
  upsertChecklistSchema,
} from './dto/checklist.schemas';
import type {
  ChecklistQueryDto,
  ChecklistWeekQueryDto,
  UpsertChecklistDto,
} from './dto/checklist.schemas';

@Controller('checklist')
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get()
  async getByDate(
    @CurrentUser() user: { sub: string },
    @Query(new ZodValidationPipe(checklistQuerySchema))
    query: ChecklistQueryDto,
  ) {
    return this.checklistService.getByDate(user.sub, query.date);
  }

  @Put()
  async upsert(
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(upsertChecklistSchema))
    body: UpsertChecklistDto,
  ) {
    return this.checklistService.upsert(user.sub, body);
  }

  @Get('week')
  async getWeek(
    @CurrentUser() user: { sub: string },
    @Query(new ZodValidationPipe(checklistWeekQuerySchema))
    query: ChecklistWeekQueryDto,
  ) {
    return this.checklistService.getWeek(user.sub, query);
  }
}
