import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import RecordingPlayer from '@/app/components/RecordingPlayer';
import RecordingActions from '@/app/components/RecordingActions';

async function getRecording(id: string, orgId: string) {
  const supabase = await createClient();

  const { data: recording, error } = await supabase
    .from('recordings')
    .select(
      `
      *,
      transcripts (*),
      documents (*)
    `
    )
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error || !recording) {
    return null;
  }

  // Generate signed video URL if available
  let videoUrl = null;
  if (recording.storage_path_raw) {
    const { data: urlData } = await supabase.storage
      .from('recordings')
      .createSignedUrl(recording.storage_path_raw, 3600); // 1 hour expiry

    videoUrl = urlData?.signedUrl || null;
  }

  return {
    ...recording,
    videoUrl,
  };
}

export default async function RecordingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    redirect('/');
  }

  const recording = await getRecording(params.id, orgId);

  if (!recording) {
    notFound();
  }

  const transcript = Array.isArray(recording.transcripts)
    ? recording.transcripts[0]
    : null;
  const document = Array.isArray(recording.documents)
    ? recording.documents[0]
    : null;

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(new Date(dateString));
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      uploading: { color: 'bg-secondary/10 text-secondary', label: 'Uploading' },
      uploaded: { color: 'bg-primary/10 text-primary', label: 'Processing' },
      transcribing: {
        color: 'bg-primary/10 text-primary',
        label: 'Transcribing',
      },
      transcribed: {
        color: 'bg-accent/10 text-accent',
        label: 'Transcribed',
      },
      doc_generating: {
        color: 'bg-secondary/10 text-secondary',
        label: 'Generating Doc',
      },
      completed: { color: 'bg-accent/10 text-accent', label: 'Complete' },
      error: { color: 'bg-destructive/10 text-destructive', label: 'Error' },
    };

    const badge = badges[status] || badges.uploaded;

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}
      >
        {badge.label}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-primary hover:underline mb-4 inline-flex items-center"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {recording.title || `Recording ${recording.id.slice(0, 8)}`}
            </h1>
            <div className="mt-2 flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{formatDate(recording.created_at)}</span>
              <span>•</span>
              {getStatusBadge(recording.status)}
            </div>
          </div>
          <RecordingActions recordingId={recording.id} />
        </div>

        {recording.description && (
          <p className="mt-4 text-foreground">
            {recording.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="-mb-px flex space-x-8">
          <button className="border-b-2 border-primary py-4 px-1 text-sm font-medium text-primary">
            Video
          </button>
          {transcript && (
            <button className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border">
              Transcript
            </button>
          )}
          {document && (
            <button className="border-b-2 border-transparent py-4 px-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border">
              Document
            </button>
          )}
        </nav>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Video Player */}
          {recording.videoUrl ? (
            <RecordingPlayer videoUrl={recording.videoUrl} />
          ) : (
            <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">⏳</div>
                <p className="text-muted-foreground">
                  {recording.status === 'uploading'
                    ? 'Video is being uploaded...'
                    : recording.status === 'error'
                      ? 'Error processing video'
                      : 'Video is being processed...'}
                </p>
              </div>
            </div>
          )}

          {/* Transcript Section */}
          {transcript && (
            <div className="mt-6 bg-card rounded-lg border border-border p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                Transcript
              </h2>
              <div className="prose dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-foreground">
                  {transcript.text}
                </p>
              </div>
            </div>
          )}

          {/* Document Section */}
          {document && (
            <div className="mt-6 bg-card rounded-lg border border-border p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">
                Generated Document
              </h2>
              <div className="prose dark:prose-invert max-w-none">
                <div
                  dangerouslySetInnerHTML={{
                    __html: document.html || document.markdown,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Processing Status */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">
              Processing Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Upload
                </span>
                <span className="text-accent">✓</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Transcription
                </span>
                {transcript ? (
                  <span className="text-accent">✓</span>
                ) : (
                  <span className="text-muted-foreground">⏳</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Document
                </span>
                {document ? (
                  <span className="text-accent">✓</span>
                ) : (
                  <span className="text-muted-foreground">⏳</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Embeddings
                </span>
                <span className="text-muted-foreground">⏳</span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">
              Details
            </h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground mt-1">
                  {formatDate(recording.created_at)}
                </dd>
              </div>
              {recording.duration_sec && (
                <div>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="text-foreground mt-1">
                    {Math.floor(recording.duration_sec / 60)}:
                    {(recording.duration_sec % 60).toString().padStart(2, '0')}
                  </dd>
                </div>
              )}
              {transcript && (
                <div>
                  <dt className="text-muted-foreground">Language</dt>
                  <dd className="text-foreground mt-1">
                    {transcript.language || 'English'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
