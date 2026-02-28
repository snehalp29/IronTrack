import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { updateMeSchema } from './user.schemas';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { sub: string }) {
    return this.usersService.getMe(user.sub);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: { sub: string },
    @Body(new ZodValidationPipe(updateMeSchema)) body: unknown,
  ) {
    return this.usersService.updateMe(user.sub, body as any);
  }

  @Delete('me')
  async deleteMe(@CurrentUser() user: { sub: string }) {
    return this.usersService.deleteMe(user.sub);
  }
}
