// Split screen for sign-in, invite, reset and no-access: brand panel on the left, form on the right.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-line bg-accent-soft p-10 md:flex">
        <Brand />
        <p className="max-w-sm font-display text-2xl font-bold leading-snug text-ink">
          Every client, ticket and invoice in one place.
        </p>
        <span aria-hidden="true" />
      </aside>
      <main id="main" className="flex items-center justify-center px-5 py-10">
        <div className="grid w-full max-w-[380px] gap-6">
          <div className="md:hidden">
            <Brand />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon.svg" alt="" className="brand-mark" />
      <span className="brand-name">Permanent SEO</span>
    </div>
  );
}
