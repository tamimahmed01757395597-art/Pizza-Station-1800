import type { Metadata } from 'next';
import { restaurant } from '@/lib/restaurant';

export const metadata: Metadata = { title: 'Privacy Policy', description: 'How Pizza Station 1800 handles your personal data.' };

const sections = [
  {
    title: 'Who we are',
    body: `${restaurant.name} ("we", "us") operates the website at this address and our physical kitchen in Manikganj. This policy explains what personal data we collect, why we collect it, and the choices you have.`,
  },
  {
    title: 'Information we collect',
    body: 'When you create an account or place an order we collect your name, email address, phone number, delivery address, order contents, and order status. When you browse the site we collect basic usage information such as pages viewed and device type through Google Analytics 4. Our error monitoring tool, Sentry, may receive technical details such as browser type, page URL and a stack trace when something breaks.',
  },
  {
    title: 'Why we use it',
    body: 'We use your details to create and secure your account, take and fulfil orders, send order confirmations and status updates, provide customer support, and improve the reliability and usability of the site. We do not sell your personal data.',
  },
  {
    title: 'Who we share with',
    body: 'We use Supabase for authentication and database storage, Resend for transactional email, Google Analytics 4 for aggregate usage measurement, and Sentry for error monitoring. Each provider receives only the data needed for its role and is contractually required to protect it.',
  },
  {
    title: 'Cookies and local storage',
    body: 'Supabase sets session cookies so you can stay signed in. Google Analytics may set cookies to distinguish browsing sessions. You can block cookies in your browser, but some account features will then stop working.',
  },
  {
    title: 'How long we keep it',
    body: 'Account data is kept until you delete your account. Delivery addresses are removed with it. Order records are retained for accounting and food-safety traceability, but the link to your account is removed so they can no longer identify you.',
  },
  {
    title: 'Your choices',
    body: 'You can view and correct your details under Account → Profile, change your password at any time, and permanently delete your account from the profile page. You can also contact us to ask what data we hold or to request its removal where applicable.',
  },
  {
    title: 'Security',
    body: 'We enforce HTTPS, row-level security in the database, server-side authorisation, rate limiting on sensitive endpoints, and strict access controls for staff. No service-role credentials are exposed to the browser.',
  },
  {
    title: 'Children',
    body: 'This site is not directed at children under 13, and we do not knowingly collect their personal information.',
  },
  {
    title: 'Changes and contact',
    body: 'We may update this policy as the service evolves; the date below shows the latest revision. For questions or data requests, call us at ' + restaurant.phone + ' or visit us in Manikganj.',
  },
];

export default function PrivacyPage() {
  return (
    <main className="container min-h-[60vh] py-14 text-[#1c1b2a]">
      <span className="station-stamp">THE FINE PRINT</span>
      <h1 className="serif mt-3 text-4xl sm:text-5xl">Privacy Policy</h1>
      <p className="mono mt-3 text-xs uppercase tracking-widest text-[#7c747a]">Last updated: 21 November 2026</p>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#635d64]">
        We keep this simple: we collect what we need to cook your food and get it to you, and nothing more.
      </p>
      <div className="mt-9 grid gap-4">
        {sections.map((section, index) => (
          <section key={section.title} className="border-[3px] border-[#1c1b2a] bg-[#fffcf5] p-5 sm:p-6">
            <h2 className="serif text-lg"><span className="text-[#ff6b4a]">{String(index + 1).padStart(2, '0')}. </span>{section.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[#635d64]">{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
