import React from "react";

const VERSION = "0.0.1";

export default function App() {
  return (
    <div className="popup-container">
      <header className="popup-header">
        <h1 className="popup-title">Tribora</h1>
        <span className="popup-version">v{VERSION}</span>
      </header>
      <main className="popup-main">
        <div className="status-indicator status-disconnected">
          <span className="status-dot" />
          <span className="status-label">Not connected</span>
        </div>
        <p className="popup-description">
          AI-powered guidance for any web app.
        </p>
      </main>
      <footer className="popup-footer">
        <a
          href="#"
          className="popup-link"
          onClick={(e) => e.preventDefault()}
        >
          Sign in
        </a>
      </footer>
    </div>
  );
}
