"use client"

import * as React from "react"
import Link from "next/link"
import * as motion from "motion/react-client"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarRail,
} from "@/app/components/ui/sidebar"
import { NavMainAurora } from "@/app/components/layout/nav-main-aurora"
import { NavInsightsAurora } from "@/app/components/layout/nav-insights-aurora"
import { NavSettingsAurora } from "@/app/components/layout/nav-settings-aurora"
import { NavAdminAurora } from "@/app/components/layout/nav-admin-aurora"
import { NavUserAurora } from "@/app/components/layout/nav-user-aurora"

/**
 * AuroraSidebar Component
 * Premium sidebar with glass-morphism, motion animations, and aurora glow effects
 *
 * Features:
 * - Collapsible/expandable with keyboard shortcut (Cmd/Ctrl + B)
 * - Mobile responsive (drawer on mobile, fixed on desktop)
 * - Role-based navigation (system admin section for platform operators only)
 * - Persistent state via cookie
 * - Smooth animations and transitions
 * - Tooltips in collapsed state
 * - Glass-morphism background
 * - Aurora glow effects throughout
 * - Staggered entrance animations for nav items
 *
 * Props:
 * - role: User role within their organization
 * - isSystemAdmin: Platform-level admin flag (SaaS operator access)
 */
interface AuroraSidebarProps extends React.ComponentProps<typeof Sidebar> {
  role?: "owner" | "admin" | "contributor" | "reader"
  isSystemAdmin?: boolean
}

// Motion variants for logo entrance
const logoVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
      delay: 0.05,
    },
  },
}

export function AuroraSidebar({ role, isSystemAdmin = false, ...props }: AuroraSidebarProps) {
  // System admin access is only for platform operators, not org-level admins
  const hasSystemAdminAccess = isSystemAdmin === true
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const MotionDiv = mounted ? motion.div : "div"

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
              {...(mounted ? {
                variants: logoVariants,
                initial: "hidden",
                animate: "visible",
              } : {})}
              className="relative flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-secondary text-accent-foreground shadow-sm"
            >
              <span className="relative text-sm font-bold">T</span>
            </MotionDiv>
            <MotionDiv
              {...(mounted ? {
                initial: { opacity: 0, x: -8 },
                animate: { opacity: 1, x: 0 },
                transition: {
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                  delay: 0.1,
                },
              } : {})}
              className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden"
            >
              <span className="truncate font-semibold">
                Tribora
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Knowledge Intelligence
              </span>
            </MotionDiv>
          </Link>
        </div>
      </SidebarHeader>

      {/* Main content: Navigation groups with aurora styling */}
      <SidebarContent>
        {/* Core navigation */}
        <NavMainAurora />

        <SidebarSeparator className="mx-0" />

        {/* Insights */}
        <NavInsightsAurora />

        <SidebarSeparator className="mx-0" />

        {/* Settings */}
        <NavSettingsAurora />

        {/* System Admin section (conditional - platform operators only) */}
        {hasSystemAdminAccess && (
          <>
            <SidebarSeparator className="mx-0" />
            <NavAdminAurora />
          </>
        )}
      </SidebarContent>

      {/* Footer: User menu with glass effect */}
      <SidebarFooter>
        <NavUserAurora />
      </SidebarFooter>

      {/* Rail for collapsing/expanding */}
      <SidebarRail />
    </Sidebar>
  )
}
