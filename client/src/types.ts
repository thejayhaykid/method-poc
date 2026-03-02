export type {
  IEntity,
  IEntityAddress,
  IEntityVerificationSession,
  IEntityVerificationSessionMethods,
  IEntityVerificationSessionTypes,
  IEntityKbaVerification,
  IEntityKbaVerificationQuestion,
  IEntityKbaVerificationAnswer,
  IEntityKbaVerificationAnswerUpdate,
  IEntityVehicles,
  IEntityVehiclesType,
  IAccount,
} from 'method-node';

export interface LocalEntity {
  id: number;
  methodId: string;
  type: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dob?: string;
  status: string;
  methodResponse: Record<string, unknown>;
  verificationStatus?: string;
  verificationSessionId?: string;
  createdAt: string;
  updatedAt: string;
}
