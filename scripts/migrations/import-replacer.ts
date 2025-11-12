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
          // Handle "as" syntax: "X as Y"
          const asMatch = name.match(/^(\w+)\\s+as\\s+(\\w+)$/);
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
 */
export function removeUnusedImports(content: string): { content: string; changed: boolean } {
  let newContent = content;
  let changed = false;

  // Match all import statements
  const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"];?\n?/g;
  const imports = Array.from(newContent.matchAll(importRegex));

  for (const match of imports) {
    const [fullMatch, namedImports, defaultImport] = match;

    if (namedImports) {
      // Check if any named import is used
      const names = namedImports
        .split(',')
        .map((n) => {
          const asMatch = n.match(/^(\w+)\s+as\s+(\w+)$/);
          return asMatch ? asMatch[2].trim() : n.trim();
        })
        .filter(Boolean);

      const unusedNames = names.filter((name) => {
        // Check if name is used in the file (outside import statements)
        const contentWithoutImports = newContent.replace(importRegex, '');
        const usageRegex = new RegExp(`\\b${name}\\b`, 'g');
        return !usageRegex.test(contentWithoutImports);
      });

      // Remove entire import if all names are unused
      if (unusedNames.length === names.length) {
        newContent = newContent.replace(fullMatch, '');
        changed = true;
      }
    } else if (defaultImport) {
      // Check if default import is used
      const contentWithoutImports = newContent.replace(importRegex, '');
      const usageRegex = new RegExp(`\\b${defaultImport}\\b`, 'g');

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
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
