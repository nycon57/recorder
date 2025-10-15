"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Building2,
  Users,
  Briefcase,
  Shield,
  Plug,
  CreditCard,
  BarChart3,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils/cn";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requiredRole?: "owner" | "admin";
}

const navItems: NavItem[] = [
  {
    title: "General",
    href: "/settings/organization/general",
    icon: Building2,
    description: "Profile and branding",
  },
  {
    title: "Members",
    href: "/settings/organization/members",
    icon: Users,
    description: "Manage team members",
    requiredRole: "admin",
  },
  {
    title: "Departments",
    href: "/settings/organization/departments",
    icon: Briefcase,
    description: "Organize teams",
    requiredRole: "admin",
  },
  {
    title: "Security",
    href: "/settings/organization/security",
    icon: Shield,
    description: "Security settings",
    requiredRole: "admin",
  },
  {
    title: "Integrations",
    href: "/settings/organization/integrations",
    icon: Plug,
    description: "Connected services",
    requiredRole: "admin",
  },
  {
    title: "Billing",
    href: "/settings/billing",
    icon: CreditCard,
    description: "Subscription",
    requiredRole: "admin",
  },
  {
    title: "Stats",
    href: "/settings/organization/stats",
    icon: BarChart3,
    description: "Usage analytics",
  },
];

export default function OrganizationSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { userId } = useAuth();

  // Fetch user role to determine access
  const { data: userRole, isLoading } = useQuery({
    queryKey: ["user-role", userId],
    queryFn: async () => {
      const response = await fetch("/api/profile");
      if (!response.ok) throw new Error("Failed to fetch user role");
      const data = await response.json();
      return data.data?.role;
    },
    enabled: !!userId,
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-2 text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  // Check if user has admin access
  const hasAdminAccess = userRole === "owner" || userRole === "admin";

  if (!hasAdminAccess) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Access Restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You need admin privileges to access organization settings.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Organization Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization, team, and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href === "/settings/organization/general" && pathname === "/settings/organization");

              // Filter out items based on role
              if (item.requiredRole && !hasAdminAccess) {
                return null;
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 mt-0.5 flex-shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground/70"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-0.5 leading-tight">
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
