'use client';

import {
  Sparkles,
  FileText,
  ClipboardList,
  GraduationCap,
  FileCheck,
  Presentation,
  FileX,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { ANALYSIS_TYPES, type AnalysisType } from '@/lib/services/analysis-templates';
import { cn } from '@/lib/utils';

/**
 * Map of icon names to Lucide icon components
 */
const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  ClipboardList,
  GraduationCap,
  FileCheck,
  Presentation,
  FileX,
};

/**
 * Get icon component by name
 */
function getIcon(iconName?: string): LucideIcon {
  if (!iconName || !ICON_MAP[iconName]) {
    return FileText;
  }
  return ICON_MAP[iconName];
}

interface ProcessingOptionsProps {
  /** Current analysis type */
  analysisType: AnalysisType;
  /** Callback when analysis type changes */
  onAnalysisTypeChange: (type: AnalysisType) => void;
  /** Whether to skip analysis entirely */
  skipAnalysis: boolean;
  /** Callback when skip analysis toggle changes */
  onSkipAnalysisChange: (skip: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ProcessingOptions Component
 *
 * Provides user controls for AI analysis settings:
 * - Toggle to skip AI analysis (transcript-only mode)
 * - Dropdown to select document type (when analysis is enabled)
 *
 * Features:
 * - Shows all analysis types with icons and descriptions
 * - Hides type selector when analysis is disabled
 * - Defaults to 'general' type (AI-Enhanced ON)
 * - Uses shadcn/ui components (Switch, Select, Card)
 * - Follows brand design guide (dark mode native, CSS variables)
 *
 * @example
 * ```tsx
 * const [analysisType, setAnalysisType] = useState<AnalysisType>('general');
 * const [skipAnalysis, setSkipAnalysis] = useState(false);
 *
 * <ProcessingOptions
 *   analysisType={analysisType}
 *   onAnalysisTypeChange={setAnalysisType}
 *   skipAnalysis={skipAnalysis}
 *   onSkipAnalysisChange={setSkipAnalysis}
 * />
 * ```
 */
export default function ProcessingOptions({
  analysisType,
  onAnalysisTypeChange,
  skipAnalysis,
  onSkipAnalysisChange,
  className,
}: ProcessingOptionsProps) {
  // Filter out 'none' from the dropdown (it's controlled by the toggle)
  const selectableTypes = ANALYSIS_TYPES.filter(type => type.value !== 'none');

  // Get current type details
  const currentType = ANALYSIS_TYPES.find(t => t.value === analysisType);

  /**
   * Handle toggle change
   * When turning analysis OFF, set type to 'none'
   * When turning analysis ON, set to 'general' (default)
   */
  const handleToggleChange = (checked: boolean) => {
    onSkipAnalysisChange(!checked); // Inverted: checked = enabled = !skip

    if (checked) {
      // Analysis enabled - set to general if currently none
      if (analysisType === 'none') {
        onAnalysisTypeChange('general');
      }
    } else {
      // Analysis disabled - set to none
      onAnalysisTypeChange('none');
    }
  };

  /**
   * Handle type selection from dropdown
   */
  const handleTypeChange = (value: AnalysisType) => {
    onAnalysisTypeChange(value);
  };

  const isAnalysisEnabled = !skipAnalysis;

  return (
    <Card className={cn('p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-accent" />
            AI-Enhanced Analysis
          </Label>
          <p className="text-xs text-muted-foreground">
            Generate structured documents from your content
          </p>
        </div>

        {/* Toggle Switch */}
        <Switch
          checked={isAnalysisEnabled}
          onCheckedChange={handleToggleChange}
          aria-label="Toggle AI analysis"
          className="data-[state=checked]:bg-accent"
        />
      </div>

      {/* Analysis Type Selector - Only visible when enabled */}
      {isAnalysisEnabled ? (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <Label htmlFor="analysis-type" className="text-sm font-medium">
            Document Type
          </Label>

          <Select value={analysisType} onValueChange={handleTypeChange}>
            <SelectTrigger id="analysis-type" className="w-full">
              <SelectValue>
                {(() => {
                  const CurrentIcon = getIcon(currentType?.icon);
                  return (
                    <div className="flex items-center gap-2">
                      <CurrentIcon className="size-4 text-muted-foreground" />
                      <span>{currentType?.label}</span>
                    </div>
                  );
                })()}
              </SelectValue>
            </SelectTrigger>

            <SelectContent>
              {selectableTypes.map((type) => {
                const TypeIcon = getIcon(type.icon);
                return (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-start gap-3 py-1">
                      <TypeIcon className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{type.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {type.description}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Description for selected type */}
          {currentType && (
            <p className="text-xs text-muted-foreground pl-1">
              {currentType.description}
            </p>
          )}
        </div>
      ) : (
        /* Transcript-only mode message */
        <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-md border border-border animate-in fade-in slide-in-from-top-2 duration-200">
          <FileText className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Transcript Only</p>
            <p className="text-xs text-muted-foreground mt-1">
              Content will be transcribed without AI analysis. Fastest processing time.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
