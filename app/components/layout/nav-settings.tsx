"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Building2, CreditCard } from "lucide-react"

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
 * Settings navigation items
 * User and organization configuration
 */
const settingsItems = [
  {
    title: "Profile",
    url: "/settings/profile",
    icon: User,
    description: "Personal settings",
  },
  {
    title: "Organization",
    url: "/settings/organization",
    icon: Building2,
    description: "Org settings",
  },
  {
    title: "Billing & Quotas",
    url: "/settings/billing",
    icon: CreditCard,
    description: "Subscription and usage",
  },
]

/**
 * NavSettings Component
 * User and organization settings navigation
 */
export function NavSettings() {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Settings</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuSub>
            {settingsItems.map((item) => {
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
