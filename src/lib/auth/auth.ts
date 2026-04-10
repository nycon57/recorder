import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, magicLink, organization } from "better-auth/plugins";
import { Pool } from "pg";
import { supabaseAdmin } from "@/lib/supabase/admin";

const pool = new Pool({
  connectionString: process.env.DIRECT_DATABASE_URL,
});

export const auth = betterAuth({
  appName: "Tribora",
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  database: pool,
  plugins: [
    nextCookies(),
    admin({
      defaultRole: "reader",
      adminRoles: ["admin", "owner"],
      schema: {
        user: {
          fields: {
            banned: "banned",
            banReason: "ban_reason",
            banExpires: "ban_expires",
            role: "role",
          },
        },
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Wire to Resend in Phase 5
        console.log(`Magic link for ${email}: ${url}`);
      },
    }),
    organization({
      creatorRole: "owner",
      schema: {
        organization: {
          modelName: "organizations",
          fields: {
            logo: "logo_url",
            metadata: "metadata",
            createdAt: "created_at",
          },
        },
      },
    }),
  ],
  user: {
    modelName: "users",
    fields: {
      image: "avatar_url",
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      phone: { type: "string", required: false },
      title: { type: "string", required: false },
      timezone: { type: "string", required: false, defaultValue: "UTC" },
      bio: { type: "string", required: false },
      org_id: { type: "string", required: false, input: false },
      status: { type: "string", required: false, defaultValue: "active", input: false },
      department_id: { type: "string", required: false, input: false },
      is_system_admin: { type: "boolean", required: false, input: false },
      last_login_at: { type: "string", required: false, input: false },
      last_active_at: { type: "string", required: false, input: false },
      login_count: { type: "number", required: false, input: false },
      notification_preferences: { type: "string", required: false, input: false },
      ui_preferences: { type: "string", required: false, input: false },
      onboarded_at: { type: "string", required: false, input: false },
      invited_by: { type: "string", required: false, input: false },
      deleted_at: { type: "string", required: false, input: false },
      clerk_id: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 48, // 48 hours
    updateAge: 60 * 60 * 4, // Refresh every 4 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minute cookie cache
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      // Wire to Resend in Phase 5
      console.log(`Verify email for ${user.email}: ${url}`);
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-create organization for new users
          const orgName = user.name
            ? `${user.name}'s Workspace`
            : "My Workspace";

          const { data: org, error: orgError } = await supabaseAdmin
            .from("organizations")
            .insert({ name: orgName, slug: user.id })
            .select("id")
            .single();

          if (orgError) {
            console.error("[auth] Failed to create org:", orgError);
            return;
          }

          await supabaseAdmin
            .from("users")
            .update({ org_id: org.id, role: "owner" })
            .eq("id", user.id);
        },
      },
    },
  },
  advanced: {
    database: {
      generateId: ({ model }) => {
        // Let Postgres generate UUIDs for tables with uuid PKs
        if (model === "users" || model === "organizations") return false;
        return crypto.randomUUID();
      },
    },
  },
  trustedOrigins: [
    process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
