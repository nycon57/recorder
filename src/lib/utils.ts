import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export { formatBytes } from '@/lib/utils/formatting';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
