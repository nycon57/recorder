"use client"

import * as React from "react"
import Link from "next/link"
import { OrganizationSwitcher } from "@clerk/nextjs"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarRail,
} from "@/app/components/ui/sidebar"
import { NavMain } from "@/app/components/layout/nav-main"
import { NavConnectors } from "@/app/components/layout/nav-connectors"
import { NavInsights } from "@/app/components/layout/nav-insights"
import { NavSettings } from "@/app/components/layout/nav-settings"
import { NavAdmin } from "@/app/components/layout/nav-admin"
import { NavUser } from "@/app/components/layout/nav-user"

/**
 * AppSidebar Component
 * Main sidebar navigation container for the dashboard
 *
 * Features:
 * - Collapsible/expandable with keyboard shortcut (Cmd/Ctrl + B)
 * - Mobile responsive (drawer on mobile, fixed on desktop)
 * - Role-based navigation (admin section for owners/admins only)
 * - Persistent state via cookie
 * - Smooth animations and transitions
 * - Tooltips in collapsed state
 *
 * Props:
 * - role: User role for conditional admin navigation
 */
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  role?: "owner" | "admin" | "contributor" | "reader"
}

export function AppSidebar({ role, ...props }: AppSidebarProps) {
  // Determine if user has admin access
  const hasAdminAccess = role === "owner" || role === "admin"

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header: Logo and branding */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-xl">🎥</span>
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold">Record</span>
              <span className="truncate text-xs text-muted-foreground">
                AI Knowledge
              </span>
            </div>
          </Link>
        </div>
      </SidebarHeader>

      {/* Main content: Navigation groups */}
      <SidebarContent>
        {/* Core navigation */}
        <NavMain />

        <SidebarSeparator className="mx-0" />

        {/* Connectors (Phase 5) */}
        <NavConnectors />

        <SidebarSeparator className="mx-0" />

        {/* Insights */}
        <NavInsights />

        <SidebarSeparator className="mx-0" />

        {/* Settings */}
        <NavSettings />

        {/* Admin section (conditional) */}
        {hasAdminAccess && (
          <>
            <SidebarSeparator className="mx-0" />
            <NavAdmin />
          </>
        )}
      </SidebarContent>

      {/* Footer: User menu and org switcher */}
      <SidebarFooter>
        {/* Organization switcher (if enabled) */}
        {process.env.NEXT_PUBLIC_CLERK_ORGANIZATIONS_ENABLED === "true" && (
          <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
            <OrganizationSwitcher
              appearance={{
                elements: {
                  rootBox: "w-full",
                  organizationSwitcherTrigger:
                    "w-full justify-start px-2 py-1.5 rounded-md hover:bg-sidebar-accent",
                },
              }}
            />
          </div>
        )}

        {/* User menu */}
        <NavUser />
      </SidebarFooter>

      {/* Rail for collapsing/expanding */}
      <SidebarRail />
    </Sidebar>
  )
}
