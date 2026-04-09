"use client"

import * as React from "react"
import { useForm, type UseFormReturn, type FieldValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import type { z } from "zod"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Form } from "@/app/components/ui/form"
import { Button } from "@/app/components/ui/button"

/**
 * Size variants for the dialog content
 */
type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl"

/**
 * Map of size variants to Tailwind max-width classes
 */
const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
}

/**
 * Props for the FormDialog component
 *
 * @template TSchema - Zod schema type that extends FieldValues
 */
export interface FormDialogProps<TSchema extends FieldValues = FieldValues> {
  // Dialog props
  /** Controls the open/closed state of the dialog */
  open: boolean
  /** Callback when the dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Dialog title displayed in the header */
  title: string
  /** Optional description text displayed below the title */
  description?: string
  /** Size variant for the dialog (default: "lg") */
  size?: DialogSize
  /** Additional className for DialogContent */
  className?: string

  // Form props
  /** Zod schema for form validation */
  schema: z.ZodSchema<TSchema>
  /** Default values for the form */
  defaultValues: TSchema | (() => TSchema)
  /** Optional mode for form validation */
  mode?: "onSubmit" | "onBlur" | "onChange" | "onTouched" | "all"

  // Mutation props
  /** Function to execute when form is submitted */
  mutationFn: (data: TSchema) => Promise<any>
  /** Optional query key(s) to invalidate on success */
  queryKey?: string | string[]
  /** Success message to display in toast (default: "Success") */
  successMessage?: string
  /** Error message to display in toast (default: "An error occurred") */
  errorMessage?: string

  // Submit button props
  /** Label for the submit button (default: "Submit") */
  submitLabel?: string
  /** Label for the submit button during loading (default: "Loading...") */
  loadingLabel?: string
  /** Submit button variant (default: "default") */
  submitVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"

  // Cancel button props
  /** Show cancel button (default: true) */
  showCancel?: boolean
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string

  // Children render function
  /**
   * Render function that receives the form instance
   * Use this to render FormField components
   */
  children: (form: UseFormReturn<TSchema, any, TSchema>) => React.ReactNode

  // Optional callbacks
  /** Callback executed on successful mutation, before standard success handling */
  onSuccess?: (data: any) => void
  /** Callback executed on mutation error, before standard error handling */
  onError?: (error: Error) => void
  /** Custom cleanup function called when dialog closes */
  onCleanup?: () => void
}

/**
 * FormDialog - A reusable form dialog component that eliminates boilerplate
 *
 * Combines Dialog, Form, react-hook-form, TanStack Query mutations, and toast notifications
 * into a single composable component with full TypeScript type safety.
 *
 * @example
 * ```tsx
 * <FormDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Create Webhook"
 *   description="Configure a webhook endpoint"
 *   size="2xl"
 *   schema={createWebhookSchema}
 *   defaultValues={{ name: '', url: '', events: [] }}
 *   mutationFn={async (data) => {
 *     const res = await fetch('/api/webhooks', {
 *       method: 'POST',
 *       body: JSON.stringify(data),
 *     });
 *     if (!res.ok) throw new Error('Failed');
 *     return res.json();
 *   }}
 *   queryKey={['webhooks']}
 *   successMessage="Webhook created"
 *   submitLabel="Create Webhook"
 * >
 *   {(form) => (
 *     <>
 *       <FormField control={form.control} name="name" {...} />
 *       <FormField control={form.control} name="url" {...} />
 *     </>
 *   )}
 * </FormDialog>
 * ```
 */
export function FormDialog<TSchema extends FieldValues = FieldValues>({
  // Dialog props
  open,
  onOpenChange,
  title,
  description,
  size = "lg",
  className,

  // Form props
  schema,
  defaultValues,
  mode = "onSubmit",

  // Mutation props
  mutationFn,
  queryKey,
  successMessage = "Success",
  errorMessage = "An error occurred",

  // Submit button props
  submitLabel = "Submit",
  loadingLabel = "Loading...",
  submitVariant = "default",

  // Cancel button props
  showCancel = true,
  cancelLabel = "Cancel",

  // Children and callbacks
  children,
  onSuccess,
  onError,
  onCleanup,
}: FormDialogProps<TSchema>) {
  const queryClient = useQueryClient()

  // Initialize form with schema validation
  // @ts-ignore - zodResolver type incompatibility with generic schema
  const form = useForm({
    resolver: zodResolver(schema as any),
    defaultValues: defaultValues as any,
    mode,
  })

  // Setup mutation with TanStack Query
  const mutation = useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Call custom success handler first
      onSuccess?.(data)

      // Invalidate queries if queryKey provided
      if (queryKey) {
        const keys = Array.isArray(queryKey) ? queryKey : [queryKey]
        queryClient.invalidateQueries({ queryKey: keys })
      }

      // Show success toast
      toast.success(successMessage)

      // Close dialog and reset form
      handleClose()
    },
    onError: (error: Error) => {
      // Call custom error handler first
      onError?.(error)

      // Show error toast
      toast.error(errorMessage)
    },
  })

  /**
   * Handle form submission
   */
  const handleSubmit = (data: TSchema) => {
    mutation.mutate(data)
  }

  /**
   * Handle dialog close with cleanup
   */
  const handleClose = () => {
    // Reset form to default values
    form.reset()

    // Call custom cleanup if provided
    onCleanup?.()

    // Close the dialog
    onOpenChange(false)
  }

  /**
   * Prevent dialog close during mutation
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && mutation.isPending) {
      // Don't allow closing while mutation is in progress
      return
    }
    if (!newOpen) {
      handleClose()
    } else {
      onOpenChange(newOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          sizeClasses[size],
          "max-h-[90vh] overflow-y-auto",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Render form fields via children render function */}
            {children(form)}

            <DialogFooter>
              {showCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={mutation.isPending}
                >
                  {cancelLabel}
                </Button>
              )}
              <Button
                type="submit"
                variant={submitVariant}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? loadingLabel : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Type helper to extract schema type from Zod schema
 * Useful for ensuring type safety between schema and defaultValues
 *
 * @example
 * ```tsx
 * const schema = z.object({ name: z.string() })
 * type SchemaType = InferSchema<typeof schema> // { name: string }
 * ```
 */
export type InferSchema<T extends z.ZodType<any, any, any>> = z.infer<T>
