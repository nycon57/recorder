/**
 * TypeScript types for connector system
 */

import { ConnectorType } from '@/lib/connectors/base';

export interface ConnectorConfig {
  id: string;
  orgId: string;
  connectorType: ConnectorType;
  name: string;
  description?: string;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  filters?: Record<string, unknown>;
  lastSyncAt?: Date;
  nextSyncAt?: Date;
  syncFrequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  syncStatus: 'idle' | 'syncing' | 'error';
  syncError?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookActive: boolean;
  isActive: boolean;
  errorCount: number;
  lastError?: string;
  lastErrorAt?: Date;
  credentialsUpdatedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportedDocument {
  id: string;
  connectorId: string;
  orgId: string;
  externalId: string;
  externalUrl?: string;
  parentExternalId?: string;
  title?: string;
  content?: string;
  contentHash?: string;
  fileType?: string;
  fileSize?: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  chunksGenerated: boolean;
  embeddingsGenerated: boolean;
  sourceMetadata: Record<string, unknown>;
  firstSyncedAt: Date;
  lastSyncedAt: Date;
  syncCount: number;
  isDeleted: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorSyncLog {
  id: string;
  connectorId: string;
  orgId: string;
  syncType: 'manual' | 'scheduled' | 'webhook';
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  status: 'running' | 'success' | 'partial' | 'failed';
  documentsSynced: number;
  documentsUpdated: number;
  documentsFailed: number;
  documentsDeleted: number;
  errorMessage?: string;
  errorDetails?: unknown;
  metadata: Record<string, unknown>;
  apiCallsMade: number;
  bytesTransferred: number;
}

export interface WebhookEvent {
  id: string;
  connectorId: string;
  orgId: string;
  eventType: string;
  eventSource: string;
  eventId?: string;
  payload: unknown;
  headers?: Record<string, string>;
  processed: boolean;
  processedAt?: Date;
  processingError?: string;
  retryCount: number;
  receivedAt: Date;
}

export interface FileUploadBatch {
  id: string;
  orgId: string;
  userId?: string;
  batchName?: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progressPercent: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  completedAt?: Date;
}

export interface ConnectorInfo {
  type: ConnectorType;
  name: string;
  description: string;
  requiresOAuth: boolean;
  supportsWebhooks: boolean;
  supportsPublish?: boolean;
}
