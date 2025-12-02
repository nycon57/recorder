"use client"

import * as React from "react"
import Link from "next/link"
import { useUser, useClerk } from "@clerk/nextjs"
import * as motion from "motion/react-client"
import { ChevronsUpDown, Settings, LogOut, User as UserIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/app/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/app/components/ui/avatar"

/**
 * NavUserAurora Component
 * Motion-enhanced user dropdown with glass-morphism effects
 *
 * Features:
 * - Glass effect dropdown menu
 * - Avatar glow on hover
 * - Staggered menu item animations
 * - Aurora accent colors
 */

// Motion variants for dropdown items
const menuItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
}

// Motion variants for entrance animation
const containerVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 30,
      delay: 0.35,
    },
  },
}

export function NavUserAurora() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch by only rendering motion after mount
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Wait for Clerk to load and user to be available
  if (!isLoaded || !user) {
    return null
  }

  // Get user display information
  const userName = user.fullName || user.username || "User"
  const userEmail = user.primaryEmailAddress?.emailAddress || ""
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const handleSignOut = async () => {
    await signOut()
    window.location.href = "/"
  }

  // Wrapper component - use motion only after mount to prevent hydration mismatch
  const Wrapper = mounted ? motion.div : "div"
  const wrapperProps = mounted ? {
    initial: "hidden",
    animate: "visible",
    variants: containerVariants,
  } : {}

  return (
    <Wrapper {...wrapperProps}>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className={cn(
                  "transition-all duration-300",
                  "data-[state=open]:bg-accent/15 data-[state=open]:text-accent",
                  "data-[state=open]:shadow-[0_0_15px_rgba(0,223,130,0.15)]"
                )}
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <Avatar className={cn(
                    "size-8 rounded-lg",
                    "transition-shadow duration-300",
                    "hover:shadow-[0_0_15px_rgba(0,223,130,0.25)]"
                  )}>
                    <AvatarImage
                      src={user.imageUrl}
                      alt={userName}
                    />
                    <AvatarFallback className="rounded-lg bg-accent/20 text-accent">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{userName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {userEmail}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/60" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className={cn(
                "w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg",
                "bg-popover/95 backdrop-blur-xl",
                "border-accent/20",
                "shadow-[0_0_30px_rgba(0,223,130,0.1)]"
              )}
              side="bottom"
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarImage
                      src={user.imageUrl}
                      alt={userName}
                    />
                    <AvatarFallback className="rounded-lg bg-accent/20 text-accent">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-accent/10" />
              <motion.div
                custom={0}
                initial="hidden"
                animate="visible"
                variants={menuItemVariants}
              >
                <DropdownMenuItem asChild className={cn(
                  "cursor-pointer",
                  "transition-all duration-200",
                  "hover:bg-accent/10 hover:text-accent",
                  "focus:bg-accent/10 focus:text-accent"
                )}>
                  <Link href="/settings/profile">
                    <UserIcon className="mr-2 size-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
              </motion.div>
              <motion.div
                custom={1}
                initial="hidden"
                animate="visible"
                variants={menuItemVariants}
              >
                <DropdownMenuItem asChild className={cn(
                  "cursor-pointer",
                  "transition-all duration-200",
                  "hover:bg-accent/10 hover:text-accent",
                  "focus:bg-accent/10 focus:text-accent"
                )}>
                  <Link href="/settings">
                    <Settings className="mr-2 size-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
              </motion.div>
              <DropdownMenuSeparator className="bg-accent/10" />
              <motion.div
                custom={2}
                initial="hidden"
                animate="visible"
                variants={menuItemVariants}
              >
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className={cn(
                    "cursor-pointer",
                    "transition-all duration-200",
                    "hover:bg-destructive/10 hover:text-destructive",
                    "focus:bg-destructive/10 focus:text-destructive"
                  )}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </motion.div>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </Wrapper>
  )
}
