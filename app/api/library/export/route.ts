import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import archiver from 'archiver';
import Papa from 'papaparse';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  parseBody,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';

// Export request schema
const exportRequestSchema = z.object({
  format: z.enum(['zip', 'json', 'csv']),
  options: z.object({
    includeTranscripts: z.boolean().optional().default(true),
    includeDocuments: z.boolean().optional().default(true),
    includeMetadata: z.boolean().optional().default(true),
    includeMedia: z.boolean().optional().default(true),
  }).optional().default({
    includeTranscripts: true,
    includeDocuments: true,
    includeMetadata: true,
    includeMedia: true,
  }),
  recordingIds: z.array(z.string()).optional(),
});

type ExportRequest = z.infer<typeof exportRequestSchema>;

/**
 * POST /api/library/export
 * Create an export of library content
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    const { orgId } = await requireOrg();
    const body = await parseBody(request, exportRequestSchema);

    if (!body || typeof body !== 'object') {
      return errors.badRequest('Invalid request body', undefined, requestId);
    }

    const exportData = body as ExportRequest;

    // Get recordings to export
    let query = supabaseAdmin
      .from('content')
      .select(`
        *,
        transcripts!recording_id (*),
        documents!recording_id (*)
      `)
      .eq('org_id', orgId)
      .is('deleted_at', null);

    // Filter by specific IDs if provided
    if (exportData.recordingIds && exportData.recordingIds.length > 0) {
      query = query.in('id', exportData.recordingIds);
    }

    const { data: recordings, error } = await query;

    if (error) {
      console.error('[Export] Database error:', error);
      return errors.internalError(requestId);
    }

    if (!recordings || recordings.length === 0) {
      return errors.notFound('No recordings found to export', requestId);
    }

    // Handle different export formats
    switch (exportData.format) {
      case 'json':
        return await exportAsJSON(recordings, exportData.options, requestId);
      case 'csv':
        return await exportAsCSV(recordings, requestId);
      case 'zip':
        return await exportAsZIP(recordings, exportData.options, orgId, requestId);
      default:
        return errors.badRequest('Invalid export format', undefined, requestId);
    }
  } catch (error: any) {
    console.error('[Export] Request error:', error);

    if (error.message === 'Unauthorized') {
      return errors.unauthorized(requestId);
    }

    if (error.message === 'Organization context required') {
      return errors.forbidden(requestId);
    }

    return errors.internalError(requestId);
  }
}

/**
 * Export as JSON
 */
async function exportAsJSON(recordings: any[], options: any, requestId: string) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalItems: recordings.length,
    items: recordings.map(recording => {
      const item: any = {
        id: recording.id,
        title: recording.title,
        description: recording.description,
        contentType: recording.content_type,
        fileType: recording.file_type,
        createdAt: recording.created_at,
        updatedAt: recording.updated_at,
      };

      if (options.includeMetadata) {
        item.metadata = {
          originalFilename: recording.original_filename,
          fileSize: recording.file_size,
          duration: recording.duration_sec,
          mimeType: recording.mime_type,
          status: recording.status,
          tags: recording.tags,
        };
      }

      if (options.includeTranscripts && recording.transcripts?.length > 0) {
        item.transcript = recording.transcripts[0].content;
        item.transcriptWords = recording.transcripts[0].words;
      }

      if (options.includeDocuments && recording.documents?.length > 0) {
        item.document = recording.documents[0].content;
      }

      return item;
    }),
  };

  // Return JSON response
  return NextResponse.json(exportData, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="library-export-${Date.now()}.json"`,
    },
  });
}

/**
 * Export as CSV
 */
async function exportAsCSV(recordings: any[], requestId: string) {
  const csvData = recordings.map(recording => ({
    ID: recording.id,
    Title: recording.title || '',
    Description: recording.description || '',
    Type: recording.content_type,
    Format: recording.file_type,
    'File Name': recording.original_filename || '',
    'Size (bytes)': recording.file_size || 0,
    'Duration (sec)': recording.duration_sec || 0,
    Status: recording.status,
    'Created At': recording.created_at,
    'Updated At': recording.updated_at,
    'Has Transcript': recording.transcripts?.length > 0 ? 'Yes' : 'No',
    'Has Document': recording.documents?.length > 0 ? 'Yes' : 'No',
  }));

  const csv = Papa.unparse(csvData);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="library-export-${Date.now()}.csv"`,
    },
  });
}

/**
 * Export as ZIP archive
 *
 * NOTE: This implementation streams the export directly to the client.
 * For very large exports (>100MB), consider implementing a background job system:
 * - POST returns an exportId
 * - GET /api/library/export/:id/status returns progress
 * - GET /api/library/export/:id/download returns the final file
 */
async function exportAsZIP(recordings: any[], options: any, orgId: string, requestId: string) {
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Maximum compression
  });

  // Error handling for archive
  archive.on('error', (err) => {
    console.error('[Export ZIP] Archive error:', err);
    throw err;
  });

  // Add metadata file
  if (options.includeMetadata) {
    const metadata = {
      exportedAt: new Date().toISOString(),
      totalItems: recordings.length,
      items: recordings.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        contentType: r.content_type,
        fileType: r.file_type,
        originalFilename: r.original_filename,
        createdAt: r.created_at,
      })),
    };

    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
  }

  // Add transcripts
  if (options.includeTranscripts) {
    for (const recording of recordings) {
      if (recording.transcripts?.length > 0) {
        const transcript = recording.transcripts[0];
        const filename = `transcripts/${recording.id}-${recording.title || 'untitled'}.txt`;
        archive.append(transcript.content || '', { name: filename });
      }
    }
  }

  // Add documents
  if (options.includeDocuments) {
    for (const recording of recordings) {
      if (recording.documents?.length > 0) {
        const document = recording.documents[0];
        const filename = `documents/${recording.id}-${recording.title || 'untitled'}.md`;
        archive.append(document.content || '', { name: filename });
      }
    }
  }

  // Add media files
  if (options.includeMedia) {
    for (const recording of recordings) {
      if (recording.storage_path_raw) {
        try {
          // Download file from Supabase Storage
          const { data: fileData, error } = await supabaseAdmin.storage
            .from('content')
            .download(recording.storage_path_raw);

          if (!error && fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer());
            const extension = recording.file_type || 'mp4';
            const filename = `media/${recording.id}-${recording.title || 'untitled'}.${extension}`;
            archive.append(buffer, { name: filename });
          }
        } catch (error) {
          console.error(`[Export] Failed to download file for ${recording.id}:`, error);
        }
      }
    }
  }

  // Finalize archive
  archive.finalize();

  // Convert Node.js Readable to Web ReadableStream for Next.js response
  const webStream = Readable.toWeb(archive as any) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="library-export-${Date.now()}.zip"`,
      'Transfer-Encoding': 'chunked',
    },
  });
}

/**
 * GET /api/library/export/estimate
 * Estimate export size
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const url = new URL(request.url);

  const format = url.searchParams.get('format') || 'zip';
  const ids = url.searchParams.get('ids')?.split(',').filter(Boolean);
  const includeMedia = url.searchParams.get('includeMedia') !== 'false';

  try {
    // Get recordings to estimate size
    let query = supabaseAdmin
      .from('content')
      .select('file_size')
      .eq('org_id', orgId)
      .is('deleted_at', null);

    if (ids && ids.length > 0) {
      query = query.in('id', ids);
    }

    const { data: recordings } = await query;

    let estimatedSize = 0;

    if (recordings) {
      // Calculate estimated size based on format
      if (format === 'zip' && includeMedia) {
        // Include actual file sizes
        estimatedSize = recordings.reduce((sum, r) => sum + (r.file_size || 0), 0);
      } else if (format === 'json') {
        // Rough estimate: 5KB per recording for JSON
        estimatedSize = recordings.length * 5 * 1024;
      } else if (format === 'csv') {
        // Rough estimate: 1KB per recording for CSV
        estimatedSize = recordings.length * 1024;
      } else {
        // Text content only: 10KB per recording
        estimatedSize = recordings.length * 10 * 1024;
      }
    }

    return successResponse({
      estimatedSize,
      format,
      itemCount: recordings?.length || 0,
    });
  } catch (error) {
    console.error('[Export Estimate] Error:', error);
    return successResponse({ estimatedSize: 0 });
  }
});