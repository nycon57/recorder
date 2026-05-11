import { requireSystemAdmin } from '@/lib/utils/api';

export async function canAccessSystemAdminPage(): Promise<boolean> {
  try {
    await requireSystemAdmin();
    return true;
  } catch {
    return false;
  }
}
