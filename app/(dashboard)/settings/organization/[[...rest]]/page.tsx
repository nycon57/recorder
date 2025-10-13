import { OrganizationProfile } from '@clerk/nextjs';

export default function OrganizationSettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization, members, and permissions
        </p>
      </div>

      {/* Clerk's pre-built OrganizationProfile component */}
      <OrganizationProfile
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border',
          },
        }}
      />
    </div>
  );
}
