"use client";

import { useState } from "react";

/**
 * Shared auth UI primitives: specimen-style form field, error banner,
 * spinner, and the Google mark. All authored in Tribora's instrument
 * aesthetic — hairline borders, mono specimen labels, Warm Amber focus.
 */

export function Field({
  label,
  hint,
  type,
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  trailing,
}: {
  label: string;
  hint: string;
  type: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  trailing?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: "block" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "0.5rem",
          marginBottom: "0.375rem",
        }}
      >
        <span
          style={{
            fontFamily: "var(--trb-font-mono)",
            fontSize: "var(--trb-size-mono-s)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--trb-ink-muted)",
            fontWeight: 500,
          }}
        >
          <span style={{ color: "var(--trb-ink-faint)", marginRight: 8 }}>
            {hint}
          </span>
          {label}
        </span>
        {trailing}
      </div>
      <div
        style={{
          position: "relative",
          borderRadius: 3,
          border: "1px solid",
          borderColor: focused
            ? "var(--trb-signal-edge)"
            : "var(--trb-line-strong)",
          background: "var(--trb-surface-1)",
          transition:
            "border-color var(--trb-dur-fast) var(--trb-ease), box-shadow var(--trb-dur-fast) var(--trb-ease)",
          boxShadow: focused
            ? "0 0 0 3px var(--trb-signal-soft)"
            : "0 0 0 0 transparent",
        }}
      >
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          style={{
            width: "100%",
            display: "block",
            padding: "0.75rem 0.875rem",
            fontFamily: "var(--trb-font-body)",
            fontSize: "0.9375rem",
            letterSpacing: "0.005em",
            color: "var(--trb-ink)",
            background: "transparent",
            border: "none",
            outline: "none",
          }}
        />
      </div>
    </label>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.625rem",
        padding: "0.625rem 0.875rem",
        background: "oklch(0.26 0.08 28 / 0.35)",
        border: "1px solid oklch(0.60 0.16 28 / 0.55)",
        borderRadius: 3,
        fontSize: "0.8125rem",
        color: "oklch(0.92 0.03 28)",
      }}
    >
      <span
        aria-hidden
        className="trb-mono-sm"
        style={{
          color: "oklch(0.85 0.18 28)",
          letterSpacing: "0.14em",
          marginTop: 1,
        }}
      >
        ERR
      </span>
      <span style={{ lineHeight: 1.45 }}>{message}</span>
    </div>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        border: "1.5px solid currentColor",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "trb-spin 700ms linear infinite",
      }}
    >
      <style>{`@keyframes trb-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

export function GoogleMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
