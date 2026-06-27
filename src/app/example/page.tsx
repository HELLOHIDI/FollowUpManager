'use client';

import { ExampleStatus } from '@/features/example/components/example-status';

export default function ExamplePage() {
  return (
    <div className="min-h-screen bg-background px-6 py-16 text-foreground">
      <ExampleStatus />
    </div>
  );
}
