/**
 * parse-frontmatter.ts
 *
 * Hand-rolled YAML frontmatter splitter. Avoids gray-matter dep.
 * Supports: scalar strings (quoted and unquoted), integers, booleans,
 * block arrays (`- value`), and flow arrays (`[a, b]`).
 *
 * No nested maps, no anchors, no multi-line scalars — sufficient for
 * the docs frontmatter schema. See plan §2.
 */

export interface ParsedFrontmatter {
  /** Raw YAML fields from the --- block. */
  data: Record<string, unknown>;
  /** Everything after the closing --- delimiter. */
  body: string;
  /** Raw YAML string between delimiters (for hashing). */
  rawYaml: string;
}

/**
 * Split a markdown file into frontmatter data + body.
 *
 * If the file does not start with `---\n`, returns empty data and the
 * full content as the body. The Zod caller will then reject the missing
 * required fields loudly.
 */
export function parseFrontmatter(source: string): ParsedFrontmatter {
  // Must start with the YAML delimiter
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    return { data: {}, body: source, rawYaml: '' };
  }

  // Find closing delimiter
  const afterOpen = source.startsWith('---\r\n') ? 5 : 4;
  const closeIdx = findClosingDelimiter(source, afterOpen);

  if (closeIdx === -1) {
    // No closing delimiter — treat as no frontmatter
    return { data: {}, body: source, rawYaml: '' };
  }

  const rawYaml = source.slice(afterOpen, closeIdx);
  const afterClose = source.indexOf('\n', closeIdx) + 1;
  const body = afterClose > 0 ? source.slice(afterClose) : '';

  const data = parseYamlSubset(rawYaml);

  return { data, body, rawYaml };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function findClosingDelimiter(source: string, startFrom: number): number {
  const patterns = ['---\r\n', '---\n', '---'];
  let i = startFrom;
  while (i < source.length) {
    for (const pat of patterns) {
      if (source.startsWith(pat, i) && (i === 0 || source[i - 1] === '\n')) {
        return i;
      }
    }
    const next = source.slice(i).search('\n');
    if (next === -1) break;
    i += next + 1;
  }
  return -1;
}

function parseYamlSubset(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines and comments
    if (!line.trim() || line.trimStart().startsWith('#')) {
      i++;
      continue;
    }

    const colonIdx = line.search(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (!key) {
      i++;
      continue;
    }

    // Flow array: `key: [a, b, c]`
    if (rawValue.startsWith('[')) {
      result[key] = parseFlowArray(rawValue);
      i++;
      continue;
    }

    // Block array: lines that follow start with `  - `
    if (rawValue === '') {
      const arr: string[] = [];
      i++;
      while (i < lines.length && /^\s+-\s/.test(lines[i])) {
        arr.push(lines[i].replace(/^\s+-\s+/, '').trim());
        i++;
      }
      result[key] = arr.length > 0 ? arr : null;
      continue;
    }

    // Scalar
    result[key] = parseScalar(rawValue);
    i++;
  }

  return result;
}

function parseFlowArray(raw: string): string[] {
  // Strip outer brackets
  const inner = raw.replace(/^\[/, '').replace(/\].*$/, '');
  return inner.split(',').flatMap((__item, __index, __array) => {
    const __mapped = __item.trim();
    return __mapped ? [__mapped.replace(/^['"]|['"]$/g, '')]
      : [];
  });
}

function parseScalar(raw: string): unknown {
  // Quoted strings
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }

  // Booleans
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Null
  if (raw === 'null' || raw === '~') return null;

  // Integers
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);

  // Float
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);

  // Plain string
  return raw;
}
