/**
 * Usage Examples for DynamicFieldArray Component
 *
 * This file demonstrates how to use the DynamicFieldArray component
 * to replace ~60-70 lines of boilerplate code per usage.
 */

import { useState } from 'react';
import {
  DynamicFieldArray,
  KeyValuePair,
  SingleValue,
  keyValuePairsToObject,
  singleValuesToArray,
  objectToKeyValuePairs,
  arrayToSingleValues,
} from './dynamic-field-array';

/**
 * Example 1: Custom Headers (Key-Value Pairs with Password Field)
 *
 * BEFORE: ~70 lines of code (state management + handlers + JSX)
 * AFTER: ~10 lines of code
 */
export function CustomHeadersExample() {
  const [customHeaders, setCustomHeaders] = useState<KeyValuePair[]>([
    { key: '', value: '' },
  ]);

  const handleSubmit = () => {
    // Convert to object for API submission
    const headers = keyValuePairsToObject(customHeaders);
    console.log('Submitting headers:', headers);
    // API call with headers...
  };

  return (
    <div className="space-y-4">
      <DynamicFieldArray
        value={customHeaders}
        onChange={setCustomHeaders}
        type="key-value"
        label="Custom Headers"
        description="Add custom headers for authentication or identification"
        keyPlaceholder="Header name (e.g., X-API-Key)"
        valuePlaceholder="Header value"
        valueFieldType="password"
        addButtonLabel="Add Header"
        minItems={1}
      />

      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
}

/**
 * Example 2: Environment Variables (Key-Value Pairs with Text Fields)
 */
export function EnvironmentVariablesExample() {
  // Initialize from existing object
  const initialEnvVars = {
    NODE_ENV: 'production',
    API_URL: 'https://api.example.com',
  };

  const [envVars, setEnvVars] = useState<KeyValuePair[]>(
    objectToKeyValuePairs(initialEnvVars)
  );

  const handleSubmit = () => {
    const variables = keyValuePairsToObject(envVars);
    console.log('Environment variables:', variables);
  };

  return (
    <DynamicFieldArray
      value={envVars}
      onChange={setEnvVars}
      type="key-value"
      label="Environment Variables"
      description="Configure environment variables for your deployment"
      keyPlaceholder="Variable name (e.g., API_KEY)"
      valuePlaceholder="Variable value"
      addButtonLabel="Add Variable"
      minItems={0}
      maxItems={20}
    />
  );
}

/**
 * Example 3: Tags (Single Values)
 */
export function TagsExample() {
  const [tags, setTags] = useState<SingleValue[]>([]);

  const handleSubmit = () => {
    // Convert to array of strings
    const tagArray = singleValuesToArray(tags);
    console.log('Tags:', tagArray);
  };

  return (
    <DynamicFieldArray
      value={tags}
      onChange={setTags}
      type="single"
      label="Tags"
      description="Add tags to categorize this recording"
      singlePlaceholder="Enter tag name"
      addButtonLabel="Add Tag"
      minItems={0}
      maxItems={10}
    />
  );
}

/**
 * Example 4: Email List (Single Values)
 */
export function EmailListExample() {
  // Initialize from existing array
  const initialEmails = ['user1@example.com', 'user2@example.com'];

  const [emails, setEmails] = useState<SingleValue[]>(
    arrayToSingleValues(initialEmails)
  );

  const handleSubmit = () => {
    const emailArray = singleValuesToArray(emails);
    console.log('Emails:', emailArray);
  };

  return (
    <DynamicFieldArray
      value={emails}
      onChange={setEmails}
      type="single"
      label="Email Recipients"
      description="Add email addresses to receive notifications"
      singlePlaceholder="email@example.com"
      addButtonLabel="Add Email"
      minItems={1}
      maxItems={50}
    />
  );
}

/**
 * Example 5: API Query Parameters (Key-Value Pairs)
 */
export function QueryParametersExample() {
  const [params, setParams] = useState<KeyValuePair[]>([
    { key: '', value: '' },
  ]);

  return (
    <DynamicFieldArray
      value={params}
      onChange={setParams}
      type="key-value"
      label="Query Parameters"
      description="Add query parameters to append to the API URL"
      keyPlaceholder="Parameter name"
      valuePlaceholder="Parameter value"
      addButtonLabel="Add Parameter"
      minItems={0}
    />
  );
}

/**
 * Example 6: Custom Icons and Styling
 */
export function CustomStyledExample() {
  const [items, setItems] = useState<KeyValuePair[]>([{ key: '', value: '' }]);

  return (
    <DynamicFieldArray
      value={items}
      onChange={setItems}
      type="key-value"
      label="Custom Styled Fields"
      className="bg-muted/50 p-4 rounded-lg"
      fieldClassName="bg-background"
      buttonClassName="hover:bg-primary/10"
      keyPlaceholder="Key"
      valuePlaceholder="Value"
    />
  );
}

/**
 * Example 7: Integration with React Hook Form
 *
 * How to integrate DynamicFieldArray with React Hook Form
 */
export function ReactHookFormExample() {
  // Assuming you're using React Hook Form:
  // const form = useForm<FormData>({ ... });

  // Store headers in separate state
  const [customHeaders, setCustomHeaders] = useState<KeyValuePair[]>([
    { key: '', value: '' },
  ]);

  const onSubmit = (data: any) => {
    // Convert headers to object before submitting
    const headers = keyValuePairsToObject(customHeaders);
    const payload = {
      ...data,
      headers,
    };
    console.log('Form payload:', payload);
  };

  return (
    <form>
      {/* Other form fields using React Hook Form */}

      {/* DynamicFieldArray outside of form control */}
      <DynamicFieldArray
        value={customHeaders}
        onChange={setCustomHeaders}
        type="key-value"
        label="Custom Headers"
        keyPlaceholder="Header name"
        valuePlaceholder="Header value"
        addButtonLabel="Add Header"
      />

      <button type="submit">Submit</button>
    </form>
  );
}

/**
 * Example 8: Validation and Empty State Handling
 */
export function ValidationExample() {
  const [fields, setFields] = useState<KeyValuePair[]>([{ key: '', value: '' }]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = () => {
    const validationErrors: string[] = [];

    // Validate that all fields have both key and value
    fields.forEach((field, index) => {
      if (field.key && !field.value) {
        validationErrors.push(`Field ${index + 1}: Value is required`);
      }
      if (!field.key && field.value) {
        validationErrors.push(`Field ${index + 1}: Key is required`);
      }
    });

    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      // Convert to object, filtering out empty pairs
      const data = keyValuePairsToObject(fields);
      console.log('Valid data:', data);
    }
  };

  return (
    <div className="space-y-4">
      <DynamicFieldArray
        value={fields}
        onChange={setFields}
        type="key-value"
        label="Fields"
        keyPlaceholder="Key"
        valuePlaceholder="Value"
        addButtonLabel="Add Field"
      />

      {errors.length > 0 && (
        <div className="text-destructive text-sm space-y-1">
          {errors.map((error, i) => (
            <p key={i}>{error}</p>
          ))}
        </div>
      )}

      <button onClick={handleSubmit}>Validate & Submit</button>
    </div>
  );
}

/**
 * Migration Guide: Refactoring Existing Code
 *
 * BEFORE (CreateWebhookModal.tsx pattern - ~70 lines):
 * ```typescript
 * const [customHeaders, setCustomHeaders] = useState<{ key: string; value: string }[]>([
 *   { key: '', value: '' },
 * ]);
 *
 * const addHeader = () => {
 *   setCustomHeaders([...customHeaders, { key: '', value: '' }]);
 * };
 *
 * const removeHeader = (index: number) => {
 *   setCustomHeaders(customHeaders.filter((_, i) => i !== index));
 * };
 *
 * const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
 *   const updated = [...customHeaders];
 *   updated[index][field] = value;
 *   setCustomHeaders(updated);
 * };
 *
 * // In JSX (40+ lines):
 * <div className="space-y-2">
 *   <label className="text-sm font-medium">Custom Headers</label>
 *   <p className="text-xs text-gray-500">
 *     Add custom headers for authentication or identification
 *   </p>
 *   <div className="space-y-2">
 *     {customHeaders.map((header, index) => (
 *       <div key={index} className="flex gap-2">
 *         <Input
 *           placeholder="Header name (e.g., X-API-Key)"
 *           value={header.key}
 *           onChange={(e) => updateHeader(index, 'key', e.target.value)}
 *         />
 *         <Input
 *           placeholder="Header value"
 *           type="password"
 *           value={header.value}
 *           onChange={(e) => updateHeader(index, 'value', e.target.value)}
 *         />
 *         <Button
 *           type="button"
 *           variant="ghost"
 *           size="sm"
 *           onClick={() => removeHeader(index)}
 *           disabled={customHeaders.length === 1}
 *         >
 *           <Trash2 className="h-4 w-4" />
 *         </Button>
 *       </div>
 *     ))}
 *     <Button
 *       type="button"
 *       variant="outline"
 *       size="sm"
 *       onClick={addHeader}
 *       className="mt-2"
 *     >
 *       <Plus className="h-4 w-4 mr-2" />
 *       Add Header
 *     </Button>
 *   </div>
 * </div>
 *
 * // In submit handler:
 * const headers: Record<string, string> = {};
 * customHeaders.forEach((header) => {
 *   if (header.key && header.value) {
 *     headers[header.key] = header.value;
 *   }
 * });
 * data.headers = headers;
 * ```
 *
 * AFTER (Using DynamicFieldArray - ~10 lines):
 * ```typescript
 * import {
 *   DynamicFieldArray,
 *   KeyValuePair,
 *   keyValuePairsToObject,
 * } from '@/app/components/ui/dynamic-field-array';
 *
 * const [customHeaders, setCustomHeaders] = useState<KeyValuePair[]>([
 *   { key: '', value: '' },
 * ]);
 *
 * // In JSX:
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
 * // In submit handler:
 * data.headers = keyValuePairsToObject(customHeaders);
 * ```
 *
 * Code reduction: ~70 lines → ~10 lines (85% reduction)
 */
