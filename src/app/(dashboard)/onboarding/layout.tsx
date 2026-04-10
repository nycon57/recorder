import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Onboarding',
  description: 'Your personalized learning path to get up to speed',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
