import type { Audience } from './types';

/**
 * Discriminated union returned by `resolveAccess`.
 * The caller translates this to Next.js `redirect()` / `notFound()` / render.
 */
export type AccessDecision =
  | { kind: 'render' }
  | { kind: 'redirect'; to: string }
  | { kind: 'notFound' };

/**
 * Pure access-policy function — no Next.js imports, fully unit-testable.
 *
 * Encodes the §4 visibility matrix from the TRIB-147 implementation plan:
 *
 * | caller       | required      | decision                     |
 * |--------------|---------------|------------------------------|
 * | system-admin | any           | render                       |
 * | org-admin    | public        | render                       |
 * | org-admin    | org-admin     | render                       |
 * | org-admin    | system-admin  | notFound (never acknowledge) |
 * | public       | public        | render                       |
 * | public       | org-admin     | redirect /login?next=/docs/… |
 * | public       | system-admin  | notFound (never acknowledge) |
 *
 * @param caller    Audience of the current request (from resolveDocsAudience).
 * @param required  Audience required by the page or section.
 * @param slug      URL slug after `/docs/` — used to build the ?next= redirect.
 *                  Pass an empty string for the /docs root.
 */
export function resolveAccess(
  caller: Audience,
  required: Audience,
  slug: string,
): AccessDecision {
  const LEVEL: Record<Audience, number> = {
    public: 0,
    'org-admin': 1,
    'system-admin': 2,
  };

  const callerLevel = LEVEL[caller];
  const requiredLevel = LEVEL[required];

  // Caller has sufficient privilege — render.
  if (callerLevel >= requiredLevel) {
    return { kind: 'render' };
  }

  // org-admin requesting system-admin page → notFound (must not acknowledge).
  if (requiredLevel === LEVEL['system-admin']) {
    return { kind: 'notFound' };
  }

  // public requesting org-admin page → redirect to login with ?next= param.
  const cleanSlug = slug.trim();
  const next = cleanSlug.length > 0 ? `/docs/${cleanSlug}` : '/docs';
  return { kind: 'redirect', to: `/login?next=${encodeURIComponent(next)}` };
}
