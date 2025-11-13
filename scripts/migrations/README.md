# Component Migration Scripts

Automated tools for migrating old components to registry-based alternatives.

## Quick Start

```bash
# Dry run (preview changes without applying)
npx tsx scripts/migrate-components.ts <migration-name> --dry-run

# Apply migration
npx tsx scripts/migrate-components.ts <migration-name>
```

## Available Migrations

### 1. Empty States ✅ COMPLETE
**Status:** Manually migrated (4 files)
- `LibraryEmptyState.tsx` (165 → 172 lines)
- `SearchNoResultsState.tsx` + `SearchInitialState.tsx` (183 → 196 lines)
- `ProcessingEmptyState.tsx` (178 → 189 lines)
- `EmptyState.tsx` (133 → 144 lines)

**Migration:** Refactored to use `@shadcn/empty` foundation while preserving features.

### 2. AI Chat (PENDING)
**Targets:** 31 files, 2,096 lines
- `prompt-input.tsx` (1,526 lines) - CRITICAL
- 30+ other AI component files

**Strategy:**
1. Replace with `@ai-elements` components (message, conversation, artifact, code-block)
2. Preserve existing functionality and state management
3. Update imports and component usage
4. Test chat flow end-to-end

### 3. Recording UI ✅ COMPONENTS INSTALLED
**Status:** ElevenLabs components installed, ready for migration
- Waveform visualization
- Live waveform for recording
- Orb animated indicator
- Audio player

**Targets:** 22 files, 500+ lines

## Creating New Migrations

### Example: Import Replacement

```typescript
import { createImportMigrationRule } from './import-replacer';

const myMigration = createImportMigrationRule({
  name: 'replace-card-imports',
  description: 'Replace custom Card with @shadcn/ui Card',
  filePattern: /\\.tsx?$/,
  replacements: [
    {
      from: '@/components/custom/Card',
      to: '@/app/components/ui/card',
      named: {
        CustomCard: 'Card',
        CustomCardHeader: 'CardHeader',
      },
    },
  ],
  addImports: [
    {
      from: '@/app/components/ui/card',
      named: ['Card', 'CardContent'],
    },
  ],
  removeUnused: true,
});
```

### Example: Component Transformation

```typescript
import { MigrationRule } from '../migrate-components';

const myTransform: MigrationRule = {
  name: 'transform-button',
  description: 'Update Button component API',
  filePattern: /\\.tsx?$/,
  transform: (content, filePath) => {
    let newContent = content;
    let changed = false;

    // Replace old API with new API
    if (content.includes('<Button variant="primary"')) {
      newContent = newContent.replace(
        /<Button variant="primary"/g,
        '<Button variant="default"'
      );
      changed = true;
    }

    return { content: newContent, changed };
  },
};
```

## Migration Workflow

### 1. Plan
- Identify components to migrate
- Review registry alternatives
- Document breaking changes
- Create migration rules

### 2. Implement
- Write migration scripts
- Test on sample files
- Run dry run on full codebase
- Review changes

### 3. Execute
- Apply migration
- Run type checks
- Test affected features
- Commit changes

### 4. Verify
- Build application
- Run test suite
- Manual testing of migrated components
- Update documentation

## Utilities

### `import-replacer.ts`
Helper functions for automated import management:

- `replaceImports()` - Replace old imports with new ones
- `addImports()` - Add new imports if not present
- `removeUnusedImports()` - Clean up unused imports
- `createImportMigrationRule()` - Generate migration rule

### `migrate-components.ts`
Main migration orchestrator:

- `runMigrations()` - Execute migration rules
- `printSummary()` - Show migration results
- `verifyMigrations()` - Run type checks
- `findFiles()` - Recursive file finder

## Best Practices

### 1. Always Dry Run First
```bash
npx tsx scripts/migrate-components.ts my-migration --dry-run
```

### 2. Test on Small Scope
Start with a single file or directory before running on entire codebase.

### 3. Commit Frequently
Commit after each successful migration phase for easy rollback.

### 4. Verify After Migration
```bash
npm run type:check
npm run build
npm test
```

### 5. Document Changes
Update migration plan with:
- Files changed
- Breaking changes
- Manual steps required
- Testing notes

## Troubleshooting

### Type Errors After Migration
```bash
# Check specific files
npm run type:check 2>&1 | grep "error TS"

# Fix imports
npx tsx scripts/migrations/fix-imports.ts
```

### Build Failures
```bash
# Clean build cache
rm -rf .next
npm run build
```

### Component Not Found
Ensure component is installed:
```bash
npx shadcn@latest add <component-name>
```

## Registry Reference

| Registry | Base URL | Components |
|----------|----------|------------|
| @shadcn | https://ui.shadcn.com/r/ | 449 |
| @ai-elements | https://registry.ai-sdk.dev/ | 81 |
| @elevenlabs-ui | https://ui.elevenlabs.io/r/ | 41 |
| @shadcnblocks | https://shadcnblocks.com/r/ | 963 |
| @clerk | https://clerk.com/r/ | 6 |
| @cult-ui | https://cult-ui.com/r/ | 82 |
| @supabase | https://supabase.com/ui/r/ | 37 |
| @aceternity | https://ui.aceternity.com/registry/ | 91 |

## Migration Tracking

See `COMPONENT_MIGRATION_PLAN.md` for:
- Week-by-week timeline
- Installation commands
- Before/after examples
- Success metrics

See `REGISTRY.md` for:
- Component inventory
- API standards
- Contributing guidelines
- ROI metrics
