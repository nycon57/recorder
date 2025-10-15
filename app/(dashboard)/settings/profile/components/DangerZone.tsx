'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2, Download, Ban } from 'lucide-react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';
import { useToast } from '@/app/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

export function DangerZone() {
  const { user } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportData = async () => {
    try {
      toast({
        title: 'Export Started',
        description: 'We\'re preparing your data export. You\'ll receive an email when it\'s ready.',
      });

      // Mock implementation - in production this would trigger a background job
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to start data export. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeactivateAccount = async () => {
    try {
      // This would deactivate the account (soft delete)
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'suspended',
        }),
      });

      if (!response.ok) {
        throw new Error('Deactivation failed');
      }

      toast({
        title: 'Account Deactivated',
        description: 'Your account has been deactivated. You can reactivate it by signing in again.',
      });

      // Sign out the user
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error deactivating account:', error);
      toast({
        title: 'Deactivation Failed',
        description: 'Failed to deactivate account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setShowDeactivateDialog(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== user?.primaryEmailAddress?.emailAddress) {
      toast({
        title: 'Confirmation Required',
        description: 'Please type your email address to confirm deletion.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Note: In production, this would delete from Supabase first, then Clerk
      // For now, we'll just delete from Clerk
      await user?.delete();

      toast({
        title: 'Account Deleted',
        description: 'Your account has been permanently deleted.',
      });

      // Sign out and redirect
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Deletion Failed',
        description: 'Failed to delete account. Please contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Warning</p>
            <p className="text-sm text-amber-800 mt-1">
              The actions in this section are irreversible. Please proceed with caution.
            </p>
          </div>
        </div>
      </div>

      {/* Export Data */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Your Data
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Download a copy of all your data including recordings, documents, and settings
          </p>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div>
            <p className="text-sm font-medium">Data Export</p>
            <p className="text-xs text-muted-foreground">
              You&apos;ll receive an email with a download link when your export is ready
            </p>
          </div>
          <Button variant="outline" onClick={handleExportData}>
            Request Export
          </Button>
        </div>
      </div>

      <Separator />

      {/* Deactivate Account */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold flex items-center gap-2 text-amber-700">
            <Ban className="h-4 w-4" />
            Deactivate Account
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Temporarily disable your account. You can reactivate it anytime by signing in.
          </p>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-amber-200">
          <div>
            <p className="text-sm font-medium">Account Deactivation</p>
            <p className="text-xs text-muted-foreground">
              Your data will be preserved but you won&apos;t be able to access it
            </p>
          </div>
          <Button
            variant="outline"
            className="border-amber-600 text-amber-700 hover:bg-amber-50"
            onClick={() => setShowDeactivateDialog(true)}
          >
            Deactivate
          </Button>
        </div>
      </div>

      <Separator />

      {/* Delete Account */}
      <div className="space-y-4">
        <div>
          <Label className="text-base font-semibold flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete Account
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
        </div>
        <div className="flex items-center justify-between p-4 rounded-lg border border-destructive">
          <div>
            <p className="text-sm font-medium text-destructive">Permanent Deletion</p>
            <p className="text-xs text-muted-foreground">
              All your recordings, documents, and settings will be permanently deleted
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete Account
          </Button>
        </div>
      </div>

      {/* Deactivate Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your account will be temporarily disabled. You can reactivate it at any time by signing in again.
              Your data will be preserved during deactivation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivateAccount}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              Deactivate Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Delete Account Permanently?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                This action is <strong>irreversible</strong>. All your data will be permanently deleted:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All recordings and transcripts</li>
                <li>All generated documents</li>
                <li>All settings and preferences</li>
                <li>All shared links</li>
              </ul>
              <div className="space-y-2 pt-4">
                <Label htmlFor="delete-confirm">
                  Type <strong>{user?.primaryEmailAddress?.emailAddress}</strong> to confirm:
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Enter your email address"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={
                isDeleting ||
                deleteConfirmation !== user?.primaryEmailAddress?.emailAddress
              }
            >
              {isDeleting ? 'Deleting...' : 'Delete Account Permanently'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}