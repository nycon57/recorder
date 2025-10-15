'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { addDays, format, startOfToday, startOfWeek, startOfMonth, subDays, subMonths } from 'date-fns';

import { Button } from '@/app/components/ui/button';
import { Calendar } from '@/app/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { cn } from '@/lib/utils';

export interface DateRange {
  from: Date | undefined;
  to?: Date | undefined;
}

interface DateRangePickerProps {
  from: Date | undefined;
  to: Date | undefined;
  onSelect: (range: DateRange | undefined) => void;
  className?: string;
}

const PRESETS = [
  { label: 'Today', getValue: () => ({ from: startOfToday(), to: startOfToday() }) },
  { label: 'Last 7 days', getValue: () => ({ from: subDays(startOfToday(), 7), to: startOfToday() }) },
  { label: 'Last 30 days', getValue: () => ({ from: subDays(startOfToday(), 30), to: startOfToday() }) },
  { label: 'Last 3 months', getValue: () => ({ from: subMonths(startOfToday(), 3), to: startOfToday() }) },
  { label: 'This week', getValue: () => ({ from: startOfWeek(startOfToday()), to: startOfToday() }) },
  { label: 'This month', getValue: () => ({ from: startOfMonth(startOfToday()), to: startOfToday() }) },
];

/**
 * DateRangePicker Component
 * Date range selector with presets
 *
 * Features:
 * - Calendar picker
 * - Quick preset buttons
 * - Clear selection
 * - Accessible date picker
 *
 * Usage:
 * <DateRangePicker
 *   from={startDate}
 *   to={endDate}
 *   onSelect={handleDateChange}
 * />
 */
export function DateRangePicker({
  from,
  to,
  onSelect,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handlePreset = (preset: typeof PRESETS[0]) => {
    const range = preset.getValue();
    onSelect(range);
    setOpen(false);
  };

  const formatDateRange = () => {
    if (!from && !to) return null;
    if (from && to) {
      return `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`;
    }
    if (from) {
      return `From ${format(from, 'MMM d, yyyy')}`;
    }
    if (to) {
      return `Until ${format(to, 'MMM d, yyyy')}`;
    }
    return null;
  };

  const displayText = formatDateRange();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !displayText && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {displayText || 'Pick a date range'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          <div className="border-r p-2 space-y-1">
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                onClick={() => handlePreset(preset)}
                className="w-full justify-start text-sm font-normal"
              >
                {preset.label}
              </Button>
            ))}
            {displayText && (
              <>
                <div className="my-2 border-t" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelect(undefined);
                    setOpen(false);
                  }}
                  className="w-full justify-start text-sm font-normal"
                >
                  Clear
                </Button>
              </>
            )}
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              defaultMonth={from || undefined}
              selected={{ from: from || undefined, to: to || undefined }}
              onSelect={onSelect}
              numberOfMonths={2}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
