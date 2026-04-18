"use client";

import { useEffect, useState } from "react";

type Stage = {
  id: "capture" | "transcribe" | "structure" | "retrieve";
  index: string;
  label: string;
  tagline: string;
  metadata: string[];
};

const STAGES: Stage[] = [
  {
    id: "capture",
    index: "§01",
    label: "CAPTURE",
    tagline: "The moment of truth.",
    metadata: [
      "SRC=screen+cam",
      "RES=1920×1080",
      "CODEC=vp9/opus",
      "LATENCY<120ms",
    ],
  },
  {
    id: "transcribe",
    index: "§02",
    label: "TRANSCRIBE",
    tagline: "Spoken to structured.",
    metadata: [
      "MODEL=deepgram nova-3",
      "WER=3.1%",
      "DIARIZATION=on",
      "LANG=auto-detect",
    ],
  },
  {
    id: "structure",
    index: "§03",
    label: "STRUCTURE",
    tagline: "Summary, steps, schema.",
    metadata: [
      "MODEL=gemini-2.5-pro",
      "CHUNK=512t/overlap-64",
      "EMBED=3072-dim",
      "CITATIONS=line-level",
    ],
  },
  {
    id: "retrieve",
    index: "§04",
    label: "RETRIEVE",
    tagline: "Answer in under ten seconds.",
    metadata: [
      "INDEX=pgvector·hnsw",
      "RERANK=cohere r3",
      "TTFB=380ms p50",
      "RECALL@5=0.94",
    ],
  },
];

/**
 * The four-module specimen diagram. Static by design — per the brief,
 * a static specimen illustration is the acceptable fallback for R3F,
 * and this *is* that illustration rendered beautifully. R3F can layer
 * on later as a progressive enhancement without touching this markup.
 *
 * Auto-advances the "focal" stage every 3.6s so the composition breathes
 * without demanding attention.
 */
export function PipelineSpecimen() {
  const [focus, setFocus] = useState(0);

  useEffect(() => {
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setFocus((f) => (f + 1) % STAGES.length);
    }, 3600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      role="img"
      aria-label="Four-stage knowledge pipeline: capture, transcribe, structure, retrieve."
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        maxWidth: 640,
        marginInline: "auto",
      }}
    >
      {/* Ambient grid backdrop */}
      <svg
        viewBox="0 0 600 600"
        preserveAspectRatio="xMidYMid slice"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
        aria-hidden
      >
        <defs>
          <pattern
            id="trb-dots"
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="0.75"
              cy="0.75"
              r="0.75"
              fill="oklch(0.42 0.01 68)"
            />
          </pattern>
          <radialGradient id="trb-mask" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="#000" stopOpacity="1" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id="trb-dots-mask">
            <rect width="600" height="600" fill="url(#trb-mask)" />
          </mask>

          <linearGradient id="trb-trace" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.78 0.155 72 / 0)" />
            <stop offset="35%" stopColor="oklch(0.78 0.155 72 / 0.55)" />
            <stop offset="100%" stopColor="oklch(0.78 0.155 72 / 0)" />
          </linearGradient>
        </defs>

        <rect
          width="600"
          height="600"
          fill="url(#trb-dots)"
          mask="url(#trb-dots-mask)"
        />

        {/* Connecting traces between module centers */}
        {/* Module centers (in 600x600 space):
              capture:    (120, 150)
              transcribe: (480, 200)
              structure:  (140, 420)
              retrieve:   (470, 440)
        */}
        <g stroke="oklch(0.32 0.012 64)" strokeWidth="0.8" fill="none">
          <path d="M 190 150 L 410 200" />
          <path d="M 470 235 L 170 395" />
          <path d="M 215 420 L 400 440" />
        </g>

        {/* Active trace highlighted in amber — pulses along */}
        <g fill="none" strokeWidth="1" strokeLinecap="round">
          {focus === 0 && (
            <path
              d="M 190 150 L 410 200"
              stroke="url(#trb-trace)"
              strokeWidth="1.25"
            />
          )}
          {focus === 1 && (
            <path
              d="M 470 235 L 170 395"
              stroke="url(#trb-trace)"
              strokeWidth="1.25"
            />
          )}
          {focus === 2 && (
            <path
              d="M 215 420 L 400 440"
              stroke="url(#trb-trace)"
              strokeWidth="1.25"
            />
          )}
          {focus === 3 && (
            <g>
              {/* retrieve loops back to capture ghost */}
              <path
                d="M 420 440 Q 600 300 300 150 Q 200 100 120 120"
                stroke="oklch(0.78 0.155 72 / 0.32)"
                strokeWidth="0.8"
                strokeDasharray="2 4"
              />
            </g>
          )}
        </g>
      </svg>

      {/* Four modules */}
      {STAGES.map((stage, i) => (
        <Module
          key={stage.id}
          stage={stage}
          focused={focus === i}
          position={MODULE_POSITIONS[i]}
          onFocus={() => setFocus(i)}
        />
      ))}

      {/* Bottom-left specimen cartouche */}
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: -6,
          display: "flex",
          gap: 14,
          alignItems: "baseline",
          fontFamily: "var(--trb-font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--trb-ink-faint)",
        }}
      >
        <span>TRIBORA / PIPELINE</span>
        <span>·</span>
        <span>FIG 1</span>
        <span>·</span>
        <span>REV 2026-04</span>
      </div>
    </div>
  );
}

const MODULE_POSITIONS: Array<{ top: string; left: string; right?: string }> = [
  { top: "12%", left: "4%" },
  { top: "18%", left: "54%" },
  { top: "56%", left: "8%" },
  { top: "62%", left: "56%" },
];

function Module({
  stage,
  focused,
  position,
  onFocus,
}: {
  stage: Stage;
  focused: boolean;
  position: { top: string; left: string };
  onFocus: () => void;
}) {
  return (
    <div
      onMouseEnter={onFocus}
      onFocus={onFocus}
      tabIndex={0}
      role="group"
      aria-label={`${stage.index} ${stage.label} — ${stage.tagline}`}
      style={{
        position: "absolute",
        top: position.top,
        left: position.left,
        width: "40%",
        minWidth: 210,
        padding: "0.625rem 0.75rem 0.6875rem",
        background: focused
          ? "oklch(0.172 0.008 60)"
          : "oklch(0.152 0.008 60)",
        border: `1px solid ${
          focused ? "oklch(0.78 0.155 72 / 0.58)" : "var(--trb-line)"
        }`,
        transition:
          "border-color var(--trb-dur-med) var(--trb-ease), background-color var(--trb-dur-med) var(--trb-ease)",
        outline: "none",
      }}
    >
      {/* Header row: index + label + focus indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
          <span
            style={{
              fontFamily: "var(--trb-font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              color: focused ? "var(--trb-signal)" : "var(--trb-ink-faint)",
              fontWeight: 500,
            }}
          >
            {stage.index}
          </span>
          <span
            style={{
              fontFamily: "var(--trb-font-display)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: "var(--trb-ink)",
            }}
          >
            {stage.label}
          </span>
        </div>
        <span
          aria-hidden
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: focused
              ? "var(--trb-signal)"
              : "oklch(0.40 0.012 68)",
            transition: "background-color var(--trb-dur-med) var(--trb-ease)",
            boxShadow: focused
              ? "0 0 0 3px oklch(0.78 0.155 72 / 0.18)"
              : "none",
          }}
        />
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily: "var(--trb-font-display)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--trb-ink-muted)",
          letterSpacing: "-0.005em",
          marginBottom: 10,
          lineHeight: 1.25,
        }}
      >
        {stage.tagline}
      </div>

      {/* Hairline separator */}
      <div
        style={{
          height: 1,
          background: "var(--trb-line)",
          marginBottom: 8,
        }}
      />

      {/* Metadata ticker — four mono rows */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 2,
        }}
      >
        {stage.metadata.map((row, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--trb-font-mono)",
              fontSize: 10,
              letterSpacing: "0.04em",
              color:
                focused && i === 0
                  ? "var(--trb-ink)"
                  : "var(--trb-ink-dim)",
              lineHeight: 1.5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            <span style={{ color: "var(--trb-ink-faint)" }}>›</span>{" "}
            {row}
          </div>
        ))}
      </div>
    </div>
  );
}
