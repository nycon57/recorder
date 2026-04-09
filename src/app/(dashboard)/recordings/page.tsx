import { redirect } from 'next/navigation';

/**
 * Recordings Redirect Page
 * Maintains backwards compatibility by redirecting /recordings to /library
 */
export default function RecordingsRedirect() {
  redirect('/library');
}
