Sitemap and Route Structure

This document outlines the complete sitemap for both the public marketing site and the authenticated web application (Next.js 13 App Router). It lists all primary routes, their purposes, and access requirements, providing a high-level view of the application’s pages.

Marketing Site (Public)

The marketing site is accessible to everyone and showcases the product’s value. These pages are statically generated for performance and SEO, using Next.js App Router conventions.
	•	/ – Homepage. Introduces the product (expert recording to docs & AI assistant), key benefits, and a call-to-action to sign up. It features a hero section, brief feature overview, and social proof.
	•	/features – Features Overview. Lists major product features (recording, transcription, document generation, vector search/chat, etc.) with descriptions and screenshots. Educates visitors on capabilities and how it solves their pain points.
	•	/pricing – Pricing Plans. Details plan tiers (e.g. Free, Pro, Enterprise), feature differences, and a sign-up link for each. Includes billing FAQs and “Contact Sales” for enterprise inquiries.
	•	/about – About Us. (Optional) Provides company background, mission, and team info, to build trust with potential customers.
	•	/contact – Contact Page. (Optional) Allows visitors to get in touch for support or sales. Could be a form or mailto link.
	•	/login and /signup – Authentication Pages. Redirects to or embeds Clerk’s login and signup components. These might be on separate domain (app subdomain) or as modal on marketing pages. (If using Clerk Hosted Pages, these routes may not be needed, but we include them for completeness).
	•	/terms – Terms of Service. Legal terms for using the service.
	•	/privacy – Privacy Policy. Details on data usage and privacy.

Each marketing page is implemented as a React server component with static generation. Navigation links across the top (e.g. Features, Pricing, Login) make it easy to explore. The tone is persuasive and concise, targeting our top-of-funnel audience.

Web Application (App - Authenticated)

The app is the secure, logged-in area where users record content, manage their recordings and documents, and interact with the AI assistant. It uses Next.js App Router with protected route groups (requiring authentication via Clerk).
	•	/app – Dashboard Home. The main landing after login. Shows the user’s workspace (if multi-organization, the active org’s name), recent recordings/docs, and an entry point to start a new recording. Acts as a “library” of knowledge captures.
	•	/app/record – New Recording. Launches the screen/camera recording interface. Users can select screen(s) to share and camera/microphone, then record. May be a modal or dedicated page. Upon finishing, it directs to the recording’s detail page.
	•	/app/recordings – My Recordings Library. (If separate from dashboard) Lists all recordings/documents the user has access to (in the active organization), with statuses (transcribing, ready, etc.). Allows searching within titles or descriptions.
	•	/app/recordings/[recordingId] – Recording Detail & Document. Page to view a specific recording and its derived content. It includes:
	•	A video player for the recorded screen/camera video.
	•	The transcript (with possible editing capability).
	•	The generated structured document (formatted notes/guide).
	•	An AI Q&A chat interface specific to this recording’s content (allowing the user to query the transcript/doc).
These sections might be in tabs or panels on the page. Users can also update metadata (title, description) here.
	•	/app/assist (or /app/search) – Global AI Assistant. Provides a chat or search interface that can retrieve information across all of the user’s recordings and documents. The assistant uses vector search to find relevant content and answer questions. This page might show recent queries or suggestions, and results link back to source recordings/docs.
	•	/app/settings – User/Org Settings. Contains sub-pages:
	•	/app/settings/profile – Update personal info (name, email) if applicable, or link to Clerk profile management.
	•	/app/settings/organization – Org management (if user is admin): organization name, invite members, manage roles, transfer ownership, etc.
	•	/app/settings/billing – (If applicable) shows current plan, usage, and a link to manage billing (Stripe customer portal).
	•	/app/admin – Admin Dashboard. (Optional, for internal admin roles) If we have an internal admin interface or for organization owners to see analytics, it can live under an admin route.

Route Access & Behavior: All /app/* routes require authentication. We use Clerk’s Next.js middleware to protect these routes – unauthorized users are redirected to login. Clerk provides the user and active organization context to the application. If a user has multiple organizations, they can switch the active org (e.g. via a selector in the dashboard header), which will update which data is shown. The URL structure remains the same (still under /app), but the content is filtered by active org.

Each route corresponds to a Next.js App Router file or folder. For example, the recording detail page is implemented by a dynamic route file at app/recordings/[recordingId]/page.tsx. This uses Next’s file-based routing and can fetch the recording data (server-side) and render client components for video player and AI chat, etc. Marketing pages like /features correspond to app/(marketing)/features/page.tsx (perhaps grouped in a marketing folder for clarity), and are public.

This sitemap ensures we have clear navigation between discovering the product (marketing site) and using it (web app). It will also guide our Next.js routing setup, ensuring each path has a defined purpose and component. All user flows (recording content, viewing results, asking questions, managing account) are accounted for in this structure.