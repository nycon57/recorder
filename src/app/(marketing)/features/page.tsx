import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────────────────────── */

const HERO_STATS = [
  { label: "ACCURACY", value: "95%", caption: "TRANSCRIPTION" },
  { label: "LATENCY", value: "< 2m", caption: "PROCESSING" },
  { label: "LANGUAGES", value: "50+", caption: "SUPPORTED" },
  { label: "COMPLIANCE", value: "100%", caption: "SOC 2 TYPE II" },
];

const FEATURE_HIGHLIGHTS = [
  {
    mark: "F-01",
    title: "Browser Recording",
    description:
      "Screen, camera, audio, straight from the tab. No download, no plugin, no IT ticket.",
  },
  {
    mark: "F-02",
    title: "AI Transcription",
    description:
      "Whisper-backed, 95%+ accuracy, word-level timestamps across 50+ languages.",
  },
  {
    mark: "F-03",
    title: "Semantic Search",
    description:
      "Context-aware retrieval that understands the question, not just the keywords.",
  },
  {
    mark: "F-04",
    title: "RAG Assistant",
    description:
      "Answer desks, cited back to the exact second of the exact clip. No hallucination.",
  },
  {
    mark: "F-05",
    title: "Auto Documentation",
    description:
      "Structured docs generated from the recording, editable in place, exportable.",
  },
  {
    mark: "F-06",
    title: "Knowledge Graph",
    description:
      "Cross-clip concept linking. Every answer pulls from every recording that touches it.",
  },
];

const DEEP_DIVE = [
  {
    id: "recording",
    mark: "§A",
    suffix: "/ CAPTURE",
    title: "Browser-based recording",
    subtitle: "Zero-friction capture.",
    description:
      "Start recording in seconds, straight from the browser. Screen, camera, mic — captured at studio fidelity with no plugin and no reinstall.",
    bullets: [
      "Screen share with system audio",
      "Picture-in-picture webcam overlay",
      "High-fidelity microphone path",
      "Live preview, device selection",
      "Automatic quality optimization",
      "Resume interrupted recordings",
    ],
  },
  {
    id: "transcription",
    mark: "§B",
    suffix: "/ TRANSCRIBE",
    title: "AI-powered transcription",
    subtitle: "Spoken words become searchable text.",
    description:
      "Whisper under the hood, word-level timestamps on top. Accurate across 50+ languages with editable, auto-saved transcripts.",
    bullets: [
      "Word-level timestamps",
      "50+ language support",
      "Speaker detection and labeling",
      "Editable transcripts, auto-saved",
      "Export to TXT, SRT, VTT",
      "Real-time transcription preview",
    ],
  },
  {
    id: "search",
    mark: "§C",
    suffix: "/ SEARCH",
    title: "Semantic search",
    subtitle: "Find what you meant, not what you typed.",
    description:
      "pgvector + embeddings that understand synonyms, intent, and context. Results rank by relevance, jump you straight to the moment.",
    bullets: [
      "Context-aware retrieval",
      "Search across all recordings at once",
      "Jump to exact timestamp",
      "Filter by date, speaker, topic",
      "Natural language queries",
      "Relevance-ranked results",
    ],
  },
  {
    id: "assistant",
    mark: "§D",
    suffix: "/ ANSWER",
    title: "RAG AI assistant",
    subtitle: "Your knowledge base, in conversation.",
    description:
      "Ask a question in natural language. Get an answer cited back to the exact clip, the exact timestamp. Follow-up questions stay in-thread.",
    bullets: [
      "Natural-language chat interface",
      "Answers with source citations",
      "Cross-recording synthesis",
      "Follow-up question threading",
      "Conversation history per user",
      "Per-recording and workspace scopes",
    ],
  },
  {
    id: "documentation",
    mark: "§E",
    suffix: "/ DOCUMENT",
    title: "Auto documentation",
    subtitle: "Recordings become structured docs.",
    description:
      "AI parses the clip, extracts structure, and produces an editable document with summary, key points, and action items — ready to ship.",
    bullets: [
      "Automatic headings and structure",
      "Executive summaries generated",
      "Key points and action items",
      "Fully editable and customizable",
      "Export to Markdown, PDF, HTML",
      "Templates for consistency",
    ],
  },
  {
    id: "collaboration",
    mark: "§F",
    suffix: "/ SHARE",
    title: "Team collaboration",
    subtitle: "Knowledge multiplied across the org.",
    description:
      "Role-based access, org hierarchy, SSO. The senior rep’s knowledge stays reachable after they’re off the clock — or off the payroll.",
    bullets: [
      "Organization and department management",
      "Role-based access control (RBAC)",
      "Public, private, link sharing",
      "Comments and annotations",
      "Usage analytics dashboard",
      "SSO and SAML integration",
    ],
  },
];

const COMPARISON_DATA = [
  { feature: "Recording quality", tribora: "up to 4K", competitorA: "1080p", competitorB: "720p" },
  { feature: "Transcription accuracy", tribora: "95%+", competitorA: "85%", competitorB: "80%" },
  { feature: "AI documentation", tribora: true, competitorA: false, competitorB: false },
  { feature: "Semantic search", tribora: true, competitorA: "basic", competitorB: false },
  { feature: "RAG AI assistant", tribora: true, competitorA: false, competitorB: false },
  { feature: "Knowledge graph", tribora: true, competitorA: false, competitorB: false },
  { feature: "Bidirectional sync", tribora: true, competitorA: false, competitorB: false },
  { feature: "Team members", tribora: "unlimited", competitorA: "up to 10", competitorB: "up to 5" },
  { feature: "Storage", tribora: "unlimited", competitorA: "100 GB", competitorB: "50 GB" },
  { feature: "Languages", tribora: "50+", competitorA: "20", competitorB: "10" },
];

/* ─────────────────────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────────────────────── */

export default function FeaturesPage() {
  return (
    <>
      <Hero />
      <Bento />
      <DeepDive />
      <Compare />
      <Closing />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   HERO
   ──────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section
      className="trb-section"
      aria-labelledby="features-head"
      style={{
        position: "relative",
        paddingTop: "clamp(2.5rem, 3vw + 1rem, 4.5rem)",
        paddingBottom: "clamp(3rem, 4vw + 1rem, 5rem)",
      }}
    >
      <div
        aria-hidden
        className="trb-grid-overlay"
        style={{ inset: 0, position: "absolute", zIndex: 0 }}
      />

      <div className="trb-inner" style={{ position: "relative", zIndex: 1 }}>
        <SectionMarkerRow mark="§01" label="/ FEATURES" index="PAGE 04 OF 07" />

        <h1
          id="features-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "var(--trb-size-display-l)",
            marginTop: "1.25rem",
            marginBottom: "1.5rem",
            maxWidth: "16ch",
          }}
        >
          Record it once.{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            Answer it forever.
          </span>
          <span style={{ color: "var(--trb-signal)" }}>.</span>
        </h1>

        <p
          data-reveal
          style={{
            maxWidth: "58ch",
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            color: "var(--trb-ink-muted)",
            marginBottom: "2.5rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          A ninety-second screen share becomes a cited, searchable answer your
          whole team can find &mdash; in the exact tool where they got stuck.
        </p>

        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 0,
            borderLeft: "1px solid var(--trb-line)",
            borderTop: "1px solid var(--trb-line)",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "160ms",
          }}
        >
          {HERO_STATS.map((stat) => (
            <div
              key={stat.label}
              style={{
                borderRight: "1px solid var(--trb-line)",
                borderBottom: "1px solid var(--trb-line)",
                padding: "1rem 1.125rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)" }}
              >
                {stat.label}
              </span>
              <span
                className="trb-display trb-num"
                style={{
                  fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.25rem)",
                  color: "var(--trb-ink)",
                }}
              >
                {stat.value}
              </span>
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                {stat.caption}
              </span>
            </div>
          ))}
        </div>
      </div>

      <CornerMarkers fig="FIG-01" caption="FEATURES / INDEX" />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   BENTO / HIGHLIGHT GRID
   ──────────────────────────────────────────────────────────────────────── */

function Bento() {
  return (
    <section
      className="trb-section"
      aria-labelledby="highlights-head"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§02" label="/ HIGHLIGHTS" index="6 MODULES" />

        <h2
          id="highlights-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)",
            marginTop: "1.25rem",
            marginBottom: "2.5rem",
            maxWidth: "28ch",
          }}
        >
          Six modules.{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            One knowledge layer.
          </span>
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 0,
            border: "1px solid var(--trb-line)",
          }}
        >
          {FEATURE_HIGHLIGHTS.map((f, i) => (
            <article
              key={f.mark}
              data-reveal
              style={{
                padding: "1.5rem 1.25rem 1.75rem",
                borderRight: "1px solid var(--trb-line)",
                borderBottom: "1px solid var(--trb-line)",
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
                /* @ts-expect-error custom CSS var */
                "--trb-reveal-delay": `${i * 60}ms`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid var(--trb-line-faint)",
                }}
              >
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-signal)" }}
                >
                  {f.mark}
                </span>
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-ink-faint)" }}
                >
                  MOD / {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="trb-display" style={{ fontSize: "1.25rem" }}>
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: "var(--trb-size-body-s)",
                  lineHeight: 1.6,
                  color: "var(--trb-ink-muted)",
                }}
              >
                {f.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   DEEP DIVE
   ──────────────────────────────────────────────────────────────────────── */

function DeepDive() {
  return (
    <section
      className="trb-section"
      aria-labelledby="deepdive-head"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
        background: "var(--trb-surface-1)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§03" label="/ DEEP DIVE" index="§A–F" />

        <h2
          id="deepdive-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)",
            marginTop: "1.25rem",
            marginBottom: "3rem",
            maxWidth: "28ch",
          }}
        >
          Every surface,{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            with the wires showing.
          </span>
        </h2>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {DEEP_DIVE.map((d, i) => (
            <DeepDiveRow key={d.id} item={d} reverse={i % 2 === 1} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DeepDiveRow({
  item,
  reverse,
  index,
}: {
  item: (typeof DEEP_DIVE)[number];
  reverse: boolean;
  index: number;
}) {
  return (
    <article
      data-reveal
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
        gap: "clamp(2rem, 5vw, 4rem)",
        alignItems: "start",
        padding: "clamp(2rem, 4vw, 3rem) 0",
        borderTop: index === 0 ? "1px solid var(--trb-line)" : "none",
        borderBottom: "1px solid var(--trb-line)",
        direction: reverse ? "rtl" : "ltr",
        /* @ts-expect-error custom CSS var */
        "--trb-reveal-delay": `${index * 60}ms`,
      }}
    >
      <div style={{ direction: "ltr", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.625rem",
            paddingBottom: "0.625rem",
            borderBottom: "1px solid var(--trb-line)",
            marginBottom: "1.25rem",
          }}
        >
          <span className="trb-mono-sm" style={{ color: "var(--trb-signal)" }}>
            {item.mark}
          </span>
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
            {item.suffix}
          </span>
        </div>

        <h3
          className="trb-display"
          style={{
            fontSize: "clamp(1.5rem, 1.1rem + 1vw, 2rem)",
            marginBottom: "0.5rem",
          }}
        >
          {item.title}
        </h3>
        <p
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-muted)",
            letterSpacing: "0.08em",
            marginBottom: "1rem",
          }}
        >
          {item.subtitle}
        </p>
        <p
          style={{
            fontSize: "var(--trb-size-body-m)",
            lineHeight: 1.65,
            color: "var(--trb-ink-muted)",
            maxWidth: "52ch",
          }}
        >
          {item.description}
        </p>
      </div>

      <ul
        style={{
          direction: "ltr",
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          borderLeft: "1px solid var(--trb-line)",
          borderTop: "1px solid var(--trb-line)",
          background: "var(--trb-surface-0)",
          minWidth: 0,
        }}
      >
        {item.bullets.map((b, bi) => (
          <li
            key={bi}
            style={{
              display: "grid",
              gridTemplateColumns: "4rem 1fr",
              alignItems: "baseline",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderRight: "1px solid var(--trb-line)",
              borderBottom: "1px solid var(--trb-line)",
              fontSize: "var(--trb-size-body-s)",
              lineHeight: 1.5,
            }}
          >
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-faint)" }}
            >
              {String(bi + 1).padStart(2, "0")}
            </span>
            <span style={{ color: "var(--trb-ink)" }}>{b}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   COMPARE
   ──────────────────────────────────────────────────────────────────────── */

function Compare() {
  return (
    <section
      className="trb-section"
      aria-labelledby="compare-head"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§04" label="/ MATRIX" index="3 COLUMNS" />

        <h2
          id="compare-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)",
            marginTop: "1.25rem",
            marginBottom: "2.5rem",
            maxWidth: "28ch",
          }}
        >
          How we stack up{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            against the usual suspects.
          </span>
        </h2>

        <div
          data-reveal
          style={{
            border: "1px solid var(--trb-line)",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 620,
              borderCollapse: "collapse",
              fontFamily: "var(--trb-font-body)",
              fontSize: "var(--trb-size-body-s)",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--trb-line)",
                  background: "var(--trb-surface-1)",
                }}
              >
                <th style={headerCellStyle("left")}>FEATURE</th>
                <th
                  style={{
                    ...headerCellStyle("center"),
                    color: "var(--trb-signal)",
                    background: "var(--trb-signal-soft)",
                  }}
                >
                  TRIBORA
                </th>
                <th style={headerCellStyle("center")}>COMPETITOR A</th>
                <th style={headerCellStyle("center")}>COMPETITOR B</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_DATA.map((row, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid var(--trb-line-faint)" }}
                >
                  <td
                    style={{
                      padding: "0.875rem 1rem",
                      color: "var(--trb-ink)",
                    }}
                  >
                    {row.feature}
                  </td>
                  <td
                    style={{
                      ...cellStyle("center"),
                      background: "var(--trb-signal-soft)",
                    }}
                  >
                    <CompareValue value={row.tribora} isHighlighted />
                  </td>
                  <td style={cellStyle("center")}>
                    <CompareValue value={row.competitorA} />
                  </td>
                  <td style={cellStyle("center")}>
                    <CompareValue value={row.competitorB} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CLOSING
   ──────────────────────────────────────────────────────────────────────── */

function Closing() {
  return (
    <section
      className="trb-section"
      aria-labelledby="features-closing"
      style={{
        paddingTop: "clamp(5rem, 8vw, 8rem)",
        paddingBottom: "clamp(5rem, 8vw, 8rem)",
        borderTop: "1px solid var(--trb-line)",
        position: "relative",
        textAlign: "center",
      }}
    >
      <div
        aria-hidden
        className="trb-grid-overlay"
        style={{ inset: 0, position: "absolute", opacity: 0.45 }}
      />

      <div
        className="trb-inner"
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "clamp(1.5rem, 3vw, 2.5rem)",
        }}
      >
        <div data-reveal className="flex items-center gap-3">
          <span className="trb-mono-sm" style={{ color: "var(--trb-signal)" }}>
            §05
          </span>
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
            / TRY IT
          </span>
        </div>

        <h2
          id="features-closing"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(2.25rem, 1.5rem + 3vw, 4rem)",
            lineHeight: 1,
            maxWidth: "20ch",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          Stop reading the feature list.{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            Record the first clip.
          </span>
        </h2>

        <div
          data-reveal
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.75rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "240ms",
          }}
        >
          <Link
            href="/sign-up"
            className="trb-cta"
            style={{ padding: "0.9375rem 1.625rem 1rem", fontSize: "1rem" }}
          >
            Start free
            <span className="trb-cta-glyph">→</span>
          </Link>
          <Link
            href="/contact?type=demo"
            className="trb-ghost"
            style={{ padding: "0.875rem 1.5rem" }}
          >
            Book a demo
            <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   SHARED
   ──────────────────────────────────────────────────────────────────────── */

function SectionMarkerRow({
  mark,
  label,
  index,
}: {
  mark: string;
  label: string;
  index: string;
}) {
  return (
    <div
      data-reveal
      className="flex items-center gap-3"
      style={{
        borderTop: "1px solid var(--trb-line)",
        paddingTop: "0.625rem",
        paddingBottom: "0.25rem",
      }}
    >
      <span className="trb-mono-sm" style={{ color: "var(--trb-signal)" }}>
        {mark}
      </span>
      <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
        {label}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background: "var(--trb-line)",
        }}
      />
      <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
        {index}
      </span>
    </div>
  );
}

function CornerMarkers({ fig, caption }: { fig: string; caption: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: "1.25rem",
        right: "var(--trb-gutter)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        alignItems: "flex-end",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
        {fig} / {caption}
      </span>
      <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
        REV 2026-04-17
      </span>
    </div>
  );
}

function CompareValue({
  value,
  isHighlighted,
}: {
  value: string | boolean;
  isHighlighted?: boolean;
}) {
  if (typeof value === "boolean") {
    if (value) {
      return (
        <span
          className="trb-mono-sm"
          style={{
            color: isHighlighted ? "var(--trb-signal)" : "var(--trb-ink)",
            letterSpacing: "0.14em",
          }}
        >
          ✓
        </span>
      );
    }
    return (
      <span
        className="trb-mono-sm"
        style={{ color: "var(--trb-ink-faint)" }}
      >
        —
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: "var(--trb-font-mono)",
        fontSize: 12,
        letterSpacing: "0.04em",
        color: isHighlighted ? "var(--trb-signal)" : "var(--trb-ink-muted)",
      }}
    >
      {value}
    </span>
  );
}

function headerCellStyle(align: "left" | "center"): React.CSSProperties {
  return {
    fontFamily: "var(--trb-font-mono)",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.14em",
    textAlign: align,
    color: "var(--trb-ink-dim)",
    padding: "0.75rem 1rem",
    textTransform: "uppercase",
  };
}

function cellStyle(align: "left" | "center"): React.CSSProperties {
  return {
    padding: "0.875rem 1rem",
    textAlign: align,
    verticalAlign: "middle",
    color: "var(--trb-ink-muted)",
  };
}
