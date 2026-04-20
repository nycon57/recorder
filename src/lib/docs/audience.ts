import { cache } from 'react';

import { auth } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

import type { DocsAudienceContext } from './types';

const logger = createLogger({});

/**
 * Resolve the docs audience for the current request.
 *
 * Resolution steps (least-privileged → most-privileged):
 *  1. `auth.api.getSession({ headers })` — same call as `src/app/(dashboard)/layout.tsx:36`.
 *  2. No session → `'public'`.
 *  3. Load `users` row via `supabaseAdmin` (`role`, `org_id`, `is_system_admin`).
 *  4. `is_system_admin === true` → `'system-admin'` (terminal — sees every page).
 *  5. `role ∈ {'owner', 'admin'}` and `org_id` set → `'org-admin'`.
 *  6. Else → `'public'`.
 *
 * Memoized with React `cache()` — called once per request regardless of how
 * many layout / page components invoke it.
 *
 * Never throws — auth failures degrade to `'public'` with a warn-level log.
 */
export const resolveDocsAudience = cache(
  async (headers: Headers): Promise<DocsAudienceContext> => {
    try {
      const session = await auth.api.getSession({ headers });

      if (!session) {
        return {
          audience: 'public',
          isSystemAdmin: false,
        };
      }

      const userId = session.user.id;

      const { data: userData, error } = await supabaseAdmin
        .from('users')
        .select('id, org_id, role, is_system_admin')
        .eq('id', userId)
        .single();

      if (error || !userData) {
        logger.warn('Failed to load user row for docs audience resolution', {
          data: { userId, error: error?.message },
        });
        return {
          audience: 'public',
          userId,
          isSystemAdmin: false,
        };
      }

      const isSystemAdmin = userData.is_system_admin === true;

      if (isSystemAdmin) {
        return {
          audience: 'system-admin',
          userId,
          orgId: userData.org_id ?? undefined,
          isSystemAdmin: true,
          role: userData.role as DocsAudienceContext['role'] ?? undefined,
        };
      }

      const role = userData.role as DocsAudienceContext['role'] ?? undefined;
      const isOrgAdmin =
        (role === 'owner' || role === 'admin') && !!userData.org_id;

      if (isOrgAdmin) {
        return {
          audience: 'org-admin',
          userId,
          orgId: userData.org_id ?? undefined,
          isSystemAdmin: false,
          role,
        };
      }

      return {
        audience: 'public',
        userId,
        orgId: userData.org_id ?? undefined,
        isSystemAdmin: false,
        role,
      };
    } catch (err) {
      logger.warn('Unexpected error in resolveDocsAudience; degrading to public', {
        data: { err: err instanceof Error ? err.message : String(err) },
      });
      return {
        audience: 'public',
        isSystemAdmin: false,
      };
    }
  },
);
