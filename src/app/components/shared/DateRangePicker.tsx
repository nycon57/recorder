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
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    setLocalFrom(date);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value) : undefined;
    setLocalTo(date);
  };

  const handleApply = () => {
    onDateChange(localFrom, localTo);
    setIsOpen(false);
  };

  const handleClear = () => {
    setLocalFrom(undefined);
    setLocalTo(undefined);
    onDateChange(undefined, undefined);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-[280px] justify-start text-left font-normal',
            !from && !to && 'text-muted-foreground',
            className
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {from && to ? (
            <>
              {format(from, 'MMM dd, yyyy')} - {format(to, 'MMM dd, yyyy')}
            </>
          ) : from ? (
            <>
              {format(from, 'MMM dd, yyyy')} - ...
            </>
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">From</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-md"
              value={localFrom ? format(localFrom, 'yyyy-MM-dd') : ''}
              onChange={handleFromChange}
              max={localTo ? format(localTo, 'yyyy-MM-dd') : undefined}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">To</label>
            <input
              type="date"
              className="w-full px-3 py-2 border rounded-md"
              value={localTo ? format(localTo, 'yyyy-MM-dd') : ''}
              onChange={handleToChange}
              min={localFrom ? format(localFrom, 'yyyy-MM-dd') : undefined}
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