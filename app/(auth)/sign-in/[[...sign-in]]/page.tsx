import { SignIn } from '@clerk/nextjs';

/**
 * Sign In Page
 * Uses centralized Clerk appearance configuration from lib/clerk/appearance.ts
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <SignIn />
    </div>
  );
}
