import type { Metadata } from 'next';

import ContactClient from './contact-client';

export const metadata: Metadata = {
  title: 'Contact | Tribora',
  description:
    'Contact the Tribora team for sales, support, partnerships, or product questions.',
};

export default function ContactPage() {
  return <ContactClient />;
}
