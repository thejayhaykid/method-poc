import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MethodEntity } from './method-entity.entity.js';
import { EntitiesService } from './entities.service.js';
import { EntitiesController } from './entities.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([MethodEntity])],
  controllers: [EntitiesController],
  providers: [EntitiesService],
  exports: [EntitiesService],
})
export class EntitiesModule {}
