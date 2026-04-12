"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as motion from "motion/react-client"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import { Package01Icon, Analytics02Icon } from "@hugeicons/core-free-icons"

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
 * NavVendorAurora Component — TRIB-53
 *
 * Motion-enhanced vendor admin navigation.
 * Visible to org owners/admins for managing white-label configuration.
 */

interface VendorItem {
  title: string
  url: string
  icon: IconSvgElement
  description: string
}

const vendorItems: VendorItem[] = [
  {
    title: "Vendor Admin",
    url: "/vendor-admin",
    icon: Package01Icon,
    description: "White-label config",
  },
  {
    title: "Analytics",
    url: "/vendor-admin/analytics",
    icon: Analytics02Icon,
    description: "Usage analytics",
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

export function NavVendorAurora() {
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
        <SidebarGroupLabel>Vendor</SidebarGroupLabel>
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
              {vendorItems.map((item, index) => {
                const isActive = pathname.startsWith(item.url)

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
