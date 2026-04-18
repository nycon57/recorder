import "@/app/components/marketing/tribora.css";
import { Footer } from "@/app/components/marketing/homepage/footer";
import { Reveal } from "@/app/components/marketing/homepage/reveal";
import { MarketingNav } from "@/app/components/marketing/marketing-nav";

// Force dynamic rendering — marketing pages use auth components that need
// runtime env vars. Keeping parity with the homepage layout.
export const dynamic = "force-dynamic";

/**
 * Marketing routes layout.
 *
 * Everything below the homepage lives here (/pricing, /about, /features,
 * /contact). We scope the Tribora design tokens to `.tribora` and reuse the
 * homepage Footer so chrome stays identical. Navigation is a page-route
 * variant of the homepage specimen nav.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tribora min-h-dvh">
      <MarketingNav />
      <main>{children}</main>
      <Footer />
      <Reveal />
    </div>
  );
}
