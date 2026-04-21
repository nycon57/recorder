import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export from canonical source so all `@/lib/utils` consumers resolve it.
export { formatBytes } from './utils/formatting';
