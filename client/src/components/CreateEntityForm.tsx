import { useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useCreateEntityMutation, getErrorMessage } from '@/store/apiSlice';
import { useAppDispatch } from '@/store';
import { entityCreated } from '@/store/appSlice';

const FIRST_NAMES = ['Thomas', 'Kevin', 'Sarah', 'Maria', 'James', 'Linda', 'Robert', 'Patricia'];
const LAST_NAMES = ['McMoney', 'Doyle', 'Pearson', 'Chen', 'Brooks', 'Rivera', 'Wallace', 'Kim'];
const STREETS = ['3300 N Interstate Hwy 35', '1205 Elm St', '742 Evergreen Terrace', '900 Congress Ave', '456 Oak Ln'];
const CITIES = ['Austin', 'Dallas', 'Houston', 'San Antonio', 'El Paso'];
const ZIPS = ['78705', '75201', '77001', '78201', '79901'];
const DOBS = ['1997-03-18', '1985-11-02', '1992-07-25', '1988-01-14', '2000-05-30', '1979-09-08'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigits(n: number): string {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
}

function generateTestData(): Record<string, string> {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  return {
    first_name: first,
    last_name: last,
    phone: '+15121231113',
    dob: pick(DOBS),
    ssn: randomDigits(9),
    email: `${first.toLowerCase()}.${last.toLowerCase()}@test.com`,
    line1: pick(STREETS),
    line2: '',
    city: pick(CITIES),
    state: 'TX',
    zip: pick(ZIPS),
  };
}

export function CreateEntityForm() {
  const dispatch = useAppDispatch();
  const formRef = useRef<HTMLFormElement>(null);
  const [createEntity, { isLoading, error }] = useCreateEntityMutation();

  function fillTestData() {
    const form = formRef.current;
    if (!form) return;
    const data = generateTestData();
    for (const [name, value] of Object.entries(data)) {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (name: string) => (f.get(name) as string) || undefined;

    const hasAddress = str('line1') && str('city') && str('state') && str('zip');

    try {
      const entity = await createEntity({
        first_name: f.get('first_name') as string,
        last_name: f.get('last_name') as string,
        phone: f.get('phone') as string,
        email: str('email'),
        dob: str('dob'),
        ssn: str('ssn'),
        ...(hasAddress && {
          address: {
            line1: str('line1')!,
            line2: str('line2'),
            city: str('city')!,
            state: str('state')!,
            zip: str('zip')!,
          },
        }),
      }).unwrap();

      dispatch(
        entityCreated({
          id: entity.id,
          methodId: entity.methodId,
          firstName: entity.firstName,
          lastName: entity.lastName,
          status: entity.status,
        }),
      );
    } catch {
      // error captured by RTK Query
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Individual Entity</CardTitle>
        <CardDescription>
          Provide as much PII as possible. Method needs enough info to match
          the individual's identity (typically name + phone + DOB + SSN + address).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <Button type="button" variant="outline" size="sm" onClick={fillTestData}>
            Fill Test Data
          </Button>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" name="first_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input id="last_name" name="last_name" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input id="phone" name="phone" placeholder="+15551234567" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" name="dob" placeholder="1991-04-14" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssn">SSN</Label>
              <Input id="ssn" name="ssn" placeholder="Full or last 4" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>

          <Separator />

          <p className="text-sm font-medium">Address</p>
          <div className="space-y-2">
            <Label htmlFor="line1">Street</Label>
            <Input id="line1" name="line1" placeholder="123 Main St" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line2">Apt / Suite</Label>
            <Input id="line2" name="line2" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" placeholder="TX" maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" name="zip" placeholder="78705" />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Creating...' : 'Create Entity'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
