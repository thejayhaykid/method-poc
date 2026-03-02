import { Controller, Post, Body } from '@nestjs/common';
import { IsString, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import type {
  IEntityVerificationSessionMethods,
  IEntityVerificationSessionTypes,
  IEntityVerificationSession,
  IEntityKbaVerificationAnswerUpdate,
  IResponse,
} from 'method-node';
import { VerificationService } from './verification.service.js';

class CreateSessionDto {
  @IsString()
  entity_id: string;

  @IsIn(['phone', 'identity'])
  type: IEntityVerificationSessionTypes;

  @IsIn(['sms', 'sna', 'byo_sms', 'kba', 'byo_kyc', 'element'])
  method: IEntityVerificationSessionMethods;
}

class KbaAnswer implements IEntityKbaVerificationAnswerUpdate {
  @IsString()
  question_id: string;

  @IsString()
  answer_id: string;
}

class UpdateSessionDto {
  @IsString()
  entity_id: string;

  @IsString()
  session_id: string;

  @IsIn(['phone', 'identity'])
  type: IEntityVerificationSessionTypes;

  @IsIn(['sms', 'sna', 'byo_sms', 'kba', 'byo_kyc', 'element'])
  method: IEntityVerificationSessionMethods;

  @IsOptional()
  @IsString()
  sms_code?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KbaAnswer)
  kba_answers?: KbaAnswer[];
}

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post()
  create(@Body() dto: CreateSessionDto): Promise<IResponse<IEntityVerificationSession>> {
    return this.verificationService.createSession(
      dto.entity_id,
      dto.type,
      dto.method,
    );
  }

  @Post('update')
  update(@Body() dto: UpdateSessionDto): Promise<IResponse<IEntityVerificationSession>> {
    return this.verificationService.updateSession(
      dto.entity_id,
      dto.session_id,
      dto.type,
      dto.method,
      { sms_code: dto.sms_code, kba_answers: dto.kba_answers },
    );
  }
}
