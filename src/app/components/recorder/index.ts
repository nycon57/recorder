/**
 * PERF-FE-002: Recorder Components Barrel Export
 *
 * Note: Heavy components like ReviewRecording (which uses FFmpeg) are NOT exported here.
 * They should be imported dynamically to avoid loading ~650KB FFmpeg in the main bundle.
 *
 * For FFmpeg-based components, use dynamic imports:
 * ```tsx
 * import dynamic from 'next/dynamic';
 * const ReviewRecording = dynamic(() => import('@/app/components/recorder/ReviewRecording'), { ssr: false });
 * ```
 */

export { VideoStreams } from './VideoStreams';
export { LayoutSwitcher } from './LayoutSwitcher';
export { ShapeSelect } from './ShapeSelect';
export { CameraSelect } from './CameraSelect';
export { MicrophoneSelect } from './MicrophoneSelect';
export { TeleprompterSelect } from './TeleprompterSelect';
export { MainRecordButton } from './MainRecordButton';
export { Teleprompter } from './Teleprompter';
export { PiPWindow } from './PiPWindow';
// Note: ReviewRecording is NOT exported here - import dynamically to avoid FFmpeg in initial bundle
