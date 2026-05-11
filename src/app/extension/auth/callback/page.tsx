import type { Metadata } from 'next';

import ExtensionAuthCallbackClient from './callback-client';

export const metadata: Metadata = {
  title: 'Extension Auth Callback | Tribora',
  description: 'Completes a secure Tribora browser extension sign-in handoff.',
};

type ExtensionAuthCallbackPageProps = {
  searchParams: Promise<{ extension_auth_state?: string }>;
};

export default async function ExtensionAuthCallbackPage({
  searchParams,
}: ExtensionAuthCallbackPageProps) {
  const { extension_auth_state: extensionAuthState = null } =
    await searchParams;

  return (
    <ExtensionAuthCallbackClient extensionAuthState={extensionAuthState} />
  );
}
