# Layout Components - Usage Examples

## Quick Start

Import and use the layout components in your Next.js pages or layouts:

```tsx
import { Navbar, Footer } from '@/app/components/layout';

export default function Page() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">{/* Your content here */}</main>
      <Footer />
    </>
  );
}
```

## Example 1: Marketing Layout (Recommended)

Create a shared layout for all marketing pages:

```tsx
// app/(marketing)/layout.tsx
import { Navbar, Footer } from '@/app/components/layout';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
```

Then create marketing pages without repeating the layout:

```tsx
// app/(marketing)/page.tsx
export default function HomePage() {
  return (
    <div className="container mx-auto px-6 py-20">
      <h1 className="text-heading-1 text-center">Welcome to Record</h1>
      <p className="text-body-lg mt-6 text-center text-muted-foreground">
        AI-powered screen recording and knowledge management
      </p>
    </div>
  );
}

// app/(marketing)/features/page.tsx
export default function FeaturesPage() {
  return (
    <div className="container mx-auto px-6 py-20">
      <h1 className="text-heading-2">Features</h1>
      {/* Feature content */}
    </div>
  );
}
```

## Example 2: Custom Footer with Different Links

```tsx
import { Footer } from '@/app/components/layout';

const customNav = [
  {
    title: 'Product',
    links: [
      { name: 'Features', href: '/features' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'API Docs', href: '/docs' },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Blog', href: '/blog' },
      { name: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Support',
    links: [
      { name: 'Help Center', href: '/help' },
      { name: 'Contact', href: '/contact' },
      { name: 'Status', href: '/status' },
    ],
  },
];

const customLegal = [
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms of Service', href: '/terms' },
  { name: 'Cookie Policy', href: '/cookies' },
  { name: 'GDPR', href: '/gdpr' },
];

export default function CustomFooterPage() {
  return <Footer brandName="Record" nav={customNav} legal={customLegal} />;
}
```

## Example 3: Landing Page with Hero Section

```tsx
// app/(marketing)/page.tsx
export default function LandingPage() {
  return (
    <>
      {/* Hero Section - Full width background */}
      <section className="relative bg-gradient-to-br from-primary-50 to-secondary-50 py-20 lg:py-32">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-heading-1 mb-6">
              Record, Transcribe, and Transform Your Content
            </h1>
            <p className="text-body-lg mb-8 text-muted-foreground">
              AI-powered screen recording with automatic transcription and
              intelligent document generation
            </p>
            <div className="flex justify-center gap-4">
              <button className="rounded-lg bg-primary-100 px-6 py-3 text-body-md-medium text-white transition-all hover:bg-primary-200">
                Get Started Free
              </button>
              <button className="rounded-lg border border-gray-200 px-6 py-3 text-body-md-medium transition-all hover:bg-gray-25">
                Watch Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-heading-2 mb-12 text-center">Key Features</h2>
          {/* Feature cards */}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-gray-25 py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-heading-2 mb-12 text-center">Simple Pricing</h2>
          {/* Pricing cards */}
        </div>
      </section>
    </>
  );
}
```

## Example 4: Handling Authentication State

The navbar automatically shows different buttons based on authentication:

```tsx
// When signed out:
// - Shows "Sign In" (secondary button)
// - Shows "Get Started" (primary button)

// When signed in:
// - Shows "Dashboard" (primary button linking to /dashboard)

// Both use Clerk modals (mode="modal") for a seamless experience
```

## Styling Tips

### Container Widths

The components use the custom `container` utility from `globals.css`:

```css
/* Max width: 1200px on desktop */
.container {
  margin-inline: auto;
  max-width: 100%;
  @media (min-width: 1200px) {
    max-width: 1200px;
  }
}
```

### Consistent Spacing

Use these spacing patterns for sections:

```tsx
// Desktop: py-20 (80px)
// Mobile: py-12 (48px)
<section className="py-12 lg:py-20">

// Container padding
<div className="container mx-auto px-6">
```

### Background Patterns

```tsx
// Light background
<section className="bg-gray-25">

// Gradient background
<section className="bg-gradient-to-br from-primary-50 to-secondary-50">

// White background (default)
<section className="bg-background">
```

## Responsive Behavior

### Navbar

- **Desktop (lg: 1024px+)**:

  - Full navigation menu visible
  - Auth buttons inline
  - Logo on left, nav center, buttons right

- **Mobile (<1024px)**:
  - Hamburger menu button
  - Slide-down overlay menu
  - Full-width auth buttons

### Footer

- **Desktop (lg: 1024px+)**:

  - Brand section on left
  - 3-column navigation grid on right

- **Tablet (sm: 640px - lg: 1024px)**:

  - 2-3 column responsive grid

- **Mobile (<640px)**:
  - Stacked brand section
  - 2-column navigation grid

## Dark Mode

Both components automatically support dark mode. The design system handles color transitions:

```tsx
// Light mode: bg-background = white
// Dark mode: bg-background = dark gray

// Text colors, borders, etc. all adjust automatically
```

## Accessibility Checklist

- ✅ Semantic HTML (`<header>`, `<nav>`, `<footer>`)
- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation support
- ✅ Focus indicators
- ✅ Screen reader friendly
- ✅ Color contrast WCAG AA compliant
- ✅ Mobile touch targets (min 44x44px)

## Performance Considerations

Both components are client components (`'use client'`) because they:

1. Use React hooks (`useState`, `useEffect`)
2. Handle interactive UI (menu toggle, authentication)
3. Integrate with Clerk's client-side components

However, they're lightweight and don't significantly impact bundle size.

## Common Issues & Solutions

### Issue: Mobile menu doesn't close on navigation

**Solution**: Already handled - onClick handlers close the menu:

```tsx
onClick={() => setIsMenuOpen(false)}
```

### Issue: Navbar overlaps content

**Solution**: Navbar is `sticky top-0`, so it stays at the top. Add padding to your main content:

```tsx
<main className="pt-16 lg:pt-20">{/* Matches navbar height */}</main>
```

### Issue: Footer at bottom even on short pages

**Solution**: Use flexbox layout:

```tsx
<div className="flex min-h-screen flex-col">
  <Navbar />
  <main className="flex-1">{children}</main>
  <Footer />
</div>
```
