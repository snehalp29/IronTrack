import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { MlClientService } from './ml-client.service';

@Module({
  imports: [HttpModule],
  providers: [MlClientService],
  exports: [MlClientService],
})
export class MlClientModule {}
