"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Newspaper } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/app/components/ui/sidebar"

export function NavInsights({ hasDigestEnabled = false }: { hasDigestEnabled?: boolean }) {
  const pathname = usePathname()
  const isAnalyticsActive = pathname === "/analytics"
  const isDigestActive = pathname === "/digest"

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Insights</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isAnalyticsActive}
              tooltip="Personal analytics"
            >
              <Link href="/analytics">
                <BarChart3 />
                <span>Analytics</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {hasDigestEnabled && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isDigestActive}
                tooltip="Weekly knowledge digest"
              >
                <Link href="/digest">
                  <Newspaper />
                  <span>Weekly Digest</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
