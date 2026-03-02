import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import type { IEntity, IEntityConnect, IEntityVehicles, IResponse } from 'method-node';
import { EntitiesService } from './entities.service.js';
import { MethodEntity } from './method-entity.entity.js';
import { CreateEntityDto } from './dto/create-entity.dto.js';

@Controller('entities')
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Post()
  create(@Body() dto: CreateEntityDto): Promise<MethodEntity> {
    return this.entitiesService.create(dto);
  }

  @Get()
  findAll(): Promise<MethodEntity[]> {
    return this.entitiesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<MethodEntity> {
    const entity = await this.entitiesService.findOne(id);
    if (!entity) throw new NotFoundException();
    return entity;
  }

  @Get('method/:methodId')
  retrieveFromMethod(@Param('methodId') methodId: string): Promise<IResponse<IEntity>> {
    return this.entitiesService.retrieveFromMethod(methodId);
  }

  @Post('method/:methodId/connect')
  createConnect(@Param('methodId') methodId: string): Promise<IResponse<IEntityConnect>> {
    return this.entitiesService.createConnect(methodId);
  }

  @Get('method/:methodId/vehicles')
  listVehicles(@Param('methodId') methodId: string): Promise<IResponse<IEntityVehicles>[]> {
    return this.entitiesService.listVehicles(methodId);
  }

  @Post('method/:methodId/vehicles')
  createVehicleRequest(@Param('methodId') methodId: string): Promise<IResponse<IEntityVehicles>> {
    return this.entitiesService.createVehicleRequest(methodId);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ deleted: true }> {
    const entity = await this.entitiesService.findOne(id);
    if (!entity) throw new NotFoundException();
    return this.entitiesService.remove(id);
  }
}
