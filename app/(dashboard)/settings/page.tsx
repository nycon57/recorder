import { redirect } from 'next/navigation';

export default function SettingsPage() {
  // Redirect to profile settings by default
  redirect('/settings/profile');
}
