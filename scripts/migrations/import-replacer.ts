/**
 * Import Replacement Utilities
 *
 * Helper functions for automated import replacement in component migrations
 */

export interface ImportReplacement {
  from: string | RegExp;
  to: string;
  named?: {
    [oldName: string]: string; // old import name → new import name
  };
}

/**
 * Replace import statements in file content
 */
export function replaceImports(
  content: string,
  replacements: ImportReplacement[]
): { content: string; changed: boolean } {
  let newContent = content;
  let changed = false;

  for (const replacement of replacements) {
    const { from, to, named } = replacement;

    // Handle regex pattern matching
    const fromPattern = typeof from === 'string' ? escapeRegex(from) : from.source;

    // Match: import { X, Y, Z } from 'path'
    const namedImportRegex = new RegExp(
      `import\\s+\\{([^}]+)\\}\\s+from\\s+['"]${fromPattern}['"];?`,
      'g'
    );

    // Match: import X from 'path'
    const defaultImportRegex = new RegExp(
      `import\\s+(\\w+)\\s+from\\s+['"]${fromPattern}['"];?`,
      'g'
    );

    // Replace named imports
    const namedMatches = Array.from(newContent.matchAll(namedImportRegex));
    for (const match of namedMatches) {
      const [fullMatch, imports] = match;

      // Parse imported names
      const importNames = imports
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

      // Apply name mappings if provided
      let newImports = importNames;
      if (named) {
        newImports = importNames.map((name) => {
          /**
           * IMPROVEMENT: Fixed regex escape issue
           * - Changed \\s+ (double backslash - would match literal backslash + 's+')
           * - To \s+ (single backslash - correctly matches whitespace)
           * - This regex now properly handles "X as Y" import syntax
           */
          const asMatch = name.match(/^(\w+)\s+as\s+(\w+)$/);
          if (asMatch) {
            const [, importName, alias] = asMatch;
            const newName = named[importName] || importName;
            return `${newName} as ${alias}`;
          }
          return named[name] || name;
        });
      }

      const newImport = `import { ${newImports.join(', ')} } from '${to}';`;
      newContent = newContent.replace(fullMatch, newImport);
      changed = true;
    }

    // Replace default imports
    const defaultMatches = Array.from(newContent.matchAll(defaultImportRegex));
    for (const match of defaultMatches) {
      const [fullMatch, importName] = match;
      const newImportName = named?.[importName] || importName;
      const newImport = `import ${newImportName} from '${to}';`;
      newContent = newContent.replace(fullMatch, newImport);
      changed = true;
    }
  }

  return { content: newContent, changed };
}

/**
 * Add new imports to file (if not already present)
 */
export function addImports(
  content: string,
  imports: { from: string; named?: string[]; default?: string }[]
): { content: string; changed: boolean } {
  let newContent = content;
  let changed = false;

  for (const imp of imports) {
    const { from, named = [], default: defaultImport } = imp;

    // Check if import already exists
    const existingNamedRegex = new RegExp(
      `import\\s+\\{[^}]*\\}\\s+from\\s+['"]${escapeRegex(from)}['"]`
    );
    const existingDefaultRegex = new RegExp(
      `import\\s+\\w+\\s+from\\s+['"]${escapeRegex(from)}['"]`
    );

    const hasNamedImport = existingNamedRegex.test(newContent);
    const hasDefaultImport = existingDefaultRegex.test(newContent);

    // Add imports if they don't exist
    if (named.length > 0 && !hasNamedImport) {
      const namedImport = `import { ${named.join(', ')} } from '${from}';\n`;

      // Insert after last import or at top of file
      const lastImportIndex = newContent.lastIndexOf('import ');
      if (lastImportIndex >= 0) {
        const lineEnd = newContent.indexOf('\n', lastImportIndex);
        const insertPos = lineEnd >= 0 ? lineEnd + 1 : newContent.length;
        newContent =
          newContent.slice(0, insertPos) + namedImport + newContent.slice(insertPos);
      } else {
        newContent = namedImport + newContent;
      }
      changed = true;
    }

    if (defaultImport && !hasDefaultImport) {
      const defaultImportStr = `import ${defaultImport} from '${from}';\n`;

      const lastImportIndex = newContent.lastIndexOf('import ');
      if (lastImportIndex >= 0) {
        const lineEnd = newContent.indexOf('\n', lastImportIndex);
        const insertPos = lineEnd >= 0 ? lineEnd + 1 : newContent.length;
        newContent =
          newContent.slice(0, insertPos) + defaultImportStr + newContent.slice(insertPos);
      } else {
        newContent = defaultImportStr + newContent;
      }
      changed = true;
    }
  }

  return { content: newContent, changed };
}

/**
 * Remove unused imports
 *
 * IMPROVEMENT: Optimized contentWithoutImports computation
 * - Previously computed contentWithoutImports for each import name (O(n²) complexity)
 * - Now computed once and reused for all checks (O(n) complexity)
 * - Added handling for multi-line imports that may span multiple lines
 * - Improved handling of import comments and edge cases
 */
export function removeUnusedImports(content: string): { content: string; changed: boolean } {
  let newContent = content;
  let changed = false;

  /**
   * Match all import statements including multi-line imports
   * This regex handles:
   * - Named imports: import { X, Y } from 'path'
   * - Default imports: import X from 'path'
   * - Multi-line named imports: import {\n  X,\n  Y\n} from 'path'
   * - Optional semicolons and trailing newlines
   */
  const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"];?\n?/g;
  const imports = Array.from(newContent.matchAll(importRegex));

  /**
   * PERFORMANCE OPTIMIZATION: Compute content without imports once
   * This is used for all usage checks to avoid recomputing for each import
   * Prevents O(n²) complexity when checking many imports
   */
  const contentWithoutImports = newContent.replace(importRegex, '');

  for (const match of imports) {
    const [fullMatch, namedImports, defaultImport] = match;

    if (namedImports) {
      /**
       * Handle named imports: import { X, Y, Z } from 'path'
       * Supports "as" syntax: import { X as Y } from 'path'
       */
      const names = namedImports
        .split(',')
        .map((n) => {
          // Handle "X as Y" syntax - we care about the alias (Y), not the original name (X)
          const asMatch = n.match(/^(\w+)\s+as\s+(\w+)$/);
          return asMatch ? asMatch[2].trim() : n.trim();
        })
        .filter(Boolean); // Remove empty strings from trailing commas

      // Check which names are actually unused in the code
      const unusedNames = names.filter((name) => {
        /**
         * Use word boundary regex to avoid false positives
         * e.g., "Button" won't match "MyButton" or "ButtonProps"
         */
        const usageRegex = new RegExp(`\\b${escapeRegexForName(name)}\\b`, 'g');
        return !usageRegex.test(contentWithoutImports);
      });

      /**
       * IMPROVEMENT: Only remove import if ALL names are unused
       * This prevents breaking partial imports where some names are used
       * TODO: Could be enhanced to remove only unused names from the import
       */
      if (unusedNames.length === names.length) {
        newContent = newContent.replace(fullMatch, '');
        changed = true;
      }
    } else if (defaultImport) {
      /**
       * Handle default imports: import X from 'path'
       * Reuse the pre-computed contentWithoutImports for efficiency
       */
      const usageRegex = new RegExp(`\\b${escapeRegexForName(defaultImport)}\\b`, 'g');

      if (!usageRegex.test(contentWithoutImports)) {
        newContent = newContent.replace(fullMatch, '');
        changed = true;
      }
    }
  }

  return { content: newContent, changed };
}

/**
 * Escape regex special characters
 * Used for both import names and path patterns to prevent regex injection
 *
 * IMPROVEMENT: Consolidated duplicate escape functions
 * - Removed duplicate escapeRegexForName function
 * - Single source of truth for regex escaping
 * - Used by both import name matching and path pattern matching
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Alias for clarity in import name contexts
const escapeRegexForName = escapeRegex;

/**
 * Create a migration rule for import replacement
 */
export function createImportMigrationRule(config: {
  name: string;
  description: string;
  filePattern: RegExp;
  replacements: ImportReplacement[];
  addImports?: { from: string; named?: string[]; default?: string }[];
  removeUnused?: boolean;
}) {
  return {
    name: config.name,
    description: config.description,
    filePattern: config.filePattern,
    transform: (content: string) => {
      let result = { content, changed: false };

      // Replace imports
      result = replaceImports(result.content, config.replacements);

      // Add new imports
      if (config.addImports) {
        const addResult = addImports(result.content, config.addImports);
        result = {
          content: addResult.content,
          changed: result.changed || addResult.changed,
        };
      }

      // Remove unused imports
      if (config.removeUnused) {
        const removeResult = removeUnusedImports(result.content);
        result = {
          content: removeResult.content,
          changed: result.changed || removeResult.changed,
        };
      }

      return result;
    },
  };
}
