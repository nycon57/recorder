# Layout Components

Professional, responsive layout components for the Tribora marketing site, adapted from the Zippay template design patterns.

## Components

### Navbar

A sticky header with backdrop blur, responsive navigation, and Clerk authentication integration.

**Features:**

- Sticky positioning with transparent backdrop blur effect
- Responsive mobile menu with smooth slide-down animation
- Desktop navigation links (Features, Pricing, About, Contact)
- Clerk authentication integration:
  - Signed out: "Sign In" and "Get Started" buttons with modal
  - Signed in: "Dashboard" link
- Mobile hamburger menu with animated icon
- Dark mode support

**Usage:**

```tsx
import { Navbar } from '@/app/components/layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}
```

### Footer

A professional footer with dark background, structured navigation, and legal links.

**Features:**

- Dark background (`bg-primary-300`) with white text
- Brand section with logo and copyright
- Responsive grid layout for navigation columns
- Legal links (Privacy Policy, Terms of Service)
- Dark mode support

**Props:**

- `brandName?: string` - Brand name (default: "Tribora")
- `nav?: NavSection[]` - Navigation sections
- `legal?: NavLink[]` - Legal links

**Usage:**

```tsx
import { Footer } from '@/app/components/layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main>{children}</main>
      <Footer brandName="Tribora" />
    </>
  );
}
```

**Custom Navigation:**

```tsx
const customNav = [
  {
    title: 'Product',
    links: [
      { name: 'Features', href: '/features' },
      { name: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { name: 'About', href: '/about' },
      { name: 'Contact', href: '/contact' },
    ],
  },
];

<Footer nav={customNav} />;
```

## Design System

Both components use the project's established design system:

**Colors:**

- `bg-background` - Background color
- `text-foreground` - Text color
- `border-gray-50` - Border color
- `bg-primary-100` - Primary action color
- `bg-primary-300` - Footer background
- `text-primary-100` - Hover/active link color

**Typography:**

- `text-heading-6` - Component headings
- `text-body-sm-medium` - Navigation links
- `text-body-md-medium` - Mobile navigation and buttons

**Responsive Breakpoints:**

- Mobile-first approach
- `sm:` - 640px
- `lg:` - 1024px

## Accessibility

Both components follow WCAG accessibility standards:

- Proper semantic HTML structure (`<header>`, `<nav>`, `<footer>`)
- ARIA labels and roles where necessary
- Keyboard navigation support
- Screen reader friendly
- Sufficient color contrast
- Focus indicators

## Dark Mode

Both components automatically support dark mode through the project's design system using CSS custom properties that adjust based on the `.dark` class.

## Mobile Responsiveness

**Navbar:**

- Desktop: Horizontal navigation with auth buttons
- Mobile: Hamburger menu with slide-down overlay

**Footer:**

- Desktop: Multi-column grid layout
- Tablet: 2-3 column grid
- Mobile: Stacked layout with 2-column navigation

## Integration with Clerk

The navbar uses Clerk's Next.js components for authentication:

- `SignedIn` / `SignedOut` - Conditional rendering based on auth state
- `SignInButton` - Triggers sign-in modal
- `SignUpButton` - Triggers sign-up modal
- All modals use `mode="modal"` for overlay UI

## Example: Complete Marketing Layout

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
