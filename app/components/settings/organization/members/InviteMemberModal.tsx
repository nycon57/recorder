'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Mail, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { enhancedInviteMemberSchema, type EnhancedInviteMemberInput } from '@/lib/validations/api';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { Badge } from '@/app/components/ui/badge';
import { DepartmentSelector, type Department } from '@/app/components/shared/DepartmentSelector';
import { FormDialog } from '@/app/components/ui/form-dialog';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import type { UserRole } from '@/lib/types/database';

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  departments: Department[];
}

interface InviteMemberResponse {
  success: boolean;
  message?: string;
  error?: { message: string };
}

interface BulkInviteResponse {
  success: boolean;
  data: {
    successCount: number;
    failedCount: number;
  };
  errors?: Array<{ email: string; message: string }>;
}

export function InviteMemberModal({ open, onClose, departments }: InviteMemberModalProps) {
  const [showBulkInvite, setShowBulkInvite] = useState(false);

  const handleSubmit = async (data: EnhancedInviteMemberInput) => {
    const response = await fetch('/api/organizations/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        role: data.role,
        department_ids: data.department_ids || [],
        custom_message: data.custom_message || undefined,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to send invitation';
      try {
        const error: InviteMemberResponse = await response.json();
        errorMessage = error.error?.message || error.message || errorMessage;
      } catch {
        // Fall back to generic message if JSON parsing fails
      }
      throw new Error(errorMessage);
    }
    return response.json();
  };

  const handleCleanup = () => {
    setShowBulkInvite(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleCleanup();
      onClose();
    }
  };

  return (
    <>
      {!showBulkInvite ? (
        <FormDialog
          open={open}
          onOpenChange={handleOpenChange}
          title="Invite Team Member"
          description="Send an invitation to join your organization"
          size="lg"
          schema={enhancedInviteMemberSchema as any}
          defaultValues={{
            email: '',
            role: 'reader',
            department_ids: [],
            custom_message: '',
          }}
          mutationFn={handleSubmit}
          queryKey={['members']}
          successMessage="Invitation sent successfully"
          errorMessage="Failed to send invitation"
          submitLabel="Send Invitation"
          loadingLabel="Sending..."
          onCleanup={handleCleanup}
          onSuccess={() => {
            toast.success('Invitation sent successfully');
          }}
          onError={(error: Error) => {
            toast.error(error.message || 'Failed to send invitation');
          }}
          className="sm:max-w-[600px]"
        >
          {(form) => (
            <>
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="colleague@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Role */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value: UserRole) => field.onChange(value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="reader">Reader - View only access</SelectItem>
                        <SelectItem value="contributor">
                          Contributor - Can create and edit content
                        </SelectItem>
                        <SelectItem value="admin">
                          Admin - Can manage members and settings
                        </SelectItem>
                        <SelectItem value="owner">
                          Owner - Full administrative access
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Departments */}
              <FormField
                control={form.control}
                name="department_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departments (Optional)</FormLabel>
                    <FormControl>
                      <DepartmentSelector
                        departments={departments}
                        value={field.value || []}
                        onValueChange={(value) => field.onChange(value as string[])}
                        placeholder="Select departments..."
                        multiple={true}
                      />
                    </FormControl>
                    <FormDescription>
                      Assign the new member to specific departments
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Custom Message */}
              <FormField
                control={form.control}
                name="custom_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Welcome Message (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add a personal message to the invitation..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              <div className="bg-muted p-4 rounded-md">
                <div className="text-sm font-medium mb-2">Invitation Preview</div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>To: {form.watch('email') || 'colleague@example.com'}</p>
                  <p>Role: {form.watch('role')}</p>
                  {form.watch('department_ids')?.length > 0 && (
                    <p>
                      Departments:{' '}
                      {departments
                        .filter((d) => form.watch('department_ids')?.includes(d.id))
                        .map((d) => d.name)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Bulk Invite Button */}
              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBulkInvite(true)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Invite
                </Button>
              </div>
            </>
          )}
        </FormDialog>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your organization
              </DialogDescription>
            </DialogHeader>
            <BulkInviteForm
              onBack={() => setShowBulkInvite(false)}
              onSuccess={() => {
                handleCleanup();
                onClose();
              }}
              onClose={() => {
                handleCleanup();
                onClose();
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// Bulk invite component
function BulkInviteForm({
  onBack,
  onSuccess,
  onClose,
}: {
  onBack: () => void;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const bulkInviteMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/organizations/members/bulk-invite', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to process bulk invitations';
        try {
          const error: BulkInviteResponse = await response.json();
          if (error.errors && error.errors.length > 0) {
            const firstError = error.errors[0];
            errorMessage = `${firstError.email}: ${firstError.message}`;
          }
        } catch {
          // Fall back to generic message if JSON parsing fails
        }
        throw new Error(errorMessage);
      }
      return response.json() as Promise<BulkInviteResponse>;
    },
    onSuccess: (data: BulkInviteResponse) => {
      toast.success(`Sent ${data.data.successCount} invitations`);
      if (data.data.failedCount > 0) {
        toast.warning(`${data.data.failedCount} invitations failed`);
      }
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to process bulk invitations');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (csvFile) {
      // Validate file
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (csvFile.size > maxSize) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!csvFile.type.includes('csv') && !csvFile.name.endsWith('.csv')) {
        toast.error('File must be a CSV');
        return;
      }
      bulkInviteMutation.mutate(csvFile);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Upload CSV File</Label>
        <Input
          type="file"
          accept=".csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
        />
        <p className="text-xs text-muted-foreground">
          CSV format: email, role, departments (comma-separated)
        </p>
      </div>

      <div className="bg-muted p-4 rounded-md text-sm">
        <div className="font-medium mb-2">Example CSV:</div>
        <pre className="text-xs">
          {`email,role,departments
john@example.com,contributor,Engineering
jane@example.com,admin,Engineering,Marketing`}
        </pre>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={!csvFile || bulkInviteMutation.isPending}>
          {bulkInviteMutation.isPending ? 'Processing...' : 'Send Invitations'}
        </Button>
      </DialogFooter>
    </form>
  );
}
