"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as motion from "motion/react-client"
import { HugeiconsIcon } from "@hugeicons/react"
import { Analytics01Icon } from "@hugeicons/core-free-icons"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/app/components/ui/sidebar"

/**
 * NavInsightsAurora Component
 * Motion-enhanced insights navigation with aurora effects
 *
 * Features:
 * - Staggered entrance animation
 * - Icon scale on hover
 * - Aurora glow on active state
 */

// Motion variants for entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.2,
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
      delay: 0.15,
    },
  },
}

export function NavInsightsAurora() {
  const pathname = usePathname()
  const isActive = pathname === "/analytics"
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
        <SidebarGroupLabel>Insights</SidebarGroupLabel>
      </MotionDiv>
      <SidebarGroupContent>
        <SidebarMenu>
          <MotionDiv
            {...(mounted ? {
              variants: containerVariants,
              initial: "hidden",
              animate: "visible",
            } : {})}
            className="space-y-1"
          >
            <MotionDiv {...(mounted ? { variants: itemVariants } : {})}>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip="Personal analytics"
                >
                  <Link href="/analytics" className="group/nav-item">
                    <span className="inline-flex transition-transform duration-200 group-hover/nav-item:scale-110">
                      <HugeiconsIcon icon={Analytics01Icon} className="size-4" />
                    </span>
                    <span>Analytics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </MotionDiv>
          </MotionDiv>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
