"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, Activity, Zap, AlertTriangle, Package } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/app/components/ui/sidebar"

/**
 * Admin navigation items (Phase 6)
 * Only visible to owners and admins
 */
const adminItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: Shield,
    description: "System overview",
  },
  {
    title: "Metrics",
    url: "/admin/metrics",
    icon: Activity,
    description: "Real-time metrics",
  },
  {
    title: "Jobs",
    url: "/admin/jobs",
    icon: Zap,
    description: "Job queue status",
  },
  {
    title: "Alerts",
    url: "/admin/alerts",
    icon: AlertTriangle,
    description: "System alerts",
  },
  {
    title: "Quotas",
    url: "/admin/quotas",
    icon: Package,
    description: "Quota management",
  },
]

/**
 * NavAdmin Component
 * Administrative navigation - only shown to users with owner/admin role
 * Uses role-based rendering from parent component
 */
export function NavAdmin() {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Admin</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuSub>
            {adminItems.map((item) => {
              const isActive = pathname === item.url

              return (
                <SidebarMenuSubItem key={item.title}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
