import type { MouseEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  useListEntitiesQuery,
  useDeleteEntityMutation,
  getErrorMessage,
} from '@/store/apiSlice';
import { useAppDispatch } from '@/store';
import { entityCreated } from '@/store/appSlice';
import type { LocalEntity } from '@/types';

export function EntityPicker() {
  const dispatch = useAppDispatch();
  const { data: entities = [], isLoading, error } = useListEntitiesQuery();
  const [deleteEntity] = useDeleteEntityMutation();

  if (isLoading) return null;
  if (entities.length === 0) return null;

  function handleSelect(entity: LocalEntity) {
    dispatch(
      entityCreated({
        id: entity.id,
        methodId: entity.methodId,
        firstName: entity.firstName,
        lastName: entity.lastName,
        status: entity.status,
      }),
    );
  }

  function handleDelete(e: MouseEvent, id: number) {
    e.stopPropagation();
    deleteEntity(id);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Previous Entities</CardTitle>
        <CardDescription>
          Or pick an existing entity to continue where you left off.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        )}

        <div className="space-y-1">
          {entities.map((entity, idx) => (
            <div key={entity.id}>
              {idx > 0 && <Separator className="my-1" />}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  className="flex-1 justify-start h-auto py-2 px-3"
                  onClick={() => handleSelect(entity)}
                >
                  <div className="flex items-center justify-between w-full gap-3">
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entity.firstName} {entity.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {entity.methodId}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {entity.verificationStatus && (
                        <Badge variant="outline" className="text-xs">
                          {entity.verificationStatus}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {entity.status}
                      </Badge>
                    </div>
                  </div>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDelete(e, entity.id)}
                >
                  &times;
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
