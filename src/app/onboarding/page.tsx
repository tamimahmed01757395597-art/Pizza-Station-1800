'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, MapPin, UserRound } from 'lucide-react';
import { z } from 'zod';
import { validateForm } from '@/lib/form-validation';
import { onboardingAddressSchema, onboardingProfileSchema } from '@/lib/schemas';

const errorSchema = z.object({ error: z.string() });

type Address = {
  label: string;
  recipient_name: string;
  recipient_phone: string;
  address_line1: string;
  address_line2: string;
  locality: string;
  region: string;
  postal_code: string;
  country_code: string;
  delivery_instructions: string;
};

const emptyAddress: Address = {
  label: 'Home',
  recipient_name: '',
  recipient_phone: '',
  address_line1: '',
  address_line2: '',
  locality: '',
  region: '',
  postal_code: '',
  country_code: 'BD',
  delivery_instructions: '',
};

const steps = ['Welcome', 'Your details', 'Delivery address', 'All set'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [useAddress, setUseAddress] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (step !== 3) return;
    const timer = window.setTimeout(() => {
      router.replace('/menu');
      router.refresh();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [step, router]);

  function updateAddress(key: keyof Address, value: string) {
    setAddress((current) => ({ ...current, [key]: value }));
  }

  function continueFromDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const check = validateForm(onboardingProfileSchema, {
      full_name: fullName,
      ...(phone ? { phone } : {}),
    });
    if (!check.ok) {
      setErrors(check.errors);
      setError(check.message);
      return;
    }
    setErrors({});
    setStep(2);
  }

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    let addressPayload: z.infer<typeof onboardingAddressSchema> | undefined;
    if (useAddress) {
      const check = validateForm(onboardingAddressSchema, address);
      if (!check.ok) {
        setErrors(check.errors);
        setError(check.message);
        return;
      }
      addressPayload = check.data;
    }
    setErrors({});
    setSaving(true);
    try {
      const response = await fetch('/api/account/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, ...(phone ? { phone } : {}), ...(addressPayload ? { address: addressPayload } : {}) }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const parsed = errorSchema.safeParse(result);
        throw new Error(parsed.success ? parsed.data.error : 'Unable to save your setup.');
      }
      setStep(3);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to save your setup.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container min-h-[70vh] py-14">
      <div className="panel mx-auto max-w-2xl p-7 sm:p-10">
        <span className="station-stamp">NEW CREW SETUP</span>
        <h1 className="serif mt-3 text-3xl">Welcome Aboard</h1>

        <ol className="mt-6 grid grid-cols-4 gap-2">
          {steps.map((label, index) => (
            <li key={label} className={`border-[2px] border-[#1c1b2a] px-2 py-2 text-center mono text-[9px] font-bold uppercase tracking-wider ${index <= step ? 'bg-[#ffc857]' : 'bg-white text-[#7c747a]'}`}>
              {label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="mt-8">
            <p className="text-sm leading-6 text-[#635d64]">
              Let us set up your account in two quick steps so future checkout is faster.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="border-[3px] border-[#1c1b2a] bg-[#7fd1c1]/25 p-4">
                <UserRound size={22} />
                <h2 className="serif mt-3 text-base">Your details</h2>
                <p className="mt-1 text-xs text-[#635d64]">Name and phone for order updates.</p>
              </div>
              <div className="border-[3px] border-[#1c1b2a] bg-[#ffc857]/30 p-4">
                <MapPin size={22} />
                <h2 className="serif mt-3 text-base">Delivery address</h2>
                <p className="mt-1 text-xs text-[#635d64]">Save a default address for delivery orders.</p>
              </div>
            </div>
            <button type="button" className="btn mt-7" onClick={() => setStep(1)}>Let&apos;s go <ArrowRight size={15} /></button>
            <Link href="/menu" className="ml-4 text-sm text-[#635d64] underline">Skip setup</Link>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={continueFromDetails} className="mt-8 grid gap-4" noValidate>
            <label className="text-sm">Full name
              <input className="field mt-2" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" maxLength={120} aria-invalid={Boolean(errors.full_name)} />
              {errors.full_name && <span className="mt-1 block text-xs text-[#c23348]">{errors.full_name}</span>}
            </label>
            <label className="text-sm">Phone (optional)
              <input className="field mt-2" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" maxLength={30} />
            </label>
            {error && <p role="alert" className="text-sm text-[#c23348]">{error}</p>}
            <div className="mt-2 flex items-center gap-3">
              <button type="button" className="btn secondary" onClick={() => setStep(0)}><ArrowLeft size={15} /> Back</button>
              <button className="btn" disabled={saving}>Continue <ArrowRight size={15} /></button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={finish} className="mt-8 grid gap-4" noValidate>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={useAddress} onChange={(event) => setUseAddress(event.target.checked)} />
              Save a delivery address now
            </label>
            {useAddress && (
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ['label', 'Label (Home, Work)'],
                  ['recipient_name', 'Recipient name'],
                  ['recipient_phone', 'Recipient phone'],
                  ['address_line1', 'Address line 1'],
                  ['address_line2', 'Address line 2'],
                  ['locality', 'City / area'],
                  ['region', 'Region'],
                  ['postal_code', 'Postal code'],
                  ['country_code', 'Country code'],
                ] as [keyof Address, string][]).map(([key, label]) => (
                  <label key={key} className="text-sm">
                    {label}
                    <input
                      className="field mt-2"
                      value={address[key]}
                      onChange={(event) => updateAddress(key, event.target.value)}
                      maxLength={200}
                      aria-invalid={Boolean(errors[key])}
                    />
                    {errors[key] && <span className="mt-1 block text-xs text-[#c23348]">{errors[key]}</span>}
                  </label>
                ))}
                <label className="text-sm sm:col-span-2">Delivery instructions (optional)
                  <textarea className="field mt-2" rows={2} value={address.delivery_instructions} onChange={(event) => updateAddress('delivery_instructions', event.target.value)} maxLength={500} />
                </label>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-[#c23348]">{error}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button type="button" className="btn secondary" onClick={() => setStep(1)} disabled={saving}><ArrowLeft size={15} /> Back</button>
              <button className="btn disabled:opacity-50" disabled={saving}>
                {saving ? 'Saving…' : useAddress ? 'Finish setup' : 'Finish without address'}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="mt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#7fd1c1] shadow-[5px_5px_0_#1c1b2a]">
              <Check size={30} />
            </div>
            <h2 className="serif mt-5 text-2xl">You&apos;re Ready</h2>
            <p className="mt-2 text-sm text-[#635d64]">Taking you to the menu…</p>
          </div>
        )}
      </div>
    </main>
  );
}
