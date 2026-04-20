/**
 * git-updated-at.ts
 *
 * Resolve the `updatedAt` (YYYY-MM-DD) for a docs file.
 * Primary: `git log -1 --format=%cI -- <file>` (author commit date).
 * Fallback: file mtime.
 *
 * Uses execFileSync (not exec/execSync with shell) to prevent injection.
 * The filepath is passed as a distinct argument, never interpolated into
 * a shell string.
 *
 * See plan §13.
 */

import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

/**
 * Return YYYY-MM-DD string for the given file path.
 * Never throws — degrades to mtime on any error.
 */
export function getUpdatedAt(filepath: string): string {
  try {
    const iso = execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', filepath],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();

    if (iso) {
      return iso.slice(0, 10); // YYYY-MM-DD
    }
  } catch {
    // fall through
  }

  // Fallback: file mtime
  try {
    const stat = statSync(filepath);
    return stat.mtime.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
