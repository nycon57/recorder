import { redirect } from 'next/navigation';

/**
 * Organization settings index page
 * Redirects to the general settings page
 */
export default function OrganizationSettingsPage() {
  redirect('/settings/organization/general');
}
