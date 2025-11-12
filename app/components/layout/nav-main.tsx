"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Video, Search, MessageSquare, Library } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/app/components/ui/sidebar"

/**
 * Core navigation items - always visible
 * Primary actions for the application
 */
const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    description: "Overview and recent activity",
  },
  {
    title: "Library",
    url: "/library",
    icon: Library,
    description: "Browse all content",
  },
  {
    title: "Record",
    url: "/record",
    icon: Video,
    description: "Create new recording",
  },
  {
    title: "Search",
    url: "/search",
    icon: Search,
    description: "Semantic and visual search",
  },
  {
    title: "Assistant",
    url: "/assistant",
    icon: MessageSquare,
    description: "AI-powered chat assistant",
  },
]

/**
 * NavMain Component
 * Core navigation menu with active route highlighting
 * Displays tooltips when sidebar is collapsed
 */
export function NavMain() {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems.map((item) => {
            // Determine active state based on pathname
            const isActive = item.url === '/library'
              ? pathname === '/library' || pathname.startsWith('/library/')
              : pathname === item.url

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.description}
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
