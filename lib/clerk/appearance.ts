/**
 * Clerk Appearance Configuration
 * Centralized theming for all Clerk components using Tailwind utility classes
 *
 * Matches shadcn/ui component patterns:
 * - Consistent focus states with ring patterns
 * - Validation states with aria-invalid
 * - Dark mode support
 * - Proper transitions and shadows
 *
 * Font: Geist
 * Border radius: 0.5rem (md), 0.75rem (xl)
 * Dark mode: Full support via dark: prefix
 */

import type { Appearance } from '@clerk/types';

/**
 * Main appearance configuration for Clerk components
 * Applied globally through ClerkProvider
 */
export const clerkAppearance: Appearance = {
  // Note: cssLayerName removed temporarily due to compatibility issues
  // cssLayerName: 'clerk',

  variables: {
    // Brand colors
    colorPrimary: 'hsl(var(--primary))',
    colorDanger: 'hsl(var(--destructive))',
    colorSuccess: 'hsl(var(--chart-4))',
    colorWarning: 'hsl(var(--chart-1))',

    // Text colors
    colorText: 'hsl(var(--foreground))',
    colorTextOnPrimaryBackground: 'hsl(var(--primary-foreground))',
    colorTextSecondary: 'hsl(var(--muted-foreground))',

    // Background colors
    colorBackground: 'hsl(var(--background))',
    colorInputBackground: 'hsl(var(--background))',
    colorInputText: 'hsl(var(--foreground))',

    // Border
    borderRadius: '0.5rem',
    colorBorder: 'hsl(var(--border))',

    // Typography
    fontFamily: 'Geist, ui-sans-serif, sans-serif, system-ui',
    fontFamilyButtons: 'Geist, ui-sans-serif, sans-serif, system-ui',
    fontSize: '16px',
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  elements: {
    // Root container
    rootBox: 'w-full max-w-[400px]',

    // Card styling - matches shadcn card pattern
    card: 'bg-card text-card-foreground border rounded-xl shadow-sm py-6',
    cardBox: 'px-6',

    // Header
    headerTitle: 'text-2xl font-bold text-foreground',
    headerSubtitle: 'text-sm text-muted-foreground',

    // Social buttons - matches shadcn button outline variant
    socialButtonsBlockButton:
      'border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-md shadow-xs transition-all focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    socialButtonsBlockButtonText: 'text-sm font-medium',
    socialButtonsIconButton:
      'border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9 rounded-md shadow-xs transition-all focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',

    // Divider
    dividerLine: 'bg-border',
    dividerText: 'text-muted-foreground text-sm',

    // Form elements - matches shadcn input pattern
    formFieldLabel: 'text-sm font-medium text-foreground mb-2',
    formFieldInput:
      'h-9 px-3 py-1 rounded-md border border-input bg-transparent dark:bg-input/30 text-foreground shadow-xs transition-all placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    formFieldInputShowPasswordButton:
      'text-muted-foreground hover:text-foreground transition-colors',
    formFieldHintText: 'text-sm text-muted-foreground',
    formFieldErrorText: 'text-sm text-destructive font-medium',
    formFieldSuccessText: 'text-sm text-chart-4 font-medium',
    formFieldWarningText: 'text-sm text-chart-1 font-medium',

    // Buttons - matches shadcn button primary variant
    formButtonPrimary:
      'h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold shadow-xs transition-all hover:bg-primary/90 active:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    // Secondary button - matches shadcn button secondary variant
    formButtonReset:
      'h-9 px-3 rounded-md bg-secondary text-secondary-foreground font-semibold border border-input shadow-xs transition-all hover:bg-secondary/80 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',

    // Footer links
    footerActionLink: 'text-primary font-semibold hover:underline transition-all',
    footerActionText: 'text-muted-foreground text-sm',
    footerPages: 'px-6 py-4',

    // Identity preview (user info display)
    identityPreview: 'bg-muted rounded-md p-3',
    identityPreviewText: 'text-foreground text-sm',
    identityPreviewEditButton: 'text-primary text-sm font-semibold hover:underline',

    // OTP (One-Time Password) input - larger, centered digits
    otpCodeFieldInput:
      'h-12 w-12 rounded-md border border-input bg-transparent dark:bg-input/30 text-foreground text-xl font-semibold text-center shadow-xs transition-all focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',

    // Alert/Notice - matches shadcn alert pattern
    alert: 'bg-muted rounded-md p-3 text-sm',
    alertText: 'text-foreground',

    // Modal backdrop
    modalBackdrop: 'bg-background/80 backdrop-blur-sm',
    modalContent: 'bg-card border rounded-xl shadow-xl',

    // Avatar
    avatarBox: 'w-10 h-10 rounded-full',
    avatarImage: 'rounded-full',

    // Badge
    badge: 'bg-accent text-accent-foreground text-xs font-semibold px-2 py-0.5 rounded-sm',

    // Navbar (for UserButton)
    navbar: 'bg-background border-b border-border',

    // User button
    userButtonBox: 'w-10 h-10',
    userButtonTrigger:
      'rounded-full transition-all focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    userButtonPopoverCard:
      'bg-card text-card-foreground border rounded-xl shadow-sm min-w-[240px]',
    userButtonPopoverActionButton:
      'text-foreground text-sm px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-all w-full text-left',
    userButtonPopoverActionButtonText: 'text-sm',
    userButtonPopoverActionButtonIcon: 'w-4 h-4',
    userButtonPopoverFooter: 'border-t border-border pt-2 mt-2',

    // Organization switcher - matches shadcn button outline
    organizationSwitcherTrigger:
      'h-9 px-3 rounded-md bg-background border border-input text-sm hover:bg-accent hover:text-accent-foreground transition-all focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    organizationSwitcherTriggerIcon: 'text-muted-foreground',
    organizationSwitcherPopoverCard:
      'bg-card text-card-foreground border rounded-xl shadow-sm min-w-[280px]',
    organizationSwitcherPopoverActions: 'px-2 py-2',
    organizationSwitcherPopoverActionButton:
      'text-foreground text-sm px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-all w-full text-left',

    // Profile section (in user button dropdown)
    userPreview: 'p-3 border-b border-border',
    userPreviewMainIdentifier: 'text-sm font-semibold text-foreground',
    userPreviewSecondaryIdentifier: 'text-xs text-muted-foreground',
    userPreviewAvatarBox: 'w-10 h-10 rounded-full',

    // Menu list items
    menuList: 'p-1',
    menuItem:
      'px-3 py-2 rounded-md text-sm text-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all',

    // Page scrollbox
    pageScrollBox: 'p-6',

    // Profile page
    profilePage: 'p-0',
    profileSection: 'py-4 border-b border-border',
    profileSectionTitle: 'text-base font-semibold text-foreground mb-3',
    profileSectionTitleText: 'text-base font-semibold',
    profileSectionContent: 'text-sm text-foreground',
    profileSectionPrimaryButton:
      'h-9 px-3 rounded-md bg-primary text-primary-foreground font-semibold shadow-xs transition-all hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',

    // Account page
    accordionTriggerButton:
      'w-full px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-all',
    accordionContent: 'px-4 py-3',

    // Back link
    backLink: 'text-muted-foreground text-sm hover:text-foreground transition-colors',

    // Form container
    form: 'space-y-4',
    formFieldRow: 'space-y-2',

    // Select input - matches shadcn select pattern
    selectButton:
      'h-9 px-3 py-1 rounded-md border border-input bg-transparent dark:bg-input/30 text-foreground shadow-xs transition-all hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    selectOptionsContainer: 'bg-card border rounded-md shadow-sm mt-1 max-h-[300px] overflow-auto',
    selectOption:
      'px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all',
    selectOptionSelected: 'bg-accent text-accent-foreground',

    // Checkbox - matches shadcn checkbox pattern
    formFieldCheckbox:
      'h-4 w-4 rounded border border-input bg-transparent checked:bg-primary checked:border-primary transition-all focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    formFieldCheckboxLabel: 'text-sm font-medium text-foreground',

    // Radio - matches shadcn radio pattern
    formFieldRadio:
      'h-4 w-4 rounded-full border border-input bg-transparent checked:bg-primary checked:border-primary transition-all focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    formFieldRadioLabel: 'text-sm font-medium text-foreground',

    // Phone input
    phoneInputBox: 'flex items-center space-x-2',
    phoneInputCountryCode:
      'h-9 px-3 py-1 rounded-md border border-input bg-transparent dark:bg-input/30 text-foreground shadow-xs transition-all focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',

    // Verification code input
    verificationInputBox: 'flex items-center justify-center space-x-2',

    // Loading spinner
    spinner: 'text-primary',

    // Organization preview
    organizationPreview: 'p-3 border-b border-border',
    organizationPreviewAvatarBox: 'w-10 h-10 rounded-md',
    organizationPreviewMainIdentifier: 'text-sm font-semibold text-foreground',
    organizationPreviewSecondaryIdentifier: 'text-xs text-muted-foreground',

    // Create organization
    organizationSwitcherPopoverActionButton__createOrganization:
      'text-primary text-sm px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-all w-full text-left font-semibold',
    organizationSwitcherPopoverActionButton__manageOrganization:
      'text-foreground text-sm px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-all w-full text-left',

    // Tabs - matches shadcn tabs pattern
    tabListContainer: 'border-b border-border',
    tabButton:
      'px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground',
    tabPanel: 'py-4',

    // Table - matches shadcn table pattern
    table: 'w-full border-collapse',
    tableHead: 'border-b border-border',
    tableHeadRow: 'border-b border-border',
    tableHeadCell: 'px-4 py-3 text-left text-sm font-semibold text-foreground',
    tableBody: '',
    tableRow: 'border-b border-border hover:bg-muted/50 transition-colors',
    tableCell: 'px-4 py-3 text-sm text-foreground',

    // Breadcrumbs
    breadcrumbs: 'flex items-center space-x-2 text-sm text-muted-foreground',
    breadcrumbsItem: 'hover:text-foreground transition-colors',
    breadcrumbsItemDivider: 'text-muted-foreground',

    // Tag input (for multi-select)
    tagInputContainer: 'flex flex-wrap gap-2 p-2 border border-input rounded-md bg-transparent dark:bg-input/30',
    tagPill: 'inline-flex items-center px-2 py-1 text-xs font-medium bg-accent text-accent-foreground rounded-sm',
    tagPillRemoveButton: 'ml-1 text-muted-foreground hover:text-foreground',
  },
};
