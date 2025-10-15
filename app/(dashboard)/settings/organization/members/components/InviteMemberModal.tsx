'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Mail, Upload } from 'lucide-react';
import { toast } from 'sonner';

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

import { DepartmentSelector } from '@/app/components/shared/DepartmentSelector';
import type { UserRole } from '@/lib/types/database';

interface Department {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  departments: Department[];
}

interface InviteFormData {
  email: string;
  role: UserRole;
  departmentIds: string[];
  customMessage: string;
}

export function InviteMemberModal({ open, onClose, departments }: InviteMemberModalProps) {
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    defaultValues: {
      email: '',
      role: 'reader',
      departmentIds: [],
      customMessage: '',
    },
  });

  // Invite mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: InviteFormData) => {
      const response = await fetch('/api/organizations/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          role: data.role,
          department_ids: selectedDepartments,
          custom_message: data.customMessage || undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send invitation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Invitation sent successfully');
      reset();
      setSelectedDepartments([]);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send invitation');
    },
  });

  const onSubmit = (data: InviteFormData) => {
    inviteMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setSelectedDepartments([]);
    setShowBulkInvite(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization
          </DialogDescription>
        </DialogHeader>

        {!showBulkInvite ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">
                Role <span className="text-red-500">*</span>
              </Label>
              <Select
                value={watch('role')}
                onValueChange={(value) => setValue('role', value as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            </div>

            {/* Departments */}
            <div className="space-y-2">
              <Label>Departments (Optional)</Label>
              <DepartmentSelector
                departments={departments}
                value={selectedDepartments}
                onChange={setSelectedDepartments}
                placeholder="Select departments..."
                multiple={true}
              />
              <p className="text-xs text-muted-foreground">
                Assign the new member to specific departments
              </p>
            </div>

            {/* Custom Message */}
            <div className="space-y-2">
              <Label htmlFor="customMessage">Custom Welcome Message (Optional)</Label>
              <Textarea
                id="customMessage"
                placeholder="Add a personal message to the invitation..."
                {...register('customMessage')}
                rows={3}
              />
            </div>

            {/* Preview */}
            <div className="bg-muted p-4 rounded-md">
              <div className="text-sm font-medium mb-2">Invitation Preview</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>To: {watch('email') || 'colleague@example.com'}</p>
                <p>Role: {watch('role')}</p>
                {selectedDepartments.length > 0 && (
                  <p>Departments: {departments
                    .filter(d => selectedDepartments.includes(d.id))
                    .map(d => d.name)
                    .join(', ')}</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBulkInvite(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Invite
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? (
                  'Sending...'
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <BulkInviteForm
            onBack={() => setShowBulkInvite(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['members'] });
              handleClose();
            }}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
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
      if (!response.ok) throw new Error('Failed to process bulk invitations');
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Sent ${data.data.successCount} invitations`);
      if (data.data.failedCount > 0) {
        toast.warning(`${data.data.failedCount} invitations failed`);
      }
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process bulk invitations');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (csvFile) {
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
