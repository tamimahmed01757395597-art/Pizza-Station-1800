'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#fff6e9', color: '#1c1b2a', fontFamily: 'sans-serif' }}>
        <main style={{ maxWidth: 640, margin: '10vh auto', padding: 32, border: '3px solid #1c1b2a', background: '#fffcf5' }}>
          <p style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: 2 }}>STATION FAULT</p>
          <h1 style={{ fontSize: 32, textTransform: 'uppercase' }}>The Station Needs a Reset</h1>
          <p style={{ color: '#635d64', lineHeight: 1.6 }}>A critical error stopped this page from loading. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 24, padding: '12px 20px', border: '3px solid #1c1b2a', background: '#ff6b4a', fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
