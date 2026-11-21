import { Skeleton, Spinner } from '@/components/ui-states';

export default function Loading() {
  return (
    <main className="container min-h-[60vh] py-16">
      <div className="panel mx-auto max-w-3xl p-8 sm:p-10">
        <Spinner label="Heating up the station" />
        <div className="mt-8 grid gap-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </main>
  );
}
