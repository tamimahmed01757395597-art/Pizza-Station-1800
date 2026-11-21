import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production' && Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Never send request headers, IP addresses or user identity to Sentry.
    if (event.request) {
      delete event.request.headers;
      delete (event.request as { env?: unknown }).env;
    }
    delete event.user;
    return event;
  },
});
