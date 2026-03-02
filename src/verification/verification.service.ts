import { Injectable, Logger } from '@nestjs/common';
import type {
  IEntityVerificationSession,
  IEntityVerificationSessionCreateOpts,
  IEntityVerificationSessionUpdateOpts,
  IEntityVerificationSessionMethods,
  IEntityVerificationSessionTypes,
  IEntitySmsVerificationUpdate,
  IEntityKbaVerificationAnswerUpdate,
  IResponse,
} from 'method-node';
import { MethodService } from '../method/method.service.js';

interface VerificationSessionUpdatePayload {
  type: IEntityVerificationSessionTypes;
  method: IEntityVerificationSessionMethods;
  sms?: IEntitySmsVerificationUpdate;
  byo_sms?: IEntitySmsVerificationUpdate;
  kba?: { answers: IEntityKbaVerificationAnswerUpdate[] };
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly methodService: MethodService) {}

  async createSession(
    entityId: string,
    type: IEntityVerificationSessionTypes,
    method: IEntityVerificationSessionMethods,
  ): Promise<IResponse<IEntityVerificationSession>> {
    const payload: IEntityVerificationSessionCreateOpts = {
      type,
      method,
      ...(method === 'sms' && { sms: {} }),
      ...(method === 'sna' && { sna: {} }),
      ...(method === 'byo_sms' && { byo_sms: { timestamp: new Date().toISOString() } }),
      ...(method === 'byo_kyc' && { byo_kyc: {} }),
      ...(method === 'kba' && { kba: {} }),
    };

    const session = await this.methodService.client
      .entities(entityId)
      .verificationSessions.create(payload);

    this.logger.log(
      `Created ${type}/${method} session ${session.id} for ${entityId}`,
    );
    return session;
  }

  async updateSession(
    entityId: string,
    sessionId: string,
    type: IEntityVerificationSessionTypes,
    method: IEntityVerificationSessionMethods,
    data: {
      sms_code?: string;
      kba_answers?: IEntityKbaVerificationAnswerUpdate[];
    },
  ): Promise<IResponse<IEntityVerificationSession>> {
    const payload: VerificationSessionUpdatePayload = {
      type,
      method,
      ...(method === 'sms' && data.sms_code && { sms: { sms_code: data.sms_code } }),
      ...(method === 'byo_sms' && data.sms_code && { byo_sms: { sms_code: data.sms_code } }),
      ...(method === 'kba' && data.kba_answers && {
        kba: {
          answers: data.kba_answers.map((a) => ({
            question_id: a.question_id,
            answer_id: a.answer_id,
          })),
        },
      }),
    };

    const result = await this.methodService.client
      .entities(entityId)
      .verificationSessions.update(
        sessionId,
        payload as unknown as IEntityVerificationSessionUpdateOpts,
      );

    this.logger.log(`Session ${sessionId} status: ${result.status}`);
    return result;
  }
}
