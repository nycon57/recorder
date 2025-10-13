import { SignUp } from '@clerk/nextjs';

/**
 * Sign Up Page
 * Uses centralized Clerk appearance configuration from lib/clerk/appearance.ts
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <SignUp />
    </div>
  );
}
