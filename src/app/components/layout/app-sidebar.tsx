"use client"

import * as React from "react"
import Link from "next/link"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarRail,
} from "@/app/components/ui/sidebar"
import { NavMain } from "@/app/components/layout/nav-main"
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
 * - Role-based navigation (system admin section for platform operators only)
 * - Persistent state via cookie
 * - Smooth animations and transitions
 * - Tooltips in collapsed state
 *
 * Props:
 * - role: User role within their organization
 * - isSystemAdmin: Platform-level admin flag (SaaS operator access)
 */
interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  role?: "owner" | "admin" | "contributor" | "reader"
  isSystemAdmin?: boolean
}

export function AppSidebar({ role, isSystemAdmin = false, ...props }: AppSidebarProps) {
  // System admin access is only for platform operators, not org-level admins
  const hasSystemAdminAccess = isSystemAdmin === true

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header: Logo and branding */}
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 rounded-lg p-2 transition-all duration-300 hover:bg-accent/10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
          >
            <div className="relative flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-secondary text-accent-foreground shadow-sm transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(0,223,130,0.4)] group-hover:scale-105">
              <span className="relative text-sm font-bold">T</span>
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold transition-colors duration-300 group-hover:text-accent">
                Tribora
              </span>
              <span className="truncate text-xs text-muted-foreground transition-colors duration-300 group-hover:text-accent/60">
                Knowledge Intelligence
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

        {/* Insights */}
        <NavInsights />

        <SidebarSeparator className="mx-0" />

        {/* Settings */}
        <NavSettings />

        {/* System Admin section (conditional - platform operators only) */}
        {hasSystemAdminAccess && (
          <>
            <SidebarSeparator className="mx-0" />
            <NavAdmin />
          </>
        )}
      </SidebarContent>

      {/* Footer: User menu */}
      <SidebarFooter>
        {/* User menu */}
        <NavUser />
      </SidebarFooter>

      {/* Rail for collapsing/expanding */}
      <SidebarRail />
    </Sidebar>
  )
}
