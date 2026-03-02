import type { BaseQueryFn } from '@reduxjs/toolkit/query/react';
import { createApi } from '@reduxjs/toolkit/query/react';
import axios, { type AxiosRequestConfig, type AxiosError } from 'axios';
import type {
  LocalEntity,
  IEntity,
  IEntityAddress,
  IEntityVerificationSession,
  IEntityVerificationSessionTypes,
  IEntityVerificationSessionMethods,
  IEntityKbaVerificationAnswerUpdate,
  IAccount,
  IEntityVehicles,
} from '@/types';

interface ApiErrorBody {
  statusCode: number;
  message: string;
  source?: string;
  type?: string;
  sub_type?: string;
  code?: string;
  formattedMessage?: string;
}

interface ApiError {
  status?: number;
  data: ApiErrorBody;
}

function formatApiError(body: ApiErrorBody): string {
  const parts: string[] = [];
  if (body.source === 'method-api') parts.push('[Method API]');
  if (body.type) parts.push(body.type);
  if (body.sub_type) parts.push(`(${body.sub_type})`);
  parts.push(body.message || 'Unknown error');
  if (body.code) parts.push(`— code: ${body.code}`);
  return parts.join(' ');
}

const axiosInstance = axios.create({ baseURL: '/api' });

const axiosBaseQuery: BaseQueryFn<
  | string
  | { url: string; method?: AxiosRequestConfig['method']; body?: unknown },
  unknown,
  ApiError
> = async (args) => {
  const config: AxiosRequestConfig =
    typeof args === 'string'
      ? { url: args, method: 'GET' }
      : { url: args.url, method: args.method ?? 'GET', data: args.body };

  try {
    const result = await axiosInstance(config);
    return { data: result.data };
  } catch (err) {
    const axiosError = err as AxiosError<ApiErrorBody>;
    const body: ApiErrorBody = axiosError.response?.data ?? {
      statusCode: axiosError.response?.status ?? 500,
      message: axiosError.message,
    };
    return {
      error: {
        status: axiosError.response?.status,
        data: { ...body, formattedMessage: formatApiError(body) },
      },
    };
  }
};

interface CreateEntityPayload {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  dob?: string;
  ssn?: string;
  address?: Partial<IEntityAddress>;
}

interface CreateVerificationPayload {
  entity_id: string;
  type: IEntityVerificationSessionTypes;
  method: IEntityVerificationSessionMethods;
}

interface UpdateVerificationPayload {
  entity_id: string;
  session_id: string;
  type: IEntityVerificationSessionTypes;
  method: IEntityVerificationSessionMethods;
  sms_code?: string;
  kba_answers?: IEntityKbaVerificationAnswerUpdate[];
}

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery,
  tagTypes: ['Entity', 'MethodEntity', 'Accounts', 'Vehicles'],
  endpoints: (builder) => ({
    createEntity: builder.mutation<LocalEntity, CreateEntityPayload>({
      query: (body) => ({ url: '/entities', method: 'POST', body }),
      invalidatesTags: ['Entity'],
    }),

    listEntities: builder.query<LocalEntity[], void>({
      query: () => '/entities',
      providesTags: ['Entity'],
    }),

    deleteEntity: builder.mutation<{ deleted: true }, number>({
      query: (id) => ({ url: `/entities/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Entity'],
    }),

    retrieveMethodEntity: builder.query<IEntity, string>({
      query: (methodId) => `/entities/method/${methodId}`,
      providesTags: (_result, _err, methodId) => [
        { type: 'MethodEntity', id: methodId },
      ],
    }),

    createVerificationSession: builder.mutation<
      IEntityVerificationSession,
      CreateVerificationPayload
    >({
      query: (body) => ({ url: '/verification', method: 'POST', body }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'MethodEntity', id: arg.entity_id },
      ],
    }),

    updateVerificationSession: builder.mutation<
      IEntityVerificationSession,
      UpdateVerificationPayload
    >({
      query: (body) => ({ url: '/verification/update', method: 'POST', body }),
      invalidatesTags: (_result, _err, arg) => [
        { type: 'MethodEntity', id: arg.entity_id },
      ],
    }),

    createConnect: builder.mutation<
      {
        id: string;
        entity_id: string;
        status: string;
        accounts: string[] | null;
      },
      string
    >({
      query: (methodId) => ({
        url: `/entities/method/${methodId}/connect`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, methodId) => [
        { type: 'MethodEntity', id: methodId },
        { type: 'Accounts', id: methodId },
      ],
    }),

    listAccounts: builder.query<IAccount[], string>({
      query: (entityId) => `/accounts/entity/${entityId}`,
      providesTags: (_result, _err, entityId) => [
        { type: 'Accounts', id: entityId },
      ],
    }),

    listVehicles: builder.query<IEntityVehicles[], string>({
      query: (methodId) => `/entities/method/${methodId}/vehicles`,
      providesTags: (_result, _err, methodId) => [
        { type: 'Vehicles', id: methodId },
      ],
    }),

    createVehicleRequest: builder.mutation<IEntityVehicles, string>({
      query: (methodId) => ({
        url: `/entities/method/${methodId}/vehicles`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _err, methodId) => [
        { type: 'Vehicles', id: methodId },
      ],
    }),
  }),
});

export const {
  useCreateEntityMutation,
  useListEntitiesQuery,
  useDeleteEntityMutation,
  useRetrieveMethodEntityQuery,
  useCreateVerificationSessionMutation,
  useUpdateVerificationSessionMutation,
  useCreateConnectMutation,
  useListAccountsQuery,
  useLazyListAccountsQuery,
  useListVehiclesQuery,
  useLazyListVehiclesQuery,
  useCreateVehicleRequestMutation,
} = apiSlice;

export function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Unknown error';
  const e = error as ApiError;
  if (e.data?.formattedMessage) return e.data.formattedMessage;
  if (e.data?.message) return e.data.message;
  return 'Unknown error';
}
