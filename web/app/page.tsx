import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-3xl font-semibold">LeafyLand v2</h1>
      <p className="text-sm text-muted-foreground">
        Foundation-phase scaffold — Identity + User vertical slice
        (register → verify email → login → profile).
      </p>
      <Button asChild>
        <Link href="/login">Go to login</Link>
      </Button>
    </main>
  );
}
