'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { Input } from './input';
import { Label } from './label';

/**
 * Default key-value pair structure
 */
export interface KeyValuePair {
  key: string;
  value: string;
}

/**
 * Single value structure (for tags, emails, etc.)
 */
export interface SingleValue {
  value: string;
}

/**
 * Props for the DynamicFieldArray component
 */
export interface DynamicFieldArrayProps<T = KeyValuePair> {
  // Data
  value: T[];
  onChange: (value: T[]) => void;

  // Configuration
  type?: 'key-value' | 'single';

  // Labels
  label?: string;
  description?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  singlePlaceholder?: string;
  addButtonLabel?: string;

  // Field config (for key-value)
  keyFieldType?: 'text' | 'password';
  valueFieldType?: 'text' | 'password' | 'number';

  // Validation
  minItems?: number; // Default: 1
  maxItems?: number;

  // Icons
  removeIcon?: React.ReactNode;
  addIcon?: React.ReactNode;

  // Styling
  className?: string;
  fieldClassName?: string;
  buttonClassName?: string;

  // Accessibility
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Type guard to check if the type is key-value
 */
function isKeyValuePair(item: unknown): item is KeyValuePair {
  return (
    typeof item === 'object' &&
    item !== null &&
    'key' in item &&
    'value' in item
  );
}

/**
 * Type guard to check if the type is single value
 */
function isSingleValue(item: unknown): item is SingleValue {
  return typeof item === 'object' && item !== null && 'value' in item && !('key' in item);
}

/**
 * DynamicFieldArray Component
 *
 * A reusable component for managing arrays of fields (key-value pairs or single values).
 * Eliminates boilerplate code for add/remove/update operations.
 *
 * @example
 * // Key-Value Pairs (headers, env vars):
 * <DynamicFieldArray
 *   value={customHeaders}
 *   onChange={setCustomHeaders}
 *   type="key-value"
 *   label="Custom Headers"
 *   description="Add custom headers for authentication or identification"
 *   keyPlaceholder="Header name (e.g., X-API-Key)"
 *   valuePlaceholder="Header value"
 *   valueFieldType="password"
 *   addButtonLabel="Add Header"
 *   minItems={1}
 * />
 *
 * @example
 * // Single Values (tags, emails):
 * <DynamicFieldArray
 *   value={tags}
 *   onChange={setTags}
 *   type="single"
 *   label="Tags"
 *   description="Add tags to categorize this item"
 *   singlePlaceholder="Enter tag name"
 *   addButtonLabel="Add Tag"
 *   minItems={0}
 * />
 */
export function DynamicFieldArray<T = KeyValuePair>({
  value,
  onChange,
  type = 'key-value',
  label,
  description,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  singlePlaceholder = 'Value',
  addButtonLabel = 'Add Item',
  keyFieldType = 'text',
  valueFieldType = 'text',
  minItems = 1,
  maxItems,
  removeIcon,
  addIcon,
  className,
  fieldClassName,
  buttonClassName,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: DynamicFieldArrayProps<T>) {
  const componentId = React.useId();
  const fieldsetId = id || `dynamic-field-array-${componentId}`;
  const descriptionId = description ? `${fieldsetId}-description` : undefined;

  /**
   * Add a new item to the array
   */
  const handleAdd = React.useCallback(() => {
    if (maxItems && value.length >= maxItems) {
      return;
    }

    const newItem =
      type === 'key-value'
        ? ({ key: '', value: '' } as T)
        : ({ value: '' } as T);

    onChange([...value, newItem]);
  }, [value, onChange, type, maxItems]);

  /**
   * Remove an item from the array
   */
  const handleRemove = React.useCallback(
    (index: number) => {
      if (value.length <= minItems) {
        return;
      }

      const updated = value.filter((_, i) => i !== index);
      onChange(updated);
    },
    [value, onChange, minItems]
  );

  /**
   * Update a key-value pair field
   */
  const handleUpdateKeyValue = React.useCallback(
    (index: number, field: 'key' | 'value', newValue: string) => {
      const updated = [...value];
      const item = updated[index];

      if (isKeyValuePair(item)) {
        updated[index] = { ...item, [field]: newValue } as T;
        onChange(updated);
      }
    },
    [value, onChange]
  );

  /**
   * Update a single value field
   */
  const handleUpdateSingle = React.useCallback(
    (index: number, newValue: string) => {
      const updated = [...value];
      const item = updated[index];

      if (isSingleValue(item)) {
        updated[index] = { value: newValue } as T;
        onChange(updated);
      }
    },
    [value, onChange]
  );

  const canRemove = value.length > minItems;
  const canAdd = !maxItems || value.length < maxItems;

  const removeIconElement = removeIcon || <Trash2 className="h-4 w-4" />;
  const addIconElement = addIcon || <Plus className="h-4 w-4 mr-2" />;

  return (
    <fieldset
      id={fieldsetId}
      aria-label={ariaLabel || label}
      aria-describedby={ariaDescribedBy || descriptionId}
      className={cn('space-y-2', className)}
    >
      {label && (
        <Label htmlFor={`${fieldsetId}-0`} className="text-sm font-medium">
          {label}
        </Label>
      )}

      {description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}

      <div className="space-y-2">
        {value.map((item, index) => (
          <div
            key={index}
            className={cn('flex gap-2 items-start', fieldClassName)}
          >
            {type === 'key-value' ? (
              <>
                {isKeyValuePair(item) && (
                  <>
                    <Input
                      id={index === 0 ? `${fieldsetId}-0` : undefined}
                      type={keyFieldType}
                      placeholder={keyPlaceholder}
                      value={item.key}
                      onChange={(e) =>
                        handleUpdateKeyValue(index, 'key', e.target.value)
                      }
                      aria-label={`${label || 'Field'} ${index + 1} key`}
                      className="flex-1"
                    />
                    <Input
                      type={valueFieldType}
                      placeholder={valuePlaceholder}
                      value={item.value}
                      onChange={(e) =>
                        handleUpdateKeyValue(index, 'value', e.target.value)
                      }
                      aria-label={`${label || 'Field'} ${index + 1} value`}
                      className="flex-1"
                    />
                  </>
                )}
              </>
            ) : (
              <>
                {isSingleValue(item) && (
                  <Input
                    id={index === 0 ? `${fieldsetId}-0` : undefined}
                    type="text"
                    placeholder={singlePlaceholder}
                    value={item.value}
                    onChange={(e) => handleUpdateSingle(index, e.target.value)}
                    aria-label={`${label || 'Field'} ${index + 1}`}
                    className="flex-1"
                  />
                )}
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemove(index)}
              disabled={!canRemove}
              aria-label={`Remove ${label || 'item'} ${index + 1}`}
              className={cn('shrink-0', buttonClassName)}
            >
              {removeIconElement}
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!canAdd}
          aria-label={addButtonLabel}
          className={cn('mt-2', buttonClassName)}
        >
          {addIconElement}
          {addButtonLabel}
        </Button>
      </div>
    </fieldset>
  );
}

/**
 * Helper function to convert key-value pairs to object
 * Filters out empty pairs
 */
export function keyValuePairsToObject(
  pairs: KeyValuePair[]
): Record<string, string> {
  return pairs.reduce(
    (acc, { key, value }) => {
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    },
    {} as Record<string, string>
  );
}

/**
 * Helper function to convert object to key-value pairs
 */
export function objectToKeyValuePairs(obj: Record<string, string>): KeyValuePair[] {
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}

/**
 * Helper function to convert single values to array of strings
 * Filters out empty values
 */
export function singleValuesToArray(values: SingleValue[]): string[] {
  return values.map(({ value }) => value).filter(Boolean);
}

/**
 * Helper function to convert array of strings to single values
 */
export function arrayToSingleValues(arr: string[]): SingleValue[] {
  return arr.map((value) => ({ value }));
}
