import { Injectable, Logger } from '@nestjs/common';
import type { IAccount, IResponse } from 'method-node';
import { MethodService } from '../method/method.service.js';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly methodService: MethodService) {}

  async listByEntity(entityId: string): Promise<IResponse<IAccount>[]> {
    this.logger.log(`Listing accounts for entity ${entityId}`);
    const accounts = await this.methodService.client.accounts.list({
      holder_id: entityId,
    });
    return accounts;
  }
}
