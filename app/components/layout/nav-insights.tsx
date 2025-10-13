"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3 } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/app/components/ui/sidebar"

/**
 * NavInsights Component
 * User-facing analytics and insights
 */
export function NavInsights() {
  const pathname = usePathname()
  const isActive = pathname === "/analytics"

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Insights</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip="Personal analytics"
            >
              <Link href="/analytics">
                <BarChart3 />
                <span>Analytics</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
