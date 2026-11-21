import { headers } from 'next/headers';
import Script from 'next/script';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4. Renders nothing until a measurement ID is configured,
 * so local development and test environments send no analytics traffic.
 * The CSP nonce from middleware is attached to both the external loader and
 * the inline bootstrap so the enforced policy allows them.
 */
export async function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId) return null;

  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const inline = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', ${JSON.stringify(measurementId)});
  `;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="ga4-init" strategy="afterInteractive" nonce={nonce} dangerouslySetInnerHTML={{ __html: inline }} />
    </>
  );
}
