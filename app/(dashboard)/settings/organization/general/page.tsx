"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2, X, Users, HardDrive, Activity, Badge as BadgeIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form";

// Schema based on updateOrganizationSchema
const generalSettingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  logo_url: z.string().url("Invalid URL").nullable().optional(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g., #3b82f6)")
    .optional(),
  billing_email: z
    .string()
    .email("Invalid email address")
    .nullable()
    .optional(),
  domain: z
    .string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Must be a valid domain")
    .nullable()
    .optional()
    .or(z.literal("")),
  settings: z
    .object({
      description: z.string().max(500).optional(),
    })
    .optional(),
});

type GeneralSettingsFormData = z.infer<typeof generalSettingsSchema>;

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  billing_email: string | null;
  domain: string | null;
  plan: string;
  max_users: number;
  max_storage_gb: number;
  features: Record<string, boolean> | null;
  settings: {
    description?: string;
  } | null;
}

export default function GeneralSettingsPage() {
  const queryClient = useQueryClient();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Fetch organization data
  const { data: organizationResponse, isLoading } = useQuery({
    queryKey: ["organization", "current"],
    queryFn: async () => {
      const response = await fetch("/api/organizations/current");
      if (!response.ok) {
        throw new Error("Failed to fetch organization");
      }
      const data = await response.json();
      return data.data;
    },
  });

  const organization = organizationResponse as Organization | undefined;

  // Fetch organization stats
  const { data: stats } = useQuery({
    queryKey: ["organization-stats"],
    queryFn: async () => {
      const response = await fetch("/api/organizations/stats");
      if (!response.ok) return null;
      const data = await response.json();
      return data.data;
    },
    enabled: !!organization,
  });

  // Update organization mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<GeneralSettingsFormData>) => {
      const response = await fetch("/api/organizations/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update organization");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization", "current"] });
      toast.success("Settings updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  // Initialize form with organization data
  const form = useForm<GeneralSettingsFormData>({
    resolver: zodResolver(generalSettingsSchema),
    values: organization
      ? {
          name: organization.name,
          logo_url: organization.logo_url,
          primary_color: organization.primary_color || "#3b82f6",
          billing_email: organization.billing_email,
          domain: organization.domain || "",
          settings: {
            description: organization.settings?.description || "",
          },
        }
      : undefined,
  });

  const onSubmit = (data: GeneralSettingsFormData) => {
    // Transform empty strings to null
    const payload = {
      ...data,
      domain: data.domain === "" ? null : data.domain,
      billing_email: data.billing_email || null,
    };
    updateMutation.mutate(payload);
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setIsUploadingLogo(true);

    try {
      // Create form data
      const formData = new FormData();
      formData.append("file", file);

      // Upload to storage
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload logo");
      }

      const { url } = await response.json();

      // Update form and preview
      form.setValue("logo_url", url);
      setLogoPreview(url);
      toast.success("Logo uploaded successfully");

      // Auto-save
      updateMutation.mutate({ logo_url: url });
    } catch (error) {
      toast.error("Failed to upload logo");
      console.error(error);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    form.setValue("logo_url", null);
    setLogoPreview(null);
    updateMutation.mutate({ logo_url: null });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentLogo = logoPreview || organization?.logo_url;
  const isPlanEnterprise = organization?.plan === "enterprise";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">General Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage your organization's basic information
        </p>
      </div>

      {/* Organization Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.members.total}</div>
              {stats.members.quota && (
                <>
                  <p className="text-xs text-muted-foreground">
                    of {stats.members.quota} allowed
                  </p>
                  <Progress
                    value={stats.members.percentage || 0}
                    className="mt-2 h-1"
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.storage.used_gb} GB</div>
              {stats.storage.quota_gb && (
                <>
                  <p className="text-xs text-muted-foreground">
                    of {stats.storage.quota_gb} GB
                  </p>
                  <Progress
                    value={stats.storage.percentage || 0}
                    className="mt-2 h-1"
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activity.active_sessions_24h}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Plan</CardTitle>
              <BadgeIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{organization?.plan || "Free"}</div>
              <Link href="/settings/organization/stats">
                <p className="text-xs text-blue-600 hover:underline">View detailed stats →</p>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Organization Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Organization Name</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Inc." {...field} />
                </FormControl>
                <FormDescription>
                  The name of your organization as it appears throughout the app
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Organization Logo</Label>
            <div className="flex items-center gap-4">
              {currentLogo && (
                <div className="relative w-20 h-20 rounded-lg border overflow-hidden bg-muted">
                  <Image
                    src={currentLogo}
                    alt="Organization logo"
                    fill
                    className="object-contain p-2"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div>
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={isUploadingLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("logo-upload")?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Logo
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPG or SVG. Max 2MB.
                </p>
              </div>
            </div>
          </div>

          {/* Primary Color */}
          <FormField
            control={form.control}
            name="primary_color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primary Color</FormLabel>
                <div className="flex items-center gap-3">
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        {...field}
                        value={field.value || "#3b82f6"}
                        className="w-12 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        {...field}
                        value={field.value || "#3b82f6"}
                        placeholder="#3b82f6"
                        className="w-32"
                      />
                    </div>
                  </FormControl>
                </div>
                <FormDescription>
                  The primary brand color used throughout the app
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Billing Email */}
          <FormField
            control={form.control}
            name="billing_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="billing@acme.com"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  Email address for billing notifications and invoices
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="settings.description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us about your organization..."
                    className="min-h-24"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  A brief description of your organization (optional)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Custom Domain - Enterprise Only */}
          <FormField
            control={form.control}
            name="domain"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Custom Domain
                  {!isPlanEnterprise && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (Enterprise feature)
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="app.yourdomain.com"
                    {...field}
                    value={field.value || ""}
                    disabled={!isPlanEnterprise}
                  />
                </FormControl>
                <FormDescription>
                  {isPlanEnterprise
                    ? "Custom domain for your organization's app"
                    : "Upgrade to Enterprise to use a custom domain"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Save Button */}
          <div className="flex items-center gap-3 pt-4">
            <Button
              type="submit"
              disabled={updateMutation.isPending || !form.formState.isDirty}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            {form.formState.isDirty && (
              <p className="text-sm text-muted-foreground">
                You have unsaved changes
              </p>
            )}
          </div>
        </form>
      </Form>

      {/* Features Display (Read-only) */}
      {organization?.features && (
        <Card>
          <CardHeader>
            <CardTitle>Enabled Features</CardTitle>
            <CardDescription>
              Features available in your {organization.plan} plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(organization.features)
                .filter(([_, enabled]) => enabled)
                .map(([feature]) => (
                  <div key={feature} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm">
                      {feature
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                ))}
            </div>
            {Object.values(organization.features).every((v) => !v) && (
              <p className="text-sm text-muted-foreground">
                No additional features enabled. Consider upgrading your plan.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
