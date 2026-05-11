'use client';

import * as React from 'react';
import Link from 'next/link';
import * as motion from 'motion/react-client';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarRail,
} from '@/app/components/ui/sidebar';
import { NavMainAurora } from '@/app/components/layout/nav-main-aurora';
import { NavInsightsAurora } from '@/app/components/layout/nav-insights-aurora';
import { NavIntelligenceAurora } from '@/app/components/layout/nav-intelligence-aurora';
import { NavSettingsAurora } from '@/app/components/layout/nav-settings-aurora';
import { NavAdminAurora } from '@/app/components/layout/nav-admin-aurora';
import { NavVendorAurora } from '@/app/components/layout/nav-vendor-aurora';
import { NavUserAurora } from '@/app/components/layout/nav-user-aurora';

/**
 * AuroraSidebar Component
 * Dashboard sidebar shell for the Tribora app workspace.
 *
 * Features:
 * - Collapsible/expandable with keyboard shortcut (Cmd/Ctrl + B)
 * - Mobile responsive (drawer on mobile, fixed on desktop)
 * - Role-based navigation (system admin section for platform operators only)
 * - Persistent state via cookie
 * - Smooth, restrained transitions
 * - Tooltips in collapsed state
 * - Specimen-style brand lockup
 *
 * Props:
 * - role: User role within their organization
 * - isSystemAdmin: Platform-level admin flag (SaaS operator access)
 */
interface AuroraSidebarProps extends React.ComponentProps<typeof Sidebar> {
  role?: 'owner' | 'admin' | 'contributor' | 'reader';
  isSystemAdmin?: boolean;
  hasOnboardingPlan?: boolean;
  hasDigestEnabled?: boolean;
  /** TRIB-34: pending wiki-contradiction count for the admin nav badge. */
  wikiReviewCount?: number;
}

// Motion variants for logo entrance
const logoVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
      delay: 0.05,
    },
  },
};

export function AuroraSidebar({
  role,
  isSystemAdmin = false,
  hasOnboardingPlan = false,
  hasDigestEnabled = false,
  wikiReviewCount = 0,
  ...props
}: AuroraSidebarProps) {
  // System admin access is only for platform operators, not org-level admins
  const hasSystemAdminAccess = isSystemAdmin === true;
  const MotionDiv = motion.div;

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header: Logo and branding with motion */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 rounded-lg p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
          >
            <MotionDiv
              variants={logoVariants}
              initial="hidden"
              animate="visible"
              className="relative flex size-8 items-center justify-center rounded-sm border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
            >
              <span className="relative text-[11px] font-semibold tracking-[0.06em]">
                TR
              </span>
            </MotionDiv>
            <MotionDiv
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                delay: 0.1,
              }}
              className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
            >
              <span className="trbd-brand-lockup truncate font-semibold">
                Tribora
              </span>
              <span className="trbd-mono truncate">Dashboard System</span>
            </MotionDiv>
          </Link>
        </div>
      </SidebarHeader>

      {/* Main content: Navigation groups */}
      <SidebarContent>
        {/* Core navigation */}
        <NavMainAurora hasOnboardingPlan={hasOnboardingPlan} />

        <SidebarSeparator className="mx-0" />

        {/* Insights */}
        <NavInsightsAurora hasDigestEnabled={hasDigestEnabled} />

        <SidebarSeparator className="mx-0" />

        {/* Intelligence */}
        <NavIntelligenceAurora />

        <SidebarSeparator className="mx-0" />

        {/* Settings */}
        <NavSettingsAurora />

        {/* Vendor Admin section (conditional - org owners/admins) */}
        {(role === 'owner' || role === 'admin') && (
          <>
            <SidebarSeparator className="mx-0" />
            <NavVendorAurora />
          </>
        )}

        {/* System Admin section (conditional - platform operators only) */}
        {hasSystemAdminAccess && (
          <>
            <SidebarSeparator className="mx-0" />
            <NavAdminAurora reviewQueueCount={wikiReviewCount} />
          </>
        )}
      </SidebarContent>

      {/* Footer: User menu */}
      <SidebarFooter>
        <NavUserAurora />
      </SidebarFooter>

      {/* Rail for collapsing/expanding */}
      <SidebarRail />
    </Sidebar>
  );
}
