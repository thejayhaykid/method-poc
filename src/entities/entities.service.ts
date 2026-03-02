import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  IEntity,
  IEntityAddress,
  IEntityConnect,
  IEntityVehicles,
  IIndividualCreateOpts,
  IResponse,
} from 'method-node';
import { MethodEntity } from './method-entity.entity.js';
import { MethodService } from '../method/method.service.js';
import { CreateEntityDto } from './dto/create-entity.dto.js';

@Injectable()
export class EntitiesService {
  private readonly logger = new Logger(EntitiesService.name);

  constructor(
    @InjectRepository(MethodEntity)
    private readonly entityRepo: Repository<MethodEntity>,
    private readonly methodService: MethodService,
  ) {}

  async create(dto: CreateEntityDto): Promise<MethodEntity> {
    const address: IEntityAddress | undefined = dto.address
      ? {
          line1: dto.address.line1,
          line2: dto.address.line2 ?? null,
          city: dto.address.city,
          state: dto.address.state,
          zip: dto.address.zip,
        }
      : undefined;

    const payload: IIndividualCreateOpts = {
      type: 'individual',
      individual: {
        first_name: dto.first_name,
        last_name: dto.last_name,
        phone: dto.phone,
        email: dto.email ?? null,
        dob: dto.dob ?? null,
        ssn: dto.ssn?.replace(/\D/g, '') ?? null,
      },
      ...(address && { address }),
    };

    const response = await this.methodService.client.entities.create(payload);

    this.logger.log(`Created Method entity: ${response.id}`);

    const entity = this.entityRepo.create({
      methodId: response.id,
      type: response.type ?? 'individual',
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
      email: dto.email,
      dob: dto.dob,
      status: response.status ?? 'active',
      methodResponse: response as unknown as Record<string, unknown>,
    });

    return this.entityRepo.save(entity);
  }

  async findAll(): Promise<MethodEntity[]> {
    return this.entityRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<MethodEntity | null> {
    return this.entityRepo.findOneBy({ id });
  }

  async findByMethodId(methodId: string): Promise<MethodEntity | null> {
    return this.entityRepo.findOneBy({ methodId });
  }

  async retrieveFromMethod(methodId: string): Promise<IResponse<IEntity>> {
    const remote = await this.methodService.client.entities.retrieve(methodId);

    const local = await this.entityRepo.findOneBy({ methodId });
    if (local) {
      local.status = remote.status ?? local.status;
      local.methodResponse = remote;
      await this.entityRepo.save(local);
    }

    return remote;
  }

  async createConnect(methodId: string): Promise<IResponse<IEntityConnect>> {
    const connect = await this.methodService.client
      .entities(methodId)
      .connect.create();
    this.logger.log(`Created connect ${connect.id} for entity ${methodId}`);
    return connect;
  }

  async listVehicles(methodId: string): Promise<IResponse<IEntityVehicles>[]> {
    const list = await this.methodService.client
      .entities(methodId)
      .vehicles.list();
    this.logger.log(`Listed ${list.length} vehicle record(s) for entity ${methodId}`);
    return list;
  }

  async createVehicleRequest(methodId: string): Promise<IResponse<IEntityVehicles>> {
    const vehicle = await this.methodService.client
      .entities(methodId)
      .vehicles.create();
    this.logger.log(`Created vehicle request ${vehicle.id} for entity ${methodId}`);
    return vehicle;
  }

  async remove(id: number): Promise<{ deleted: true }> {
    await this.entityRepo.delete(id);
    return { deleted: true };
  }

  async updateVerificationStatus(
    methodId: string,
    status: string,
    sessionId?: string,
  ): Promise<MethodEntity | null> {
    await this.entityRepo.update(
      { methodId },
      {
        verificationStatus: status,
        ...(sessionId && { verificationSessionId: sessionId }),
      },
    );
    return this.findByMethodId(methodId);
  }
}
