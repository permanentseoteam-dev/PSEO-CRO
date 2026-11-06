import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { ToastProvider } from "@/components/ui/toast";
import { Splash } from "@/components/shell/splash";
import { getAgencyBrand } from "@/lib/modules/agency/queries";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["600", "700", "800"] });

// The agency name comes from agency_settings (0218) through agency_brand(), which works before sign-in.
export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getAgencyBrand();
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Team and client portal",
    manifest: "/manifest.json",
    icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1430" },
  ],
};

// Theme and density come from cookies ("theme": light|dark, unset = system; "density": compact) so the first paint is right.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const theme = jar.get("theme")?.value;
  const density = jar.get("density")?.value;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable}`}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      data-density={density === "compact" ? "compact" : undefined}
    >
      <body>
        <Splash />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
