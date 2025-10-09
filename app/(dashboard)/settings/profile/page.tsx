import { UserProfile } from '@clerk/nextjs';

export default function ProfileSettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your personal account information and preferences
        </p>
      </div>

      {/* Clerk's pre-built UserProfile component */}
      <UserProfile
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
