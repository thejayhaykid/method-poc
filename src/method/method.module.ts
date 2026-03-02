import { Global, Module } from '@nestjs/common';
import { MethodService } from './method.service.js';

@Global()
@Module({
  providers: [MethodService],
  exports: [MethodService],
})
export class MethodModule {}
