'use client';

export default function BrowserNotSupported() {
  return (
    <div className="bg-card rounded-lg border border-border p-12">
      <div className="text-center max-w-2xl mx-auto">
        <div className="text-6xl mb-6">🚫</div>
        <h2 className="text-2xl font-bold text-foreground mb-4">
          Browser Not Supported
        </h2>
        <p className="text-muted-foreground mb-6">
          This application requires a Chromium-based browser (Chrome, Edge,
          Brave, etc.) with support for:
        </p>
        <ul className="text-left space-y-2 mb-8 text-foreground">
          <li className="flex items-center">
            <span className="mr-2">•</span>
            <code className="bg-muted px-2 py-1 rounded text-sm">
              documentPictureInPicture
            </code>
          </li>
          <li className="flex items-center">
            <span className="mr-2">•</span>
            <code className="bg-muted px-2 py-1 rounded text-sm">
              MediaStreamTrackProcessor
            </code>
          </li>
          <li className="flex items-center">
            <span className="mr-2">•</span>
            <code className="bg-muted px-2 py-1 rounded text-sm">
              MediaStreamTrackGenerator
            </code>
          </li>
        </ul>
        <div className="bg-info/10 border border-info/20 rounded-lg p-4">
          <p className="text-sm text-info">
            <strong>Recommended:</strong> Use the latest version of Google
            Chrome, Microsoft Edge, or Brave Browser.
          </p>
        </div>
      </div>
    </div>
  );
}
