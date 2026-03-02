import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CreateEntityForm } from '@/components/CreateEntityForm';
import { EntityPicker } from '@/components/EntityPicker';
import { VerifyEntity } from '@/components/VerifyEntity';
import { useAppDispatch, useAppSelector } from '@/store';
import { selectStep, selectEntity, reset } from '@/store/appSlice';

function App() {
  const dispatch = useAppDispatch();
  const step = useAppSelector(selectStep);
  const entity = useAppSelector(selectEntity);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Method FI — POC
            </h1>
            <p className="text-sm text-muted-foreground">
              Entity creation, verification, and account listing
            </p>
          </div>
          {entity && (
            <Button variant="ghost" size="sm" onClick={() => dispatch(reset())}>
              Start Over
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Badge variant={step === 'create' ? 'default' : 'secondary'}>1. Create Entity</Badge>
          <Separator className="flex-1" />
          <Badge variant={step === 'entity' ? 'default' : 'outline'}>2. Verify &amp; Accounts</Badge>
        </div>

        {step === 'create' && (
          <>
            <CreateEntityForm />
            <EntityPicker />
          </>
        )}
        {step === 'entity' && entity && <VerifyEntity />}
      </main>
    </div>
  );
}

export default App;
