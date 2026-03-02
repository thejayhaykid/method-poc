import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useLazyListAccountsQuery, getErrorMessage } from '@/store/apiSlice';

interface Props {
  entityId: string;
}

export function AccountsList({ entityId }: Props) {
  const [trigger, { data: accounts = [], isLoading, isFetching, error }] =
    useLazyListAccountsQuery();
  const [fetched, setFetched] = useState(false);

  function fetchAccounts() {
    setFetched(true);
    trigger(entityId);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          onClick={fetchAccounts}
          disabled={isFetching}
          className="w-full"
        >
          {isFetching ? 'Fetching...' : fetched ? 'Refresh Accounts' : 'Fetch Accounts'}
        </Button>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading accounts...</p>
        )}

        {error && (
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        )}

        {fetched && !isLoading && !error && accounts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No accounts found for this entity.
          </p>
        )}

        {accounts.length > 0 && (
          <div className="space-y-3">
            {accounts.map((account, idx) => (
              <div key={account.id || idx}>
                {idx > 0 && <Separator className="my-3" />}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {account.liability?.name || account.id}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {account.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{account.type}</Badge>
                    <Badge variant="outline">{account.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
