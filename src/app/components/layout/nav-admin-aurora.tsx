"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as motion from "motion/react-client"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  SecurityCheckIcon,
  Analytics02Icon,
  ZapIcon,
  Alert02Icon,
  Package01Icon,
} from "@hugeicons/core-free-icons"

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
 * NavAdminAurora Component
 * Motion-enhanced admin navigation with aurora effects
 * Only visible to system administrators
 *
 * Features:
 * - Staggered entrance animation
 * - Icon scale on hover
 * - Aurora glow on active state
 */

interface AdminItem {
  title: string
  url: string
  icon: IconSvgElement
  description: string
}

const adminItems: AdminItem[] = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: SecurityCheckIcon,
    description: "System overview",
  },
  {
    title: "Metrics",
    url: "/admin/metrics",
    icon: Analytics02Icon,
    description: "Real-time metrics",
  },
  {
    title: "Jobs",
    url: "/admin/jobs",
    icon: ZapIcon,
    description: "Job queue status",
  },
  {
    title: "Alerts",
    url: "/admin/alerts",
    icon: Alert02Icon,
    description: "System alerts",
  },
  {
    title: "Quotas",
    url: "/admin/quotas",
    icon: Package01Icon,
    description: "Quota management",
  },
]

// Motion variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.3,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
    },
  },
}

const labelVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
      delay: 0.25,
    },
  },
}

export function NavAdminAurora() {
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const MotionDiv = mounted ? motion.div : "div"

  return (
    <SidebarGroup>
      <MotionDiv
        {...(mounted ? {
          initial: "hidden",
          animate: "visible",
          variants: labelVariants,
        } : {})}
      >
        <SidebarGroupLabel>Admin</SidebarGroupLabel>
      </MotionDiv>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuSub>
            <MotionDiv
              {...(mounted ? {
                variants: containerVariants,
                initial: "hidden",
                animate: "visible",
              } : {})}
              className="space-y-0.5"
            >
              {adminItems.map((item, index) => {
                const isActive = pathname === item.url

                return (
                  <MotionDiv
                    key={item.title}
                    {...(mounted ? {
                      variants: itemVariants,
                      custom: index,
                    } : {})}
                  >
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isActive}
                      >
                        <Link href={item.url} className="group/nav-item">
                          <span className="inline-flex transition-transform duration-200 group-hover/nav-item:scale-110">
                            <HugeiconsIcon icon={item.icon} className="size-4" />
                          </span>
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </MotionDiv>
                )
              })}
            </MotionDiv>
          </SidebarMenuSub>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
