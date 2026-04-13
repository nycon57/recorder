'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Calendar } from '@/app/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { cn } from '@/lib/utils';

interface PointInTimeFilterProps {
  earliestDate: string;
  selectedDate: Date | null;
  onDateChange: (date: Date | null) => void;
}

export function PointInTimeFilter({
  earliestDate,
  selectedDate,
  onDateChange,
}: PointInTimeFilterProps) {
  const [open, setOpen] = useState(false);

  const earliest = new Date(earliestDate);
  const today = new Date();

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate
              ? format(selectedDate, 'MMM d, yyyy')
              : 'Point in time'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(date) => {
              onDateChange(date ?? null);
              setOpen(false);
            }}
            disabled={(date) => date < earliest || date > today}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {selectedDate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(null)}
          className="h-8 px-2"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
