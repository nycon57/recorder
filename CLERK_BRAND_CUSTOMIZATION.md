# Clerk Brand Customization

## Overview

This document outlines the customization of Clerk authentication components to match shadcn/ui component styling and the Record brand guidelines.

All Clerk components now use **Tailwind utility classes** directly, matching shadcn's exact patterns for consistency across your entire application.

## What Was Changed

### 1. Created Centralized Appearance Configuration

**File**: `lib/clerk/appearance.ts`

A comprehensive Clerk appearance configuration using **Tailwind utility classes** that matches shadcn/ui patterns:

- **CSS Layer Configuration**: Required for Tailwind CSS v4 compatibility
- **shadcn Component Patterns**:
  - **Inputs**: `h-9 px-3 rounded-md border border-input bg-transparent dark:bg-input/30`
  - **Buttons**: `h-9 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90`
  - **Focus States**: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`
  - **Validation**: `aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40`
  - **Cards**: `bg-card border rounded-xl shadow-sm`
- **Brand Colors**: Uses CSS variables from your theme
  - Primary: Orange/coral (`hsl(var(--primary))`)
  - Font: Geist
  - Border radius: 0.5rem (md), 0.75rem (xl)
- **Dark Mode Support**: Full dark mode with `dark:` prefix
- **Comprehensive Element Styling**: 50+ Clerk elements styled including:
  - Form inputs, buttons, labels
  - Social authentication buttons
  - User profile components
  - Organization switcher
  - Modals, alerts, and popovers
  - Tables, tabs, breadcrumbs
  - Checkboxes, radio buttons, selects
  - OTP inputs, phone inputs
  - And more...

### 2. Updated Global Styles

**File**: `app/globals.css`

Added CSS layer configuration for Tailwind v4:
```css
@layer theme, base, clerk, components, utilities;
```

This ensures Clerk styles are properly ordered in the cascade, allowing Tailwind utilities to override them when needed.

### 3. Applied Configuration Globally

**File**: `app/layout.tsx`

Applied the appearance configuration to `<ClerkProvider>`:
```tsx
<ClerkProvider appearance={clerkAppearance}>
```

This means all Clerk components throughout your app will automatically use these styles.

### 4. Simplified Sign-In and Sign-Up Pages

**Files**:
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- `app/(auth)/sign-up/[[...sign-up]]/page.tsx`

Removed redundant appearance props since styling is now applied globally.

## Features

### shadcn/ui Component Consistency

All Clerk components now use the **exact same Tailwind patterns** as your shadcn components:

**Input Pattern** (matches `app/components/ui/input.tsx`):
```
h-9 px-3 py-1 rounded-md border border-input bg-transparent dark:bg-input/30
text-foreground shadow-xs transition-all placeholder:text-muted-foreground
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive
```

**Button Pattern** (matches `app/components/ui/button.tsx`):
```
h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold shadow-xs
transition-all hover:bg-primary/90 active:bg-primary/80
disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
```

**Card Pattern** (matches `app/components/ui/card.tsx`):
```
bg-card text-card-foreground border rounded-xl shadow-sm py-6
```

### Automatic Theme Adaptation

The configuration uses Tailwind classes with CSS variables, which means:
- ✅ Automatically adapts to light/dark mode
- ✅ Respects your custom theme colors
- ✅ Maintains pixel-perfect consistency with shadcn components
- ✅ Uses exact same focus rings, shadows, and transitions

### Comprehensive Coverage

All Clerk components are styled, including:

**Authentication Components**:
- `<SignIn />` - Sign-in form
- `<SignUp />` - Sign-up form
- Social authentication buttons
- Email/password forms
- OTP (one-time password) inputs

**User Management**:
- `<UserButton />` - User dropdown menu
- `<UserProfile />` - User profile page
- `<OrganizationSwitcher />` - Organization selector

**UI Elements**:
- Form inputs and labels
- Buttons (primary, secondary, danger)
- Alerts and notices
- Modals and popovers
- Avatars and badges

### Design Consistency

All elements follow shadcn/ui design patterns exactly:
- **Typography**: Geist font family, consistent text sizes
- **Spacing**: `h-9` for inputs/buttons, `px-3` horizontal, `py-1` vertical
- **Colors**: Semantic tokens (primary, destructive, muted, accent, etc.)
- **Borders**: `rounded-md` for inputs/buttons, `rounded-xl` for cards
- **Shadows**: `shadow-xs` for inputs/buttons, `shadow-sm` for cards, `shadow-xl` for modals
- **Focus States**: `focus-visible:ring-ring/50 focus-visible:ring-[3px]` on all interactive elements
- **Validation States**: `aria-invalid:ring-destructive/20` with dark mode variants
- **Transitions**: `transition-all` for smooth state changes
- **Dark Mode**: Full support with `dark:` prefix (e.g., `dark:bg-input/30`)

## Usage

### Global Styling

Since the appearance is applied to `<ClerkProvider>`, all Clerk components automatically inherit the styling:

```tsx
// No appearance prop needed!
<SignIn />
<SignUp />
<UserButton />
<OrganizationSwitcher />
```

### Component-Specific Overrides

If you need to override styles for a specific component, you can still pass an `appearance` prop with Tailwind classes:

```tsx
<SignIn
  appearance={{
    elements: {
      // Override with custom Tailwind classes
      formButtonPrimary: 'h-10 px-6 text-lg bg-gradient-to-r from-orange-500 to-red-500',
      card: 'shadow-2xl rounded-2xl',
    },
  }}
/>
```

Component-specific styles will merge with the global configuration. Always use Tailwind utility classes for consistency.

### Layout-Specific Customization

For layout adjustments that don't affect the theme (like width, positioning), you can use the `elements` prop:

```tsx
<OrganizationSwitcher
  appearance={{
    elements: {
      rootBox: 'w-full',
      organizationSwitcherTrigger: 'justify-start',
    },
  }}
/>
```

This is already done in the `<AppSidebar>` component at `app/components/layout/app-sidebar.tsx:101-109`.

## Customization

To customize the Clerk appearance:

1. **Edit the configuration**: `lib/clerk/appearance.ts`
2. **Use Tailwind utility classes**: Leverage your existing design system
3. **Match shadcn patterns**: Reference existing components in `app/components/ui/`
4. **Test in light and dark mode**: Ensure it looks good in both themes
5. **Restart dev server**: Changes to the configuration file require a restart

### Example Customizations

**Make buttons larger**:
```ts
formButtonPrimary:
  'h-10 px-6 rounded-md bg-primary text-primary-foreground font-semibold shadow-xs transition-all hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
```

**Adjust card styling**:
```ts
card: 'bg-card text-card-foreground border rounded-2xl shadow-md py-8',
```

**Customize input appearance**:
```ts
formFieldInput:
  'h-10 px-4 py-2 rounded-lg border-2 border-input bg-muted/50 dark:bg-input/30 text-foreground shadow-xs transition-all placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px]',
```

**Add custom focus color**:
```ts
// Just change the color in the class string
'focus-visible:border-orange-500 focus-visible:ring-orange-500/50'
```

## Browser Testing

Test the sign-in/sign-up flows in both light and dark mode:

1. **Light Mode**: Visit `/sign-in` and `/sign-up`
2. **Dark Mode**: Toggle dark mode and revisit
3. **Forms**: Test input focus states, validation errors
4. **Social Auth**: Check social button styling
5. **Organization**: If enabled, test `<OrganizationSwitcher>`

## Resources

- [Clerk Appearance Prop Documentation](https://clerk.com/docs/components/customization/overview)
- [Clerk Elements Reference](https://clerk.com/docs/components/customization/elements)
- [Tailwind CSS v4 Layers](https://tailwindcss.com/docs/adding-custom-styles#using-css-and-layer)

## Notes

- **Performance**: Centralized configuration reduces code duplication
- **Maintainability**: Single source of truth for Clerk styling
- **Flexibility**: Easy to override on a per-component basis
- **Type Safety**: Full TypeScript support with `Appearance` type
- **Future-Proof**: Uses CSS variables that adapt to theme changes
