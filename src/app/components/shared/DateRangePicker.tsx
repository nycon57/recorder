'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  from?: Date;
  to?: Date;
  onDateChange: (from: Date | undefined, to: Date | undefined) => void;
  className?: string;
  placeholder?: string;
}

export function DateRangePicker({
  from,
  to,
  onDateChange,
  className,
  placeholder = 'Pick a date range',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<{
    from?: Date;
    to?: Date;
  }>({});

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftRange({ from, to });
    }
    setIsOpen(nextOpen);
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    setDraftRange((current) => ({ ...current, from: date }));
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    setDraftRange((current) => ({ ...current, to: date }));
  };

  const handleApply = () => {
    onDateChange(draftRange.from, draftRange.to);
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraftRange({});
    onDateChange(undefined, undefined);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !from && !to && 'text-muted-foreground',
            className,
          )}
        >
          <Calendar className="mr-2 size-4" />
          {from && to ? (
            <>
              {format(from, 'MMM dd, yyyy')} - {format(to, 'MMM dd, yyyy')}
            </>
          ) : from ? (
            <>{format(from, 'MMM dd, yyyy')} - ...</>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="date-range-from" className="text-sm font-medium">
              From
            </label>
            <input
              id="date-range-from"
              type="date"
              className="w-full px-3 py-2 border rounded-md"
              value={
                draftRange.from ? format(draftRange.from, 'yyyy-MM-dd') : ''
              }
              onChange={handleFromChange}
              max={
                draftRange.to ? format(draftRange.to, 'yyyy-MM-dd') : undefined
              }
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="date-range-to" className="text-sm font-medium">
              To
            </label>
            <input
              id="date-range-to"
              type="date"
              className="w-full px-3 py-2 border rounded-md"
              value={draftRange.to ? format(draftRange.to, 'yyyy-MM-dd') : ''}
              onChange={handleToChange}
              min={
                draftRange.from
                  ? format(draftRange.from, 'yyyy-MM-dd')
                  : undefined
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleApply}
              className="flex-1"
            >
              Apply
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleClear}
              className="flex-1"
            >
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
