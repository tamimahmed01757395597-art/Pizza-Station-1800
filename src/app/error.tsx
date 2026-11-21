'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="container min-h-[60vh] py-16">
      <div className="panel mx-auto max-w-xl p-8 text-center sm:p-10">
        <span className="station-stamp">KITCHEN FAULT</span>
        <h1 className="serif mt-4 text-3xl">Something Went Wrong</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#635d64]">
          We could not load this section. Your order data is safe — try again in a moment.
        </p>
        {error.digest && <p className="mono mt-3 text-[10px] uppercase tracking-widest text-[#7c747a]">Ref: {error.digest}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn text-xs">Try again</button>
          <a href="/" className="btn secondary text-xs">Go home</a>
        </div>
      </div>
    </main>
  );
}
