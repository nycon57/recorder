'use client';

import { useState, useEffect } from 'react';
import {
  FolderOpen,
  FileUp,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  FileText,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import type {
  PublishFormat,
  PublishDestination,
  BrandingConfig,
  PublishedDocument,
} from '@/lib/types/publishing';

// =====================================================
// TYPES
// =====================================================

interface ConnectorConfig {
  id: string;
  connector_type: PublishDestination;
  display_name: string;
  is_active: boolean;
  supports_publish: boolean;
}

interface FolderInfo {
  id: string;
  name: string;
  path: string;
}

type PublishStatus = 'idle' | 'publishing' | 'success' | 'error';

interface PublishModalProps {
  contentId: string;
  documentId: string;
  contentTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onPublishComplete?: (publication: PublishedDocument) => void;
}

// =====================================================
// CONSTANTS
// =====================================================

const DESTINATION_LABELS: Record<PublishDestination, string> = {
  google_drive: 'Google Drive',
  sharepoint: 'SharePoint',
  onedrive: 'OneDrive',
  notion: 'Notion',
};

const FORMAT_OPTIONS: Array<{
  value: PublishFormat;
  label: string;
  description: string;
}> = [
  {
    value: 'native',
    label: 'Native Format',
    description: 'Google Docs, Word, or native format',
  },
  {
    value: 'markdown',
    label: 'Markdown',
    description: 'Plain text with markdown formatting',
  },
  {
    value: 'pdf',
    label: 'PDF',
    description: 'Portable Document Format',
  },
  {
    value: 'html',
    label: 'HTML',
    description: 'Web page format',
  },
];

// =====================================================
// COMPONENT
// =====================================================

/**
 * PublishModal Component
 *
 * Modal for publishing documents to external systems (Google Drive, SharePoint, OneDrive).
 * Features folder selection, format options, and branding configuration.
 *
 * Usage:
 * <PublishModal
 *   contentId="content-uuid"
 *   documentId="document-uuid"
 *   contentTitle="My Document"
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onPublishComplete={(publication) => console.log('Published:', publication)}
 * />
 */
export default function PublishModal({
  contentId,
  contentTitle,
  isOpen,
  onClose,
  onPublishComplete,
}: PublishModalProps) {
  // State
  const [connectors, setConnectors] = useState<ConnectorConfig[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<string>('');
  const [selectedFolder, setSelectedFolder] = useState<FolderInfo | null>(null);
  const [format, setFormat] = useState<PublishFormat>('native');
  const [customTitle, setCustomTitle] = useState('');
  const [branding, setBranding] = useState<BrandingConfig>({
    includeVideoLink: true,
    includePoweredByFooter: true,
    includeEmbeddedPlayer: false,
  });

  const [status, setStatus] = useState<PublishStatus>('idle');
  const [isLoadingConnectors, setIsLoadingConnectors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const isPublishing = status === 'publishing';

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setError(null);
      setPublishedUrl(null);
      setCustomTitle('');
      setSelectedFolder(null);
      setFormat('native');
      setBranding({
        includeVideoLink: true,
        includePoweredByFooter: true,
        includeEmbeddedPlayer: false,
      });

      // Load available connectors
      loadConnectors();
    }
  }, [isOpen]);

  // Load available connectors
  const loadConnectors = async () => {
    try {
      setIsLoadingConnectors(true);

      // Fetch connectors from database
      // For now, we'll use the connector_configs table via the publish API
      // In a full implementation, you'd have a dedicated /api/integrations endpoint

      // Simulated connector fetch - replace with actual API call
      // const response = await fetch('/api/integrations');
      // const data = await response.json();

      // For demo purposes, showing structure
      // In production, this would filter connectors where supports_publish = true
      const mockConnectors: ConnectorConfig[] = [
        // These would come from database
        // {
        //   id: 'connector-uuid-1',
        //   connector_type: 'google_drive',
        //   display_name: 'My Google Drive',
        //   is_active: true,
        //   supports_publish: true,
        // },
      ];

      setConnectors(mockConnectors);

      // Auto-select first connector if available
      if (mockConnectors.length > 0) {
        setSelectedConnector(mockConnectors[0].id);
      }
    } catch (err) {
      console.error('Failed to load connectors:', err);
      toast.error('Failed to load connected accounts');
    } finally {
      setIsLoadingConnectors(false);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (!selectedConnector) {
      toast.error('Please select a destination');
      return;
    }

    setStatus('publishing');
    setError(null);

    try {
      const response = await fetch(`/api/library/${contentId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: connectors.find((c) => c.id === selectedConnector)
            ?.connector_type,
          connectorId: selectedConnector,
          folderId: selectedFolder?.id,
          folderPath: selectedFolder?.path,
          format,
          branding,
          customTitle: customTitle.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish document');
      }

      const result = await response.json();
      const { publication, externalUrl } = result.data || result;

      setStatus('success');
      setPublishedUrl(externalUrl);

      toast.success('Document published successfully!', {
        description: 'Your document is now available in the selected location.',
      });

      // Notify parent component
      if (onPublishComplete && publication) {
        onPublishComplete(publication);
      }

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Publish error:', err);
      const error = err as Error;
      setStatus('error');
      setError(error.message || 'Failed to publish document');

      toast.error('Failed to publish document', {
        description: error.message || 'Please try again or contact support.',
      });
    }
  };

  const handleClose = () => {
    if (!isPublishing) {
      onClose();
    }
  };

  const selectedConnectorConfig = connectors.find(
    (c) => c.id === selectedConnector
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Publish Document
          </DialogTitle>
          <DialogDescription>
            Publish &quot;{contentTitle}&quot; to your connected storage system. The
            document will be enriched with AI-generated content and branding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Destination Selection */}
          <div className="space-y-3">
            <Label>Destination</Label>
            {isLoadingConnectors ? (
              <div className="flex items-center justify-center h-[42px]">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : connectors.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center">
                <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  No connected accounts found
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="/settings/integrations">Connect Account</a>
                </Button>
              </div>
            ) : (
              <Select
                value={selectedConnector}
                onValueChange={setSelectedConnector}
                disabled={isPublishing}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {connectors.map((connector) => (
                    <SelectItem key={connector.id} value={connector.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>
                          {connector.display_name} (
                          {DESTINATION_LABELS[connector.connector_type]})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Folder Selection - Placeholder */}
          {selectedConnector && (
            <div className="space-y-3">
              <Label>Folder (Optional)</Label>
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={isPublishing}
                onClick={() => {
                  toast.info('Folder picker coming soon', {
                    description:
                      'Documents will be saved to the root folder for now.',
                  });
                }}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {selectedFolder ? selectedFolder.path : 'Root folder'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Click to browse folders in your{' '}
                {selectedConnectorConfig &&
                  DESTINATION_LABELS[selectedConnectorConfig.connector_type]}
              </p>
            </div>
          )}

          {/* Format Selection */}
          <div className="space-y-3">
            <Label>Format</Label>
            <Select
              value={format}
              onValueChange={(value) => setFormat(value as PublishFormat)}
              disabled={isPublishing}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Title */}
          <div className="space-y-3">
            <Label htmlFor="customTitle">
              Custom Title <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="customTitle"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={contentTitle}
              disabled={isPublishing}
            />
          </div>

          {/* Branding Options */}
          <div className="space-y-3">
            <Label>Branding Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="videoLink"
                  checked={branding.includeVideoLink}
                  onCheckedChange={(checked) =>
                    setBranding({
                      ...branding,
                      includeVideoLink: checked as boolean,
                    })
                  }
                  disabled={isPublishing}
                />
                <Label htmlFor="videoLink" className="text-sm cursor-pointer font-normal">
                  Include link to original recording
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="poweredBy"
                  checked={branding.includePoweredByFooter}
                  onCheckedChange={(checked) =>
                    setBranding({
                      ...branding,
                      includePoweredByFooter: checked as boolean,
                    })
                  }
                  disabled={isPublishing}
                />
                <Label htmlFor="poweredBy" className="text-sm cursor-pointer font-normal">
                  Include &quot;Powered by Tribora&quot; footer
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="embeddedPlayer"
                  checked={branding.includeEmbeddedPlayer}
                  onCheckedChange={(checked) =>
                    setBranding({
                      ...branding,
                      includeEmbeddedPlayer: checked as boolean,
                    })
                  }
                  disabled={isPublishing}
                />
                <Label
                  htmlFor="embeddedPlayer"
                  className="text-sm cursor-pointer font-normal"
                >
                  Include embedded video player
                </Label>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {status === 'success' && publishedUrl && (
            <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Document published successfully!
                  </p>
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-600 dark:text-green-400 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    View published document
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && error && (
            <div className="rounded-md bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">
                    Failed to publish
                  </p>
                  <p className="text-sm text-destructive/80 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPublishing}
            className="w-full sm:w-auto"
          >
            {status === 'success' ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={
              isPublishing ||
              !selectedConnector ||
              connectors.length === 0 ||
              status === 'success'
            }
            className="w-full sm:w-auto"
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                Publish
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
