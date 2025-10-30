/**
 * Library components
 * Components for content library and detail views
 */

// Main library components
export { LibraryTable } from './LibraryTable';
export { SelectableContentCard } from './SelectableContentCard';

// Detail views
export { default as VideoDetailView } from './detail-views/VideoDetailView';
export { default as AudioDetailView } from './detail-views/AudioDetailView';
export { default as DocumentDetailView } from './detail-views/DocumentDetailView';
export { default as TextNoteDetailView } from './detail-views/TextNoteDetailView';
export { default as AudioPlayer } from './detail-views/AudioPlayer';
export { default as PDFDocumentViewer } from './detail-views/PDFDocumentViewer';
export { default as TextNoteViewer } from './detail-views/TextNoteViewer';

// Shared components
export { default as TranscriptPanel } from './shared/TranscriptPanel';
export { default as ShareControls } from './shared/ShareControls';
export { default as AIDocumentPanel } from './shared/AIDocumentPanel';
export { default as MetadataSidebar } from './shared/MetadataSidebar';
