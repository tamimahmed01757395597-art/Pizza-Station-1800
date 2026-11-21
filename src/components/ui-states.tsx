import type { ReactNode } from 'react';

/** Small inline loading indicator used inside buttons and list rows. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-[#635d64]">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-[3px] border-[#1c1b2a] border-t-transparent" />
      <span className="mono text-xs uppercase tracking-widest">{label}…</span>
    </span>
  );
}

/** Placeholder block that mirrors the shape of loading content. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse border-[2px] border-[#1c1b2a]/15 bg-[#1c1b2a]/10 ${className}`} />;
}

/** Consistent empty state with an optional call to action. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border-[3px] border-dashed border-[#1c1b2a]/30 bg-[#fffcf5]/60 p-8 text-center">
      {icon && <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border-[3px] border-[#1c1b2a] bg-[#ffc857]">{icon}</div>}
      <h2 className="serif text-xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#635d64]">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
