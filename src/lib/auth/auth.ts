import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, magicLink, organization } from "better-auth/plugins";
import { Pool } from "pg";

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
    admin(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Wire to Resend in Phase 5
        console.log(`Magic link for ${email}: ${url}`);
      },
    }),
    organization({
      creatorRole: "owner",
    }),
  ],
  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      title: { type: "string", required: false },
      avatar_url: { type: "string", required: false },
      timezone: { type: "string", required: false, defaultValue: "UTC" },
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
  trustedOrigins: [
    process.env.NEXT_PUBLIC_DOMAIN || "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
