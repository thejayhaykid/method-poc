import { Controller, Get, Param } from '@nestjs/common';
import type { IAccount, IResponse } from 'method-node';
import { AccountsService } from './accounts.service.js';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get('entity/:entityId')
  listByEntity(@Param('entityId') entityId: string): Promise<IResponse<IAccount>[]> {
    return this.accountsService.listByEntity(entityId);
  }
}
