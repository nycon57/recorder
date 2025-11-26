# Knowledge Graph Components

This directory contains React components for displaying and interacting with the Knowledge Graph feature. The Knowledge Graph automatically extracts concepts (tools, processes, people, organizations, technical terms) from your content and creates a network of related information.

## Components

### KnowledgeInsightsCard

A dashboard widget that displays knowledge graph statistics and insights.

**Location:** `KnowledgeInsightsCard.tsx`

**Features:**
- Total concepts count
- Top 5 most mentioned concepts
- Breakdown by concept type (with visual progress bars)
- Optional: Trending concepts (most active this week)
- Summary statistics (total, types, mentions)
- Loading and error states
- Empty state handling
- Click-through to concept details
- SWR data fetching with caching

**Usage:**

```tsx
import { KnowledgeInsightsCard } from '@/app/components/knowledge';

function Dashboard() {
  const router = useRouter();

  const handleConceptClick = (conceptId: string) => {
    router.push(`/knowledge/concepts/${conceptId}`);
  };

  return (
    <KnowledgeInsightsCard
      onConceptClick={handleConceptClick}
      showTrending={true}
    />
  );
}
```

**Props:**
- `className?: string` - Additional CSS classes
- `onConceptClick?: (conceptId: string) => void` - Callback when a concept is clicked
- `showTrending?: boolean` - Show trending concepts section (default: `false`)

**Data Source:**
- API: `GET /api/knowledge/concepts?limit=50&sort=mention_count_desc`
- Cache: 1-minute with SWR
- Updates: On focus, reconnect, or manual revalidation

### ConceptBadge

Display a concept with type-specific icon and color.

**Location:** `ConceptBadge.tsx`

**Features:**
- Type-specific icons (Wrench, GitBranch, User, Building, Code, Lightbulb)
- Type-specific colors (blue, green, orange, slate, purple, yellow)
- Size variants (sm, md, lg)
- Removable option with X button
- Click handler support
- Automatic text contrast calculation

**Usage:**

```tsx
import { ConceptBadge } from '@/app/components/knowledge';

// With concept object
<ConceptBadge
  concept={{
    id: '123',
    name: 'React',
    conceptType: 'tool'
  }}
  onClick={() => handleClick('123')}
/>

// With individual props
<ConceptBadge
  name="Agile Methodology"
  type="process"
  size="sm"
  showIcon={true}
/>

// Removable badge
<ConceptBadge
  name="John Doe"
  type="person"
  removable
  onRemove={() => handleRemove()}
/>
```

### ConceptList

Display a list of concepts with overflow handling.

**Location:** `ConceptBadge.tsx`

**Features:**
- Wrapping grid layout
- Max visible limit with "+N more" indicator
- Individual concept click handlers
- Removal support
- Size control

**Usage:**

```tsx
import { ConceptList } from '@/app/components/knowledge';

<ConceptList
  concepts={concepts}
  size="md"
  maxVisible={5}
  onConceptClick={(id) => router.push(`/concepts/${id}`)}
  removable={false}
/>
```

### ConceptTypeLabel

Display a concept type as a label with icon.

**Location:** `ConceptBadge.tsx`

**Usage:**

```tsx
import { ConceptTypeLabel } from '@/app/components/knowledge';

<ConceptTypeLabel type="tool" size="md" />
// Renders: 🔧 Tool
```

### ConceptSection

Full-featured section for displaying content's concepts.

**Location:** `ConceptSection.tsx`

**Features:**
- Grouped by concept type
- Expandable/collapsible groups
- Add/remove concepts
- Loading states
- Empty states

### ConceptsEmptyState

Empty state component for when no concepts exist.

**Location:** `ConceptsEmptyState.tsx`

**Variants:**
- `no-content` - No content created yet
- `processing` - Content exists, concepts being extracted
- `no-concepts` - Content exists, no concepts detected

**Usage:**

```tsx
import { ConceptsEmptyState, ConceptsEmptyStateCompact } from '@/app/components/knowledge';

// Full empty state
<ConceptsEmptyState variant="no-content" />

// Compact inline empty state
<ConceptsEmptyStateCompact variant="processing" />
```

## Concept Types

The system recognizes six concept types:

| Type | Icon | Color | Description | Example |
|------|------|-------|-------------|---------|
| `tool` | 🔧 Wrench | Blue | Software, services, applications | React, VS Code, Figma |
| `process` | 🌿 GitBranch | Green | Methodologies, workflows | Agile, CI/CD, Code Review |
| `person` | 👤 User | Orange | Individuals mentioned | John Doe, Sarah Smith |
| `organization` | 🏢 Building | Slate | Companies, teams | Microsoft, Engineering Team |
| `technical_term` | 💻 Code | Purple | Technical concepts | API, Database, Authentication |
| `general` | 💡 Lightbulb | Yellow | General concepts | Best Practices, Guidelines |

## API Integration

### Endpoints

**List Concepts**
```
GET /api/knowledge/concepts
Query params:
  - search: Search concept names
  - type: Filter by concept type
  - limit: Number of results (default: 50, max: 100)
  - offset: Pagination offset
  - sort: mention_count_desc | last_seen_desc | name_asc | name_desc
  - minMentions: Minimum mention count filter
```

**Get Concept Details**
```
GET /api/knowledge/concepts/:id
Query params:
  - includeRelated: Include related concepts (default: true)
  - includeMentions: Include mentions (default: true)
  - relatedLimit: Max related concepts (default: 10)
  - mentionsLimit: Max mentions (default: 10)
```

**Get Concept Content**
```
GET /api/knowledge/concepts/:id/content
Query params:
  - limit: Number of results (default: 20)
  - offset: Pagination offset
```

### Response Format

```typescript
{
  success: boolean;
  data: {
    concepts: Concept[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}
```

### Concept Schema

```typescript
interface Concept {
  id: string;
  orgId: string;
  name: string;
  normalizedName: string;
  description: string | null;
  conceptType: ConceptType;
  mentionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}
```

## Styling

All components use:
- Tailwind CSS utilities
- shadcn/ui components (Card, Button, etc.)
- Lucide icons
- Concept type colors from `@/lib/validations/knowledge`
- Responsive design (mobile-first)
- Dark mode support

## Performance

- **SWR caching**: 1-minute cache for concepts list
- **Lazy loading**: Only fetch when component mounts
- **Request deduplication**: SWR prevents duplicate requests
- **Optimized re-renders**: React.memo where appropriate

## Accessibility

- **Keyboard navigation**: Tab, Enter, Space
- **ARIA labels**: Proper roles and labels
- **Focus indicators**: Clear focus states
- **Screen reader support**: Semantic HTML
- **Color contrast**: WCAG AA compliance

## Testing

See `__tests__/app/components/knowledge/` for component tests.

## Development

### Adding New Concept Types

1. Add type to `CONCEPT_TYPES` in `lib/validations/knowledge.ts`
2. Add color to `CONCEPT_TYPE_COLORS`
3. Add icon to `CONCEPT_TYPE_ICONS` and `ConceptTypeIcons` map
4. Update database enum type

### Customizing Colors

Edit `CONCEPT_TYPE_COLORS` in `lib/validations/knowledge.ts`:

```typescript
export const CONCEPT_TYPE_COLORS: Record<ConceptType, string> = {
  tool: '#3b82f6',      // Custom hex color
  // ...
};
```

### Extending Components

All components accept `className` prop for custom styling:

```tsx
<ConceptBadge
  name="React"
  type="tool"
  className="shadow-lg hover:scale-105"
/>
```

## Examples

See `INTEGRATION_EXAMPLE.md` for detailed dashboard integration examples.

## Support

For issues or questions:
1. Check the Knowledge Graph documentation
2. Review API endpoint documentation
3. Check component prop types
4. See integration examples
