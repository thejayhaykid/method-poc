import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  useLazyListVehiclesQuery,
  useCreateVehicleRequestMutation,
  getErrorMessage,
} from '@/store/apiSlice';
import type { IEntityVehicles, IEntityVehiclesType } from '@/types';

interface Props {
  entityId: string;
}

function VehicleDetail({ v }: { v: IEntityVehiclesType }) {
  const parts = [v.year, v.make, v.model].filter(Boolean);
  const summary = parts.length ? parts.join(' ') : '—';
  return (
    <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
      <p className="font-medium">{summary}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        {v.vin && <span>VIN: <span className="font-mono">{v.vin}</span></span>}
        {v.series && <span>Series: {v.series}</span>}
        {v.major_color && <span>Color: {v.major_color}</span>}
        {v.style && <span>Style: {v.style}</span>}
      </div>
    </div>
  );
}

export function VehiclesList({ entityId }: Props) {
  const [trigger, { data: records = [], isLoading, isFetching, error }] =
    useLazyListVehiclesQuery();
  const [createRequest, { isLoading: creating }] = useCreateVehicleRequestMutation();
  const [fetched, setFetched] = useState(false);

  function fetchVehicles() {
    setFetched(true);
    trigger(entityId);
  }

  const allVehicles = records.flatMap((r) => (r.vehicles ?? []).filter(Boolean));
  const hasRecords = records.length > 0;
  const hasVehicles = allVehicles.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vehicles</CardTitle>
        <CardDescription>
          Vehicle data for this entity. Use for pre-filling collateral on loan refinance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchVehicles}
            disabled={isFetching}
            className="flex-1"
          >
            {isFetching ? 'Loading...' : fetched ? 'Refresh Vehicles' : 'Fetch Vehicles'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => createRequest(entityId)}
            disabled={creating}
          >
            {creating ? 'Requesting...' : 'Request vehicle data'}
          </Button>
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading vehicles...</p>
        )}

        {error && (
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        )}

        {fetched && !isLoading && !error && hasRecords && !hasVehicles && (
          <p className="text-sm text-muted-foreground">
            {records.length} vehicle record(s) but no vehicle details yet. Status may be pending — try &quot;Request vehicle data&quot; or refresh later.
          </p>
        )}

        {fetched && !isLoading && !error && !hasRecords && (
          <p className="text-sm text-muted-foreground">
            No vehicle records. Click &quot;Request vehicle data&quot; to fetch from Method.
          </p>
        )}

        {hasVehicles && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {allVehicles.length} vehicle(s) — use as collateral pre-fill
            </p>
            <div className="space-y-2">
              {allVehicles.map((v, idx) => (
                <VehicleDetail key={v.vin ?? idx} v={v} />
              ))}
            </div>
            {records.some((r) => r.status && r.status !== 'completed') && (
              <div className="flex flex-wrap gap-2">
                {records.map((r) => (
                  <Badge key={r.id} variant="outline">
                    {r.id}: {r.status}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
