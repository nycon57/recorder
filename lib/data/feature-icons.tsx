/**
 * Feature Icons Map
 *
 * Maps string icon names to Lucide React components.
 * This is necessary to avoid Server/Client Component serialization issues.
 *
 * Usage:
 * import { getFeatureIcon, FeatureIcon } from '@/lib/data/feature-icons';
 *
 * // Option 1: Get the component
 * const IconComponent = getFeatureIcon('Bot');
 * <IconComponent className="h-5 w-5" />
 *
 * // Option 2: Use the convenience component
 * <FeatureIcon name="Bot" className="h-5 w-5" />
 */

import {
  Video,
  Mic,
  Search,
  Bot,
  FileText,
  Users,
  Zap,
  Clock,
  Globe,
  Brain,
  Target,
  Layers,
  Network,
  ArrowUpRight,
  Shield,
  Sparkles,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

import type { IconName } from './features';

/**
 * Map of icon names to Lucide components
 */
export const ICON_MAP: Record<IconName, LucideIcon> = {
  Video,
  Mic,
  Search,
  Bot,
  FileText,
  Users,
  Zap,
  Clock,
  Globe,
  Brain,
  Target,
  Layers,
  Network,
  ArrowUpRight,
  Shield,
  Sparkles,
};

/**
 * Get a Lucide icon component by name
 */
export function getFeatureIcon(name: IconName): LucideIcon {
  return ICON_MAP[name];
}

/**
 * Convenience component for rendering feature icons
 */
interface FeatureIconProps extends LucideProps {
  name: IconName;
}

export function FeatureIcon({ name, ...props }: FeatureIconProps) {
  const IconComponent = ICON_MAP[name];
  return <IconComponent {...props} />;
}
