"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as motion from "motion/react-client"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Home01Icon,
  Layers01Icon,
  PlayCircleIcon,
  AiSearchIcon,
  AiBrain01Icon,
  MessageMultiple01Icon,
} from "@hugeicons/core-free-icons"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/app/components/ui/sidebar"

/**
 * NavMainAurora Component
 * Motion-enhanced main navigation with staggered entrance animations
 * and aurora glow effects on hover/active states
 *
 * Features:
 * - Staggered entrance animation (50ms between items)
 * - Icon scale on hover
 * - Glow effects on active/hover states
 * - Spring physics for smooth transitions
 */

interface NavItem {
  title: string
  url: string
  icon: IconSvgElement
  description: string
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home01Icon,
    description: "Overview and recent activity",
  },
  {
    title: "Library",
    url: "/library",
    icon: Layers01Icon,
    description: "Browse all content",
  },
  {
    title: "Record",
    url: "/record",
    icon: PlayCircleIcon,
    description: "Create new recording",
  },
  {
    title: "Search",
    url: "/search",
    icon: AiSearchIcon,
    description: "Semantic and visual search",
  },
  {
    title: "Knowledge",
    url: "/knowledge",
    icon: AiBrain01Icon,
    description: "Explore your knowledge graph",
  },
  {
    title: "Assistant",
    url: "/assistant",
    icon: MessageMultiple01Icon,
    description: "AI-powered chat assistant",
  },
]

// Motion variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
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

export function NavMainAurora() {
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Use motion only after mount
  const MotionDiv = mounted ? motion.div : "div"

  return (
    <SidebarGroup>
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
            {navItems.map((item, index) => {
              // Determine active state based on pathname
              const isActive = item.url === '/library'
                ? pathname === '/library' || pathname.startsWith('/library/')
                : pathname === item.url

              return (
                <MotionDiv
                  key={item.title}
                  {...(mounted ? {
                    variants: itemVariants,
                    custom: index,
                  } : {})}
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.description}
                    >
                      <Link href={item.url} className="group/nav-item">
                        <span className="inline-flex transition-transform duration-200 group-hover/nav-item:scale-110">
                          <HugeiconsIcon icon={item.icon} className="size-4" />
                        </span>
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </MotionDiv>
              )
            })}
          </MotionDiv>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
