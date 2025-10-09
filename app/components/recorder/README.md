# Recorder Components

Modern Next.js 15 recording interface components built with Tailwind CSS and shadcn/ui. These components provide a complete recording workflow with camera/screen capture, device selection, teleprompter, and upload functionality.

## Components Overview

### 1. VideoStreams (`VideoStreams.tsx`)
**Purpose**: Display camera and screen share preview with PiP camera overlay

**Features**:
- Shows main video stream (screenshare OR camera based on layout)
- Picture-in-Picture camera overlay in `screenAndCamera` mode
- Respects camera shape (circle/square)
- Placeholder when no streams available
- Responsive positioning using percentage-based calculations

**Usage**:
```tsx
import { VideoStreams } from '@/app/components/recorder';

<VideoStreams />
```

**Integration**: Automatically uses `cameraStream`, `screenshareStream`, `layout`, and `cameraShape` from `RecordingContext`.

---

### 2. LayoutSwitcher (`LayoutSwitcher.tsx`)
**Purpose**: Toggle between recording modes

**Features**:
- Three modes: Screen Only, Screen + Camera, Camera Only
- Uses shadcn toggle-group with outline variant
- Lucide icons for visual clarity
- Responsive labels (hidden on small screens)

**Usage**:
```tsx
import { LayoutSwitcher } from '@/app/components/recorder';

<LayoutSwitcher />
```

---

### 3. ShapeSelect (`ShapeSelect.tsx`)
**Purpose**: Toggle camera shape between circle and square

**Features**:
- Two options: Circle and Square
- Visual icons from lucide-react
- Updates `cameraShape` in context

**Usage**:
```tsx
import { ShapeSelect } from '@/app/components/recorder';

<ShapeSelect />
```

---

### 4. CameraSelect (`CameraSelect.tsx`)
**Purpose**: Dropdown to select camera device

**Features**:
- Auto-enumerates video input devices
- Handles permissions errors gracefully
- Auto-selects first available device
- Listens for device changes (plug/unplug)
- Displays friendly error messages

**Usage**:
```tsx
import { CameraSelect } from '@/app/components/recorder';

<CameraSelect />
```

**Error Handling**:
- `NotAllowedError`: Camera permission denied
- `NotFoundError`: Camera not found
- Generic errors: Failed to access camera

---

### 5. MicrophoneSelect (`MicrophoneSelect.tsx`)
**Purpose**: Dropdown to select microphone device

**Features**:
- Auto-enumerates audio input devices
- Handles permissions errors gracefully
- Auto-selects first available device
- Listens for device changes
- Displays friendly error messages

**Usage**:
```tsx
import { MicrophoneSelect } from '@/app/components/recorder';

<MicrophoneSelect />
```

---

### 6. TeleprompterSelect (`TeleprompterSelect.tsx`)
**Purpose**: Toggle teleprompter on/off

**Features**:
- Simple switch component
- Optional `onToggle` callback prop
- Updates `showTeleprompter` in context

**Usage**:
```tsx
import { TeleprompterSelect } from '@/app/components/recorder';

<TeleprompterSelect onToggle={(enabled) => console.log(enabled)} />
```

---

### 7. MainRecordButton (`MainRecordButton.tsx`)
**Purpose**: Main record/stop button with countdown display

**Features**:
- Large circular button (96x96px)
- Shows countdown when active (displays number)
- Recording state: red with square icon
- Idle state: primary color with circle icon
- Pulsing animation while recording
- Disabled when no streams available

**Usage**:
```tsx
import { MainRecordButton } from '@/app/components/recorder';

<MainRecordButton />
```

**States**:
- Countdown: Shows countdown number
- Recording: Red background, square icon, "Stop" text, pulse animation
- Idle: Primary background, circle icon, "Record" text

---

### 8. RecordingModal (`RecordingModal.tsx`)
**Purpose**: Modal shown after recording completes with upload workflow

**Features**:
- Auto-opens when `recordingBlob` is available
- Video preview with controls
- Two actions: Download or Upload & Process
- Upload progress bar
- Error handling and display

**Upload Flow**:
1. POST `/api/recordings` → Get `recordingId` and `uploadUrl`
2. PUT to `uploadUrl` with blob
3. POST `/api/recordings/{recordingId}/finalize` → Trigger processing
4. Call `onUploadComplete(recordingId)` callback

**Usage**:
```tsx
import { RecordingModal } from '@/app/components/recorder';

<RecordingModal
  onUploadComplete={(recordingId) => {
    console.log('Upload complete:', recordingId);
    // Navigate to recording page or show success
  }}
/>
```

**Props**:
- `onUploadComplete?: (recordingId: string) => void` - Called after successful upload

---

### 9. Teleprompter (`Teleprompter.tsx`)
**Purpose**: Scrolling teleprompter overlay

**Features**:
- Full-screen dialog with semi-transparent overlay
- Textarea for script input
- Auto-scroll with adjustable speed (0.1x - 5x)
- Playback controls: Play/Pause, Seek Up/Down, Reset
- Smooth scrolling animation
- Black background with large white text when playing

**Usage**:
```tsx
import { Teleprompter } from '@/app/components/recorder';

<Teleprompter
  isOpen={showTeleprompter}
  onClose={() => setShowTeleprompter(false)}
/>
```

**Props**:
- `isOpen: boolean` - Whether teleprompter is visible
- `onClose: () => void` - Callback when closed

**Controls**:
- Speed slider: 0.1x to 5.0x
- Play/Pause button
- Seek up/down buttons (10% of viewport)
- Reset button (returns to top, resets speed)

---

### 10. PiPWindow (`PiPWindow.tsx`)
**Purpose**: Picture-in-Picture recording controls using Document PiP API

**Features**:
- Uses `documentPictureInPicture` API (Chrome/Chromium only)
- Compact recording timer (MM:SS format)
- Pause/Resume and Stop buttons
- Status badge (Recording/Paused)
- Auto-requests PiP window on mount
- Syncs styles from parent document

**Usage**:
```tsx
import { PiPWindow } from '@/app/components/recorder';

<PiPWindow />
```

**Browser Requirements**:
- Chrome/Chromium with Document Picture-in-Picture API
- Falls back gracefully if API not available

**Window Size**: 400x200px

---

## Context Integration

All components integrate with `RecordingContext` from:
```tsx
import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';
```

### Available Context Values:
```tsx
{
  // Streams
  cameraStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  screenshareStream: MediaStream | null;
  setCameraStream: (stream: MediaStream | null) => void;
  setMicrophoneStream: (stream: MediaStream | null) => void;
  setScreenshareStream: (stream: MediaStream | null) => void;

  // Layout
  layout: 'screenAndCamera' | 'screenOnly' | 'cameraOnly';
  setLayout: (layout: RecordingLayout) => void;

  // Camera shape
  cameraShape: 'circle' | 'square';
  setCameraShape: (shape: CameraShape) => void;

  // Device settings
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  setCameraEnabled: (enabled: boolean) => void;
  setMicrophoneEnabled: (enabled: boolean) => void;

  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  recordingBlob: Blob | null;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;

  // Picture-in-Picture
  pipWindow: Window | null;
  setPipWindow: (window: Window | null) => void;

  // Teleprompter
  showTeleprompter: boolean;
  setShowTeleprompter: (show: boolean) => void;

  // Countdown
  countdown: number | null;
  setCountdown: (count: number | null) => void;
}
```

---

## Styling

All components use:
- **Tailwind CSS** with CSS variables for theming
- **shadcn/ui** component patterns
- **Lucide React** icons
- **Radix UI** primitives for accessibility

### Theme Variables Used:
- `bg-card`, `text-foreground` - Card backgrounds
- `border-border` - Borders
- `bg-muted`, `text-muted-foreground` - Secondary elements
- `bg-primary`, `text-primary-foreground` - Primary actions
- `bg-destructive`, `text-destructive` - Destructive actions (stop)
- `bg-accent`, `text-accent-foreground` - Hover states

---

## Accessibility

All components include:
- Proper ARIA labels
- Keyboard navigation support
- Focus indicators
- Screen reader support
- Semantic HTML structure
- Error messages for assistive technology

---

## Browser Compatibility

**General Features**: Modern browsers (Chrome, Firefox, Safari, Edge)

**Recording Features** (Chrome/Chromium only):
- `MediaStreamTrackProcessor`
- `MediaStreamTrackGenerator`
- `documentPictureInPicture` API

**Graceful Degradation**: Components handle missing APIs with console errors and disable features.

---

## File Structure

```
app/components/recorder/
├── VideoStreams.tsx          # Video preview with PiP overlay
├── LayoutSwitcher.tsx        # Recording mode toggle
├── ShapeSelect.tsx           # Camera shape toggle
├── CameraSelect.tsx          # Camera device selector
├── MicrophoneSelect.tsx      # Microphone device selector
├── TeleprompterSelect.tsx    # Teleprompter toggle switch
├── MainRecordButton.tsx      # Main record/stop button
├── RecordingModal.tsx        # Post-recording modal with upload
├── Teleprompter.tsx          # Scrolling teleprompter
├── PiPWindow.tsx             # Picture-in-Picture controls
├── index.ts                  # Barrel export
└── README.md                 # This file
```

---

## Example: Complete Recording Interface

```tsx
'use client';

import {
  VideoStreams,
  LayoutSwitcher,
  ShapeSelect,
  CameraSelect,
  MicrophoneSelect,
  TeleprompterSelect,
  MainRecordButton,
  RecordingModal,
  Teleprompter,
  PiPWindow,
} from '@/app/components/recorder';
import { useRecording } from '@/app/(dashboard)/record/contexts/RecordingContext';

export function RecordingInterface() {
  const { showTeleprompter, setShowTeleprompter } = useRecording();

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Video preview */}
      <div className="aspect-video">
        <VideoStreams />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LayoutSwitcher />
        <ShapeSelect />
        <CameraSelect />
        <MicrophoneSelect />
        <TeleprompterSelect />
      </div>

      {/* Record button */}
      <div className="flex justify-center">
        <MainRecordButton />
      </div>

      {/* Modals and overlays */}
      <RecordingModal
        onUploadComplete={(id) => console.log('Recording uploaded:', id)}
      />
      <Teleprompter
        isOpen={showTeleprompter}
        onClose={() => setShowTeleprompter(false)}
      />
      <PiPWindow />
    </div>
  );
}
```

---

## Dependencies

### Required shadcn/ui components:
- `button`
- `dialog`
- `select`
- `switch`
- `toggle-group`
- `slider`
- `badge`
- `progress`
- `separator`
- `label`
- `input`
- `textarea`

### Required packages (from package.json):
- `@radix-ui/react-dialog`
- `@radix-ui/react-select`
- `@radix-ui/react-switch`
- `@radix-ui/react-toggle-group`
- `@radix-ui/react-slider`
- `@radix-ui/react-progress`
- `@radix-ui/react-separator`
- `lucide-react`
- `class-variance-authority`
- `tailwindcss`

---

## TypeScript Support

All components are fully typed with TypeScript strict mode. Types are exported from `RecordingContext`:

```tsx
import type { RecordingLayout, CameraShape } from '@/app/(dashboard)/record/contexts/RecordingContext';
```

---

## Notes

- All components require the `RecordingProvider` wrapper in the parent tree
- Components use the `'use client'` directive (Next.js App Router)
- Import paths use the `@/` alias configured in `tsconfig.json`
- Camera constants are imported from `@/app/(dashboard)/record/services/composer`
- Components follow shadcn/ui patterns for consistency with the design system
