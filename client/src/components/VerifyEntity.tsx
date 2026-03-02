import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAppSelector } from '@/store';
import { selectEntity } from '@/store/appSlice';
import { AccountsList } from '@/components/AccountsList';
import { VehiclesList } from '@/components/VehiclesList';
import {
  useRetrieveMethodEntityQuery,
  useCreateVerificationSessionMutation,
  useUpdateVerificationSessionMutation,
  useCreateConnectMutation,
  getErrorMessage,
} from '@/store/apiSlice';
import type {
  IEntityVerificationSession,
  IEntityVerificationSessionMethods,
  IEntityVerificationSessionTypes,
  IEntityKbaVerificationQuestion,
  IEntityKbaVerificationAnswer,
  IEntityKbaVerificationAnswerUpdate,
} from '@/types';

const PHONE_API_METHODS: IEntityVerificationSessionMethods[] = ['byo_sms', 'kba'];
const IDENTITY_API_METHODS: IEntityVerificationSessionMethods[] = ['byo_kyc', 'kba'];
const API_METHOD_SET = new Set<string>([...PHONE_API_METHODS, ...IDENTITY_API_METHODS]);

function isSessionMethod(m: string): m is IEntityVerificationSessionMethods {
  return API_METHOD_SET.has(m);
}

const METHOD_LABELS: Partial<Record<IEntityVerificationSessionMethods, string>> = {
  byo_sms: 'BYO SMS',
  byo_kyc: 'BYO KYC',
  kba: 'KBA',
};

export function VerifyEntity() {
  const entity = useAppSelector(selectEntity)!;

  const { data: methodEntity, isLoading, error: fetchError, refetch } =
    useRetrieveMethodEntityQuery(entity.methodId);

  const verification = methodEntity?.verification;
  const phoneVerified = verification?.phone?.verified ?? false;
  const identityVerified = verification?.identity?.verified ?? false;
  const rawPhoneMethods: string[] = verification?.phone?.methods ?? [];
  const rawIdentityMethods: string[] = verification?.identity?.methods ?? [];
  const phoneMethods = rawPhoneMethods.filter(isSessionMethod);
  const identityMethods = rawIdentityMethods.filter(isSessionMethod);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading verification status...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Verification</CardTitle>
          <CardDescription>
            <span className="font-mono text-foreground">{entity.methodId}</span>
            {' — '}{entity.firstName} {entity.lastName}
            <Badge variant="outline" className="ml-2">{methodEntity?.status ?? entity.status}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatusBlock label="Phone" verified={phoneVerified} methods={phoneMethods} />
            <StatusBlock label="Identity" verified={identityVerified} methods={identityMethods} />
          </div>

          {fetchError && <p className="text-sm text-destructive">{getErrorMessage(fetchError)}</p>}

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh Status
          </Button>
        </CardContent>
      </Card>

      {!phoneVerified && (
        <SessionCard
          entityId={entity.methodId}
          verType="phone"
          methods={phoneMethods.length > 0 ? phoneMethods : PHONE_API_METHODS}
          fallback={phoneMethods.length === 0}
          rawMethods={rawPhoneMethods}
          onSuccess={() => refetch()}
        />
      )}

      {!identityVerified && (
        <SessionCard
          entityId={entity.methodId}
          verType="identity"
          methods={identityMethods.length > 0 ? identityMethods : IDENTITY_API_METHODS}
          fallback={identityMethods.length === 0}
          rawMethods={rawIdentityMethods}
          onSuccess={() => refetch()}
        />
      )}

      {phoneVerified && identityVerified && (
        <ConnectCard entityId={entity.methodId} onSuccess={() => refetch()} />
      )}

      {phoneVerified && identityVerified && (
        <>
          <AccountsList entityId={entity.methodId} />
          <VehiclesList entityId={entity.methodId} />
        </>
      )}
    </div>
  );
}

function StatusBlock({ label, verified, methods }: { label: string; verified: boolean; methods: IEntityVerificationSessionMethods[] }) {
  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={verified ? 'default' : 'secondary'}>{verified ? 'Verified' : 'Unverified'}</Badge>
      </div>
      {!verified && methods.length > 0 && (
        <p className="text-xs text-muted-foreground">Available: {methods.map(m => METHOD_LABELS[m] ?? m).join(', ')}</p>
      )}
    </div>
  );
}

function ConnectCard({ entityId, onSuccess }: { entityId: string; onSuccess: () => void }) {
  const [createConnect, { data: connect, isLoading, error }] = useCreateConnectMutation();

  async function handleCreate() {
    try {
      await createConnect(entityId).unwrap();
      onSuccess();
    } catch { /* RTK */ }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connect</CardTitle>
        <CardDescription>
          Create a Connect to link liability accounts for this entity. You must do this before fetching accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connect && (
          <Button
            variant="outline"
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Creating Connect...' : 'Create Connect'}
          </Button>
        )}
        {connect && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Connect <span className="font-mono">{connect.id}</span> — Status: <Badge variant="outline">{connect.status}</Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              You can now fetch accounts below. If status is pending, wait for it to complete and refresh.
            </p>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{getErrorMessage(error)}</p>}
      </CardContent>
    </Card>
  );
}

function SessionCard({
  entityId, verType, methods, onSuccess, fallback = false, rawMethods = [],
}: {
  entityId: string;
  verType: IEntityVerificationSessionTypes;
  methods: IEntityVerificationSessionMethods[];
  onSuccess: () => void;
  fallback?: boolean;
  rawMethods?: string[];
}) {
  const [chosen, setChosen] = useState<IEntityVerificationSessionMethods | null>(null);
  const [session, setSession] = useState<IEntityVerificationSession | null>(null);
  const [createSession, { isLoading: creating, error: createErr }] = useCreateVerificationSessionMutation();
  const [updateSession, { isLoading: updating, error: updateErr }] = useUpdateVerificationSessionMutation();
  const busy = creating || updating;
  const error = createErr || updateErr;

  async function start(method: IEntityVerificationSessionMethods) {
    setChosen(method);
    try {
      const s = await createSession({ entity_id: entityId, type: verType, method }).unwrap();
      setSession(s);
      if (s.status === 'verified') onSuccess();
    } catch { /* RTK */ }
  }

  async function submitKba(answers: IEntityKbaVerificationAnswerUpdate[]) {
    if (!session) return;
    try {
      const r = await updateSession({ entity_id: entityId, session_id: session.id, type: verType, method: 'kba', kba_answers: answers }).unwrap();
      if (r.status === 'verified') onSuccess();
    } catch { /* RTK */ }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{verType === 'phone' ? 'Phone' : 'Identity'} Verification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fallback && !session && (
          <p className="text-xs text-muted-foreground">
            Entity reports methods: {rawMethods.join(', ') || 'none'} (UI-only).
            Trying standard API methods instead:
          </p>
        )}

        {!session && (
          <div className="flex flex-wrap gap-2">
            {methods.map(m => (
              <Button key={m} variant="outline" size="sm" disabled={busy} onClick={() => start(m)}>
                {busy && chosen === m ? 'Starting...' : METHOD_LABELS[m] ?? m}
              </Button>
            ))}
          </div>
        )}

        {session && (chosen === 'byo_sms' || chosen === 'byo_kyc') && session.status !== 'verified' && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{METHOD_LABELS[chosen] ?? chosen} session <span className="font-mono">{session.id}</span> — Status: <Badge variant="outline">{session.status}</Badge></p>
            <Button variant="outline" size="sm" onClick={onSuccess}>Refresh</Button>
          </div>
        )}

        {session && chosen === 'kba' && session.status !== 'verified' && (
          <KbaForm session={session} busy={busy} onSubmit={submitKba} />
        )}

        {session?.status === 'verified' && <p className="text-sm text-green-600 font-medium">Verified!</p>}
        {error && <p className="text-sm text-destructive">{getErrorMessage(error)}</p>}
      </CardContent>
    </Card>
  );
}

function KbaForm({ session, busy, onSubmit }: {
  session: IEntityVerificationSession;
  busy: boolean;
  onSubmit: (answers: IEntityKbaVerificationAnswerUpdate[]) => void;
}) {
  const questions: IEntityKbaVerificationQuestion[] = session.kba?.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!questions.length) {
    return <p className="text-sm text-muted-foreground">KBA session <span className="font-mono">{session.id}</span> — no questions returned.</p>;
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(Object.entries(answers).map(([qid, aid]) => ({ question_id: qid, answer_id: aid }))); }} className="space-y-4">
      <p className="text-sm text-muted-foreground">Answer to verify identity.</p>
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <Label>{q.text}</Label>
          <div className="flex flex-col gap-1">
            {q.answers.map((a: IEntityKbaVerificationAnswer) => (
              <label key={a.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${answers[q.id] === a.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                <input type="radio" name={q.id} checked={answers[q.id] === a.id} onChange={() => setAnswers(p => ({ ...p, [q.id]: a.id }))} className="accent-primary" />
                {a.text}
              </label>
            ))}
          </div>
          <Separator />
        </div>
      ))}
      <Button type="submit" disabled={busy || Object.keys(answers).length < questions.length} className="w-full">
        {busy ? 'Submitting...' : 'Submit Answers'}
      </Button>
    </form>
  );
}
