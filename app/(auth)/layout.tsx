import { FolderKanban, ReceiptText, Ticket } from "lucide-react";
import { getAgencyBrand } from "@/lib/modules/agency/queries";
import type { AgencyBrand } from "@/lib/modules/agency/logic";
import s from "./auth.module.css";

// Split screen for sign-in, invite, reset and no-access: brand panel on the left, form on the right.
// Under 900px the brand panel collapses to a top band with the logo and headline.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = await getAgencyBrand();
  return (
    <div className={s.shell}>
      <aside className={s.panel}>
        <Brand brand={brand} />
        <div className={s.copy}>
          <p className={s.headline}>Run your agency from one place.</p>
          <p className={s.lead}>Your team and your clients work from the same live view.</p>
          <ul className={s.points}>
            <li>
              <FolderKanban aria-hidden="true" />
              Clients and projects
            </li>
            <li>
              <Ticket aria-hidden="true" />
              Tickets and approvals
            </li>
            <li>
              <ReceiptText aria-hidden="true" />
              Invoices and payments
            </li>
          </ul>
        </div>
        <p className={s.foot}>© {new Date().getFullYear()} {brand.name}</p>
      </aside>
      <main id="main" className={s.main}>
        <div className={s.card}>{children}</div>
      </main>
    </div>
  );
}

// Same mark as the staff sidebar: the agency logo, or its initials on the accent colour.
function Brand({ brand }: { brand: AgencyBrand }) {
  return (
    <div className="brand">
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote logo of unknown size
        <img src={brand.logoUrl} alt="" className="brand-mark rounded-lg object-contain" />
      ) : (
        <span
          className="brand-mark grid place-items-center rounded-lg font-display text-[13px] font-extrabold text-white"
          style={{ background: "var(--accent)" }}
          aria-hidden="true"
        >
          {brand.initials}
        </span>
      )}
      <span className="brand-name">{brand.name}</span>
    </div>
  );
}
