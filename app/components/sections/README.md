# Record Marketing Section Components

Professional, reusable section components for the Record marketing site, adapted from the Zippay template and fully integrated with the Record design system.

## Overview

All components follow the established design patterns from `/app/globals.css` and use components from `/app/components/ui/`. They are fully responsive, accessible, and support dark mode.

## Components

### 1. RecordHero (`record-hero.tsx`)

Hero section with gradient accent background and dual-column layout.

**Features:**
- Full-width gradient background (right side: `bg-primary-300`)
- Badge with Sparkles icon: "AI Knowledge Management"
- Large heading (text-heading-1): Customizable title
- Description with max-width for readability
- Dual CTA buttons with Clerk SignUpButton integration
- Company logos section (optional)
- Hero image with drop shadow effects
- Fully responsive (stacks on mobile, side-by-side on desktop)

**Props:**
```typescript
{
  title?: string;              // Default: "Unlock Your Team's Hidden Knowledge"
  description?: string;        // Product description
  ctaLabel?: string;          // Default: "Get Started Free"
  secondaryLabel?: string;    // Default: "Learn More"
  trustText?: string;         // Default: "Trusted by teams worldwide"
  logos?: LogoItem[];         // Company logos array
  heroImageSrc?: string;      // Hero image path
}
```

**File Path:** `/Users/jarrettstanley/Desktop/websites/recorder/app/components/sections/record-hero.tsx`

---

### 2. RecordFeatures (`record-features.tsx`)

Features section with large and small feature cards.

**Features:**
- Section header with badge and title
- 2 large feature cards (Browser Recording, AI Documentation)
  - Icon with gradient background
  - Title and description
  - Hover effects with shadow transitions
- 3 small feature cards in grid (Transcription, Semantic Search, AI Assistant)
  - Lucide icons (Mic, Search, MessageSquare)
  - Card component from UI library
  - Responsive grid layout (1 col mobile, 2 cols tablet, 3 cols desktop)

**Props:**
```typescript
{
  id?: string;                     // Section ID, default: "record-features"
  tagline?: string;                // Default: "Features"
  title?: string;                  // Default: "Everything You Need"
  description?: string;            // Section description
  bigFeatures?: BigFeature[];      // Large feature cards
  smallFeatures?: SmallFeature[];  // Small feature cards
}
```

**Feature Types:**
```typescript
type BigFeature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
};

type SmallFeature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
};
```

**File Path:** `/Users/jarrettstanley/Desktop/websites/recorder/app/components/sections/record-features.tsx`

---

### 3. RecordCTA (`record-cta.tsx`)

Full-width call-to-action section with gradient background.

**Features:**
- Gradient background: `from-primary-100 to-secondary-100`
- Pattern overlay image (optional, 10% opacity)
- White text overlay
- Centered heading and description
- CTA button with Clerk SignUpButton
- White button on gradient (high contrast)

**Props:**
```typescript
{
  title?: string;          // Default: "Ready to Capture Your Team's Knowledge?"
  description?: string;    // Default: "Start for free today..."
  ctaLabel?: string;       // Default: "Get Started Free"
  patternSrc?: string;     // Background pattern image path
}
```

**File Path:** `/Users/jarrettstanley/Desktop/websites/recorder/app/components/sections/record-cta.tsx`

---

### 4. RecordTestimonials (`record-testimonials.tsx`)

Customer testimonial cards in a responsive grid.

**Features:**
- Section header with badge
- 3-column grid of testimonial cards (1 col mobile, 3 cols desktop)
- Avatar support (with fallback to initials)
- Author, role, and company information
- Quote text
- Gradient background for avatar placeholders

**Props:**
```typescript
{
  tagline?: string;             // Default: "Testimonials"
  title?: string;               // Default: "Trusted by Teams Worldwide"
  subtitle?: string;            // Section subtitle
  testimonials?: Testimonial[]; // Array of testimonials
}
```

**Testimonial Type:**
```typescript
type Testimonial = {
  quote: string;
  author: string;
  role: string;
  company: string;
  avatarSrc?: string;  // Optional, falls back to initials
};
```

**File Path:** `/Users/jarrettstanley/Desktop/websites/recorder/app/components/sections/record-testimonials.tsx`

---

### 5. RecordPricing (`record-pricing.tsx`)

Pricing cards with feature lists and CTAs.

**Features:**
- Section header
- 3 pricing tiers (Free, Pro, Enterprise)
- Pro plan highlighted with gradient background and scale effect
- "Most Popular" badge on highlighted plan
- Feature lists with checkmark icons
- Clerk SignUpButton integration
- Custom pricing for Enterprise (links to contact page)
- Responsive grid (1 col mobile, 3 cols desktop)

**Props:**
```typescript
{
  tagline?: string;         // Default: "Pricing"
  title?: string;           // Default: "Simple, Transparent Pricing"
  description?: string;     // Section description
  plans?: PricingPlan[];    // Array of pricing plans
}
```

**PricingPlan Type:**
```typescript
type PricingPlan = {
  name: string;
  price: number | string;    // Number or "Custom"
  period?: string;           // e.g., "/month"
  description: string;
  features: string[];
  ctaLabel?: string;
  highlighted?: boolean;     // Applies gradient background
  href?: string;             // Optional custom link
};
```

**File Path:** `/Users/jarrettstanley/Desktop/websites/recorder/app/components/sections/record-pricing.tsx`

---

### 6. RecordFAQ (`record-faq.tsx`)

Frequently asked questions with accordion.

**Features:**
- Section header with badge
- Accordion component from UI library
- 6 default FAQs about pricing, data, security
- Custom expand/collapse icons (+ and −)
- "See All FAQs" button
- Optional soft background (`softBg` prop)

**Props:**
```typescript
{
  tagline?: string;       // Default: "FAQs"
  title?: string;         // Default: "Frequently Asked Questions"
  description?: string;   // Section description
  faqs?: FaqItem[];       // Array of FAQ items
  ctaHref?: string;       // Default: "/faq"
  ctaLabel?: string;      // Default: "See All FAQs"
  className?: string;     // Additional classes
  softBg?: boolean;       // Enable light background
}
```

**FaqItem Type:**
```typescript
type FaqItem = {
  question: string;
  answer: string;
};
```

**File Path:** `/Users/jarrettstanley/Desktop/websites/recorder/app/components/sections/record-faq.tsx`

---

## Design System Integration

All components use the design system from `/app/globals.css`:

### Colors
- **Primary**: Blue (`--primary-100`, `--primary-200`, `--primary-300`)
- **Secondary**: Purple (`--secondary-100`, `--secondary-200`)
- **Gray Scale**: `--gray-0` through `--gray-900`
- **Semantic**: Success, Warning, Error, Aqua colors

### Typography
- **Headings**: `text-heading-1` through `text-heading-6`
- **Body**: `text-body-lg`, `text-body-md`, `text-body-sm`, `text-body-xs`
- **Weights**: Regular (400), Medium (500), Bold (700)

### Components Used
- **Button**: `/app/components/ui/button.tsx`
- **Card**: `/app/components/ui/card.tsx`
- **Accordion**: `/app/components/ui/accordion.tsx`

### Clerk Integration
All CTAs use `SignUpButton` from `@clerk/nextjs`:
```typescript
import { SignUpButton } from '@clerk/nextjs';

<SignUpButton mode="modal">
  <Button>Get Started Free</Button>
</SignUpButton>
```

## Usage Example

```typescript
import {
  RecordHero,
  RecordFeatures,
  RecordCTA,
  RecordTestimonials,
  RecordPricing,
  RecordFAQ,
} from '@/app/components/sections';

export default function MarketingPage() {
  return (
    <>
      <RecordHero />
      <RecordFeatures />
      <RecordTestimonials />
      <RecordPricing />
      <RecordFAQ softBg />
      <RecordCTA />
    </>
  );
}
```

## Responsive Behavior

All components are mobile-first and fully responsive:

- **Mobile (< 640px)**: Single column, stacked layout
- **Tablet (640px - 1024px)**: 2-column grids where applicable
- **Desktop (> 1024px)**: Full multi-column layouts

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support (Accordion, Buttons)
- Sufficient color contrast (WCAG AA)
- Focus indicators on all interactive elements

## Dark Mode

All components support dark mode through CSS variables:
- Background colors adjust automatically
- Text colors maintain proper contrast
- Borders and shadows adapt to theme

## Customization

Each component accepts props for customization:

1. **Content**: All text is customizable via props
2. **Styling**: Additional classes via `className` prop
3. **Data**: Arrays of features, testimonials, FAQs, etc.
4. **Links**: Custom hrefs for CTAs and navigation

## File Structure

```
/app/components/sections/
├── index.ts                    # Barrel exports
├── record-hero.tsx            # Hero section
├── record-features.tsx        # Features grid
├── record-cta.tsx             # Call-to-action
├── record-testimonials.tsx    # Customer testimonials
├── record-pricing.tsx         # Pricing tiers
├── record-faq.tsx             # FAQ accordion
└── README.md                  # This file
```

## Notes

- All components use `'use client'` directive for interactive features
- TypeScript types are fully defined for all props
- Default content is provided for rapid prototyping
- Icons from `lucide-react` are used throughout
- Images use Next.js `Image` component for optimization
