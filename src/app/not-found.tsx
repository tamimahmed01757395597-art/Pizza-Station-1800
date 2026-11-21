import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container min-h-[65vh] py-20 text-[#1c1b2a]">
      <div className="panel mx-auto max-w-2xl p-8 text-center sm:p-12">
        <span className="station-stamp">ERROR 404</span>
        <p className="serif mt-5 text-[86px] leading-none text-[#ff6b4a] sm:text-[120px]">404</p>
        <h1 className="serif mt-2 text-3xl">This Order Ticket Is Missing</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#635d64]">
          The page you asked for is not on the menu. It may have moved, been renamed, or never existed.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn text-xs">Back to the concourse</Link>
          <Link href="/menu" className="btn secondary text-xs">Browse the menu</Link>
        </div>
      </div>
    </main>
  );
}
