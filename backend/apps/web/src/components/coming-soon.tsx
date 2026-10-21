import { Construction } from 'lucide-react';
import { PageHeader } from './page-header';
import { Card } from './ui/card';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} sample={false} />
      <Card className="grid max-w-2xl place-items-center px-6 py-14 text-center">
        <Construction className="size-8 text-muted" aria-hidden />
        <p className="mt-3 font-semibold">Coming soon</p>
        <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
      </Card>
    </>
  );
}
