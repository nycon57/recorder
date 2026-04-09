'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion } from 'motion/react';

import { cn } from '@/lib/utils/cn';

/**
 * ContentTabs - Premium tabs component for content detail views
 *
 * Features:
 * - Aurora accent glow on active tab
 * - Smooth animated underline indicator
 * - Dark-mode native design
 * - Refined typography with proper weight hierarchy
 *
 * Usage:
 * <ContentTabs defaultValue="content">
 *   <ContentTabsList>
 *     <ContentTabsTrigger value="content" icon={<FileText />}>
 *       Original Content
 *     </ContentTabsTrigger>
 *     <ContentTabsTrigger value="insights" icon={<Sparkles />}>
 *       AI Insights
 *     </ContentTabsTrigger>
 *   </ContentTabsList>
 *   <ContentTabsContent value="content">...</ContentTabsContent>
 *   <ContentTabsContent value="insights">...</ContentTabsContent>
 * </ContentTabs>
 */

interface ContentTabsContextValue {
  activeTab: string;
  tabRects: Map<string, DOMRect>;
  registerTab: (value: string, rect: DOMRect) => void;
}

const ContentTabsContext = React.createContext<ContentTabsContextValue | null>(null);

function useContentTabsContext() {
  const context = React.useContext(ContentTabsContext);
  if (!context) {
    throw new Error('ContentTabs components must be used within ContentTabs');
  }
  return context;
}

interface ContentTabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  children: React.ReactNode;
}

function ContentTabs({ className, defaultValue, value, onValueChange, children, ...props }: ContentTabsProps) {
  const [activeTab, setActiveTab] = React.useState(value || defaultValue || '');
  const [tabRects, setTabRects] = React.useState<Map<string, DOMRect>>(new Map());

  const handleValueChange = (newValue: string) => {
    setActiveTab(newValue);
    onValueChange?.(newValue);
  };

  const registerTab = React.useCallback((tabValue: string, rect: DOMRect) => {
    setTabRects((prev) => {
      const next = new Map(prev);
      next.set(tabValue, rect);
      return next;
    });
  }, []);

  // Sync with controlled value
  React.useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value);
    }
  }, [value]);

  return (
    <ContentTabsContext.Provider value={{ activeTab, tabRects, registerTab }}>
      <TabsPrimitive.Root
        data-slot="content-tabs"
        className={cn('flex flex-col', className)}
        defaultValue={defaultValue}
        value={value}
        onValueChange={handleValueChange}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </ContentTabsContext.Provider>
  );
}

interface ContentTabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {
  children: React.ReactNode;
}

function ContentTabsList({ className, children, ...props }: ContentTabsListProps) {
  const { activeTab, tabRects } = useContentTabsContext();
  const listRef = React.useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState({ left: 0, width: 0 });

  // Calculate indicator position based on active tab
  React.useEffect(() => {
    const activeRect = tabRects.get(activeTab);
    const listRect = listRef.current?.getBoundingClientRect();

    if (activeRect && listRect) {
      setIndicatorStyle({
        left: activeRect.left - listRect.left,
        width: activeRect.width,
      });
    }
  }, [activeTab, tabRects]);

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="content-tabs-list"
      className={cn(
        'relative inline-flex w-full items-center border-b border-border/50',
        className
      )}
      {...props}
    >
      {children}

      {/* Animated underline indicator */}
      <motion.div
        className="absolute bottom-0 h-[2px] bg-accent"
        initial={false}
        animate={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 35,
        }}
      />
    </TabsPrimitive.List>
  );
}

interface ContentTabsTriggerProps extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function ContentTabsTrigger({ className, icon, children, value, ...props }: ContentTabsTriggerProps) {
  const { activeTab, registerTab } = useContentTabsContext();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const isActive = activeTab === value;

  // Register tab rect on mount and resize
  React.useEffect(() => {
    const updateRect = () => {
      if (triggerRef.current && value) {
        registerTab(value, triggerRef.current.getBoundingClientRect());
      }
    };

    updateRect();

    // Update on resize
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [value, registerTab]);

  return (
    <TabsPrimitive.Trigger
      ref={triggerRef}
      data-slot="content-tabs-trigger"
      value={value}
      className={cn(
        // Base styles
        'relative flex items-center justify-center gap-2.5 px-6 py-3.5',
        'text-sm font-medium tracking-wide transition-all duration-200',
        // Default state
        'text-muted-foreground/70 hover:text-foreground',
        // Active state
        'data-[state=active]:text-foreground',
        // Focus
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-t-md',
        // Disabled
        'disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...props}
    >
      {/* Icon */}
      {icon && (
        <span
          className={cn(
            'transition-colors duration-200',
            isActive && 'text-accent'
          )}
        >
          {icon}
        </span>
      )}

      {/* Label */}
      <span>{children}</span>
    </TabsPrimitive.Trigger>
  );
}

interface ContentTabsContentProps extends React.ComponentProps<typeof TabsPrimitive.Content> {
  children: React.ReactNode;
}

function ContentTabsContent({ className, children, ...props }: ContentTabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="content-tabs-content"
      className={cn(
        'mt-6 outline-none',
        // Fade in animation
        'data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2',
        'data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0',
        'duration-200',
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Content>
  );
}

export { ContentTabs, ContentTabsList, ContentTabsTrigger, ContentTabsContent };
