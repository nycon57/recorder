# UI Components

Professional UI components built with shadcn/ui v4, Tailwind CSS v4, and Radix UI primitives.

## Installation

All required dependencies are already installed:
- `@radix-ui/react-slot` - For polymorphic button component
- `@radix-ui/react-accordion` - For accordion functionality
- `@radix-ui/react-label` - For accessible form labels
- `class-variance-authority` - For variant management
- `clsx` + `tailwind-merge` - For className merging

## Available Components

### Button

Professional button component with multiple variants and sizes.

**Variants:**
- `default` - Primary blue background (brand color)
- `secondary` - Gray/purple background
- `outline` - Border only with hover effect
- `ghost` - No background, hover effect only
- `destructive` - Red background for dangerous actions
- `link` - Text-only with underline on hover

**Sizes:**
- `sm` - Small (h-8)
- `default` - Default (h-9)
- `lg` - Large (h-10)
- `icon` - Square icon button (9x9)
- `icon-sm` - Small icon button (8x8)
- `icon-lg` - Large icon button (10x10)

**Usage:**
```tsx
import { Button } from '@/app/components/ui/button';

<Button variant="default" size="lg">
  Click me
</Button>

// As a link
<Button asChild variant="outline">
  <a href="/dashboard">Go to Dashboard</a>
</Button>
```

### Card

Card component with header, content, and footer sections.

**Sub-components:**
- `Card` - Root card container
- `CardHeader` - Card header section
- `CardTitle` - Card title
- `CardDescription` - Card description text
- `CardContent` - Main card content
- `CardFooter` - Card footer section
- `CardAction` - Action button area in header

**Usage:**
```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/app/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

### Accordion

Collapsible accordion component for FAQ sections and expandable content.

**Sub-components:**
- `Accordion` - Root accordion container
- `AccordionItem` - Individual accordion item
- `AccordionTrigger` - Clickable trigger (includes chevron icon)
- `AccordionContent` - Collapsible content area

**Usage:**
```tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/app/components/ui/accordion';

<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Is it accessible?</AccordionTrigger>
    <AccordionContent>
      Yes. It adheres to the WAI-ARIA design pattern.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Is it styled?</AccordionTrigger>
    <AccordionContent>
      Yes. It comes with default styles that matches your design system.
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Input

Styled input field with focus states and validation support.

**Usage:**
```tsx
import { Input } from '@/app/components/ui/input';

<Input type="email" placeholder="Email address" />
<Input type="text" aria-invalid="true" /> {/* Shows error state */}
```

### Textarea

Styled textarea with auto-sizing and validation support.

**Usage:**
```tsx
import { Textarea } from '@/app/components/ui/textarea';

<Textarea placeholder="Enter your message..." />
<Textarea aria-invalid="true" /> {/* Shows error state */}
```

### Label

Accessible form label component.

**Usage:**
```tsx
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';

<div className="flex flex-col gap-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</div>
```

## Design System Integration

All components are integrated with the design system defined in `/app/globals.css`:

### Color Tokens
- `bg-primary` - Primary brand blue (#3B82F6 equivalent)
- `bg-secondary` - Secondary purple (#A855F7 equivalent)
- `bg-card` - Card background
- `text-muted-foreground` - Muted text color
- `border` - Border color

### Dark Mode
All components automatically support dark mode via the `.dark` class on the root element.

### Accessibility
- Proper ARIA attributes
- Keyboard navigation support
- Focus visible states with ring utility
- Screen reader friendly
- Color contrast compliant (WCAG AA)

## Example: Contact Form

```tsx
import { Button } from '@/app/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';

export default function ContactForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Us</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Your name" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" placeholder="Your message..." />
          </div>
          <Button type="submit">Send Message</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

## Example: FAQ Section

```tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/app/components/ui/accordion';

export default function FAQ() {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-heading-2 mb-6">Frequently Asked Questions</h2>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>What is Record?</AccordionTrigger>
          <AccordionContent>
            Record is an AI-powered knowledge management platform that combines
            browser-based recording, automatic transcription, and intelligent
            document generation.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>How does transcription work?</AccordionTrigger>
          <AccordionContent>
            We use OpenAI Whisper to automatically transcribe your recordings
            with high accuracy, including word-level timestamps.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>What browsers are supported?</AccordionTrigger>
          <AccordionContent>
            Record requires Chrome or Chromium-based browsers for the recording
            features (Chrome, Edge, Brave, etc.).
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
```

## Customization

All components accept a `className` prop for additional customization:

```tsx
<Button className="w-full" variant="default">
  Full width button
</Button>

<Card className="max-w-md">
  {/* Card content */}
</Card>
```

## TypeScript Support

All components are fully typed with TypeScript. They extend the base HTML element types and include proper prop interfaces.

```tsx
// Button extends button element
<Button onClick={(e) => console.log(e)} />

// Input extends input element
<Input onChange={(e) => console.log(e.target.value)} />
```
