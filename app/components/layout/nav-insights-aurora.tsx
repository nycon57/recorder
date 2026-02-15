"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as motion from "motion/react-client"
import { Newspaper } from "lucide-react"
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

export function NavInsightsAurora({ hasDigestEnabled = false }: { hasDigestEnabled?: boolean }) {
  const pathname = usePathname()
  const isAnalyticsActive = pathname === "/analytics"
  const isDigestActive = pathname === "/digest"
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
                  isActive={isAnalyticsActive}
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
            {hasDigestEnabled && (
              <MotionDiv {...(mounted ? { variants: itemVariants } : {})}>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isDigestActive}
                    tooltip="Weekly knowledge digest"
                  >
                    <Link href="/digest" className="group/nav-item">
                      <span className="inline-flex transition-transform duration-200 group-hover/nav-item:scale-110">
                        <Newspaper className="size-4" />
                      </span>
                      <span>Weekly Digest</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </MotionDiv>
            )}
          </MotionDiv>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
