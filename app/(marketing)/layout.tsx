import { Navbar, Footer } from '@/app/components/layout';

// Force dynamic rendering to prevent static generation at build time
// Marketing pages use Clerk components which require runtime env vars
export const dynamic = 'force-dynamic';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
