"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb"

/**
 * Route segment labels for breadcrumb display
 * Maps URL segments to human-readable labels
 */
const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  record: "Record",
  recordings: "Recordings",
  search: "Search",
  assistant: "Assistant",
  connectors: "Connectors",
  "google-drive": "Google Drive",
  notion: "Notion",
  upload: "Upload",
  analytics: "Analytics",
  settings: "Settings",
  profile: "Profile",
  organization: "Organization",
  billing: "Billing",
  admin: "Admin",
  metrics: "Metrics",
  jobs: "Jobs",
  alerts: "Alerts",
  quotas: "Quotas",
}

/**
 * Breadcrumbs Component
 * Dynamic breadcrumb navigation based on current pathname
 * Automatically generates breadcrumbs from URL segments
 *
 * Features:
 * - Dynamic route parsing
 * - Clickable path segments
 * - Current page highlighted
 * - Responsive design
 */
export function Breadcrumbs() {
  const pathname = usePathname()

  // Parse pathname into segments
  const segments = React.useMemo(() => {
    return pathname
      .split("/")
      .filter(Boolean)
      .filter((segment) => {
        // Filter out dynamic route IDs (UUIDs)
        return !segment.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      })
  }, [pathname])

  // Don't render breadcrumbs on home page
  if (segments.length === 0) {
    return null
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Home link */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/dashboard">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {/* Dynamic segments */}
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`
          const label = routeLabels[segment] || segment
          const isLast = index === segments.length - 1

          return (
            <React.Fragment key={segment}>
              <BreadcrumbSeparator>
                <ChevronRight />
              </BreadcrumbSeparator>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
