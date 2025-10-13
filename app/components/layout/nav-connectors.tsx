"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Plug, FolderOpen, FileText, Upload } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/app/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/app/components/ui/collapsible"

/**
 * Connector integration items (Phase 5)
 * Connects external data sources to the platform
 */
const connectorItems = [
  {
    title: "Overview",
    url: "/connectors",
    icon: Plug,
    description: "Manage connected sources",
  },
  {
    title: "Google Drive",
    url: "/connectors/google-drive",
    icon: FolderOpen,
    description: "Sync from Google Drive",
  },
  {
    title: "Notion",
    url: "/connectors/notion",
    icon: FileText,
    description: "Import from Notion",
  },
  {
    title: "File Upload",
    url: "/connectors/upload",
    icon: Upload,
    description: "Bulk file upload",
  },
]

/**
 * NavConnectors Component
 * Collapsible navigation group for external data source integrations
 * Remembers expanded/collapsed state
 */
export function NavConnectors() {
  const pathname = usePathname()
  const isConnectorActive = pathname.startsWith("/connectors")
  const [isOpen, setIsOpen] = React.useState(isConnectorActive)

  // Auto-expand when navigating to connector route
  React.useEffect(() => {
    if (isConnectorActive) {
      setIsOpen(true)
    }
  }, [isConnectorActive])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="group/collapsible w-full">
            <span>Connectors</span>
            <ChevronDown className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuSub>
                {connectorItems.map((item) => {
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
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
