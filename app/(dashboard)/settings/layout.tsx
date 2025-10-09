import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r p-6">
        <h2 className="text-lg font-semibold mb-6">Settings</h2>
        <nav className="space-y-2">
          <SettingsNavLink href="/settings/profile">
            Profile
          </SettingsNavLink>
          <SettingsNavLink href="/settings/organization">
            Organization
          </SettingsNavLink>
          <SettingsNavLink href="/settings/billing">
            Billing
          </SettingsNavLink>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

function SettingsNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  // Note: usePathname is a client hook, so we'd need to make this a client component
  // For now, using a simple Link. In production, you'd want active state highlighting
  return (
    <Link
      href={href}
      className="block px-4 py-2 rounded-lg hover:bg-accent transition"
    >
      {children}
    </Link>
  );
}
