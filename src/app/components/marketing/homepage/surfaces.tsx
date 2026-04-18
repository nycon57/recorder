"use client";

/**
 * §03 / THE FOUR PLACES — where your team actually touches Tribora.
 *
 * Relabeled from "surfaces" to plain-English verbs (Record / Organize /
 * Teach / Answer). The §A–§D mono markers and internal labels
 * (RECORDER / KNOWLEDGE BASE / TUTOR / SEARCH) survive as specimen
 * texture; the reader-facing nouns are plain.
 *
 * The KNOWLEDGE BASE row earns the most vertical space — the three-layer
 * fusion (your org · your vendor · the software) is Tribora's one real
 * differentiator, so it stays the centerpiece.
 *
 * Source of truth for copy: tasks/messaging.md §6.
 */

import type { ReactNode } from "react";

type Surface = {
  mark: string; // §A, §B, §C, §D
  label: string; // RECORDER, GRAPH, etc.
  verb: string; // contribute, organize, teach, query
  headline: string;
  body: ReactNode;
  notIt: string; // one-line "what it's not"
  spec: Array<{ k: string; v: string }>;
};

const SURFACES: Surface[] = [
  {
    mark: "§A",
    label: "RECORDER",
    verb: "record",
    headline: "One click. Ninety seconds. The answer is in the knowledge base before lunch.",
    body: (
      <>
        Screen, camera, mic, and system audio &mdash; one capture. The senior
        person on your team hits record, explains the thing once, and the
        file becomes a searchable, cited answer about ninety seconds after
        they stop. No editing. No titles. No tagging.
      </>
    ),
    notIt: "Not Loom. Loom distributes video. We keep the answer.",
    spec: [
      { k: "SOURCES", v: "SCREEN · CAM · SYS · MIC" },
      { k: "CODEC", v: "VP9 / OPUS" },
      { k: "RESUMES", v: "NET · TAB · SLEEP" },
      { k: "INGEST P50", v: "90S · STOP → SEARCHABLE" },
    ],
  },
  {
    mark: "§B",
    label: "KNOWLEDGE BASE",
    verb: "organize",
    headline: "Your team's answer beats the vendor's. Every claim cites its source.",
    body: (
      <>
        Three layers merged automatically. Your org&rsquo;s context wins on
        every conflict, then your vendor&rsquo;s playbook, then the
        software&rsquo;s public docs &mdash; and every answer shows the
        reader which layer it came from. Nobody writes pages. Pages compile
        from the recordings.
      </>
    ),
    notIt: "Not a wiki. Nobody writes pages — they compile from the recordings.",
    spec: [
      { k: "LAYERS", v: "YOUR ORG · YOUR VENDOR · THE SOFTWARE" },
      { k: "FUSION", v: "LAYER-WEIGHTED / CLUSTER-AWARE" },
      { k: "CLUSTERING", v: "LOUVAIN" },
      { k: "CONTRADICTIONS", v: "LIFECYCLE-TRACKED" },
      { k: "VALIDITY", v: "TEMPORAL / POINT-IN-TIME" },
    ],
  },
  {
    mark: "§C",
    label: "TUTOR",
    verb: "teach",
    headline: "A senior teammate, on every screen, for every new hire.",
    body: (
      <>
        A Chrome extension &mdash; or a white-label widget inside your own
        product &mdash; that reads the page your user is on, knows your
        playbook, and answers out loud. It can highlight, click, and fill
        fields to show the right way. Trained on your knowledge base, not
        the internet.
      </>
    ),
    notIt: "Not a chatbot. A teacher that arrives when the question does.",
    spec: [
      { k: "SCOPE", v: "ANY WEB APP · DOM-AWARE" },
      { k: "TRAINED ON", v: "YOUR PLAYBOOK · NOT THE INTERNET" },
      { k: "MODES", v: "VOICE + TEXT · CLICK-TO-START" },
      { k: "ACTIONS", v: "HIGHLIGHT · CLICK · FILL" },
      { k: "WHITE-LABEL", v: "SDK · NO EXTENSION REQUIRED" },
    ],
  },
  {
    mark: "§D",
    label: "SEARCH",
    verb: "answer",
    headline: "Ask in plain English. Get the ninety-second clip and the sentence that said it.",
    body: (
      <>
        Search and chat across every recording, transcript, and compiled
        page your team has ever fed it. Every result resolves to the exact
        second that answered the question, with the spoken sentence quoted
        verbatim. Every claim cites its source. Legal has no complaints.
      </>
    ),
    notIt: "Not a chat window. A review surface — trust through citations, not vibes.",
    spec: [
      { k: "INDEX", v: "PGVECTOR · HNSW" },
      { k: "EMBED", v: "3072-D" },
      { k: "RERANK", v: "COHERE R3" },
      { k: "TTFB P50", v: "380MS" },
      { k: "CITATIONS", v: "INLINE · CLICK-TO-SOURCE" },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// The three graph layers — rendered inside §B / GRAPH as the centerpiece.
// Ordered most-specific first (fusion priority) so the reader sees the
// ranking logic in the visual order itself.
// ──────────────────────────────────────────────────────────────────────────
type Layer = {
  n: string; // LAYER 03 / 02 / 01
  tier: string; // MOST SPECIFIC / MIDDLE / BASELINE
  name: string; // ORG / VENDOR / SOFTWARE
  lede: string;
  example: string;
  contributor: string;
};

const LAYERS: Layer[] = [
  {
    n: "LAYER 03",
    tier: "MOST SPECIFIC",
    name: "YOUR ORG",
    lede: "Your team's recordings, decisions, and internal know-how. Wins on every conflict.",
    example: "e.g. How your finance team actually handles a grandfathered refund, as recorded last quarter.",
    contributor: "YOUR TEAM · VIA THE RECORDER",
  },
  {
    n: "LAYER 02",
    tier: "MIDDLE",
    name: "YOUR VENDOR",
    lede: "Opinionated playbooks from the SaaS vendor — how they recommend using their own product.",
    example: "e.g. HubSpot's own best-practice playbook for enterprise sales routing.",
    contributor: "SAAS VENDOR · WHITE-LABEL PARTNER",
  },
  {
    n: "LAYER 01",
    tier: "BASELINE",
    name: "THE SOFTWARE",
    lede: "The vendor's public documentation — crawled, structured, embedded. Fallback layer.",
    example: "e.g. Jira's public docs on workflow configuration.",
    contributor: "TRIBORA · ON CRAWL",
  },
];

export function Surfaces() {
  return (
    <section
      id="surfaces"
      className="trb-section"
      aria-labelledby="surfaces-head"
      style={{
        paddingTop: "clamp(5rem, 8vw, 9rem)",
        paddingBottom: "clamp(4rem, 6vw, 7rem)",
        borderTop: "1px solid var(--trb-line)",
        position: "relative",
      }}
    >
      <div className="trb-inner">
        {/* ─── Section header ─────────────────────────────────────────── */}
        <header
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(0, 560px)",
            gap: "clamp(1.5rem, 3vw, 3rem)",
            alignItems: "end",
            marginBottom: "clamp(2.5rem, 5vw, 4.5rem)",
          }}
          className="surfaces-header"
        >
          <div>
            <div
              className="flex items-center gap-3"
              style={{ marginBottom: "0.875rem" }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-signal)" }}
              >
                §03
              </span>
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                / FOUR PLACES YOUR TEAM USES IT
              </span>
            </div>
            <h2
              id="surfaces-head"
              className="trb-display"
              style={{
                fontSize: "var(--trb-size-display-l)",
                maxWidth: "20ch",
              }}
            >
              Record. Organize.
              <br />
              <span style={{ color: "var(--trb-ink-muted)" }}>
                Teach. Answer.
              </span>
            </h2>
          </div>
          <p
            style={{
              color: "var(--trb-ink-muted)",
              fontSize: "var(--trb-size-body-l)",
              lineHeight: 1.55,
              maxWidth: "54ch",
              paddingBottom: "0.375rem",
            }}
          >
            Four things your team already does every day. Tribora just makes
            each one compound &mdash; so the knowledge grows instead of
            getting re-done every quarter. One shared memory underneath,
            four places your team actually touches it.
          </p>
        </header>

        {/* ─── Surface rows ───────────────────────────────────────────── */}
        <div
          style={{
            borderTop: "1px solid var(--trb-line-strong)",
          }}
        >
          {SURFACES.map((s, i) => (
            <SurfaceRow key={s.mark} surface={s} index={i} />
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1020px) {
          :global(.surfaces-header) {
            grid-template-columns: 1fr !important;
            align-items: start !important;
            row-gap: 1.25rem;
          }
        }
        @media (max-width: 860px) {
          :global(.surface-row) {
            grid-template-columns: 1fr !important;
            column-gap: 0 !important;
            row-gap: 1.25rem !important;
          }
          :global(.surface-row) :global(aside[aria-label$="specifications"]) {
            order: 3;
          }
        }
        @media (max-width: 700px) {
          :global(.layer-row) {
            grid-template-columns: 1fr !important;
            row-gap: 0.5rem;
          }
        }
      `}</style>
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// A single surface row. RECORDER/EXTENSION/CONSOLE use the compact layout;
// GRAPH renders the layered table as a nested sub-section.
// ──────────────────────────────────────────────────────────────────────────
function SurfaceRow({
  surface,
  index,
}: {
  surface: Surface;
  index: number;
}) {
  const isGraph = surface.label === "KNOWLEDGE BASE";

  return (
    <article
      data-reveal
      aria-labelledby={`surface-${surface.label.toLowerCase().replace(/\s+/g, "-")}`}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 128px) minmax(0, 1fr) minmax(260px, 360px)",
        columnGap: "clamp(1rem, 2.2vw, 2.75rem)",
        rowGap: "clamp(1.25rem, 2vw, 1.75rem)",
        padding: "clamp(2.25rem, 3.5vw, 3.25rem) 0",
        borderBottom: "1px solid var(--trb-line-strong)",
        alignItems: "start",
        // @ts-expect-error custom CSS var
        "--trb-reveal-delay": `${index * 60}ms`,
      }}
      className="surface-row"
    >
      {/* Left rail: mark + label + verb */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          paddingTop: "0.375rem",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-signal)",
            fontSize: 11,
            letterSpacing: "0.16em",
            fontWeight: 600,
          }}
        >
          {surface.mark}
        </span>
        <span
          style={{
            fontFamily: "var(--trb-font-display)",
            fontSize: "clamp(1rem, 0.6rem + 0.7vw, 1.25rem)",
            fontWeight: 600,
            letterSpacing: "0.015em",
            color: "var(--trb-ink)",
          }}
        >
          {surface.label}
        </span>
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            marginTop: "0.1875rem",
          }}
        >
          {surface.verb}
        </span>
      </div>

      {/* Middle: headline + body + "what it's not" footnote */}
      <div style={{ minWidth: 0 }}>
        <h3
          id={`surface-${surface.label.toLowerCase().replace(/\s+/g, "-")}`}
          className="trb-display"
          style={{
            fontSize: "clamp(1.625rem, 0.9rem + 2vw, 2.5rem)",
            lineHeight: 1.04,
            marginBottom: "1rem",
            maxWidth: "24ch",
          }}
        >
          {surface.headline}
        </h3>
        <p
          style={{
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            color: "var(--trb-ink-muted)",
            maxWidth: "56ch",
            marginBottom: "1.25rem",
          }}
        >
          {surface.body}
        </p>
        <p
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            letterSpacing: "0.04em",
            textTransform: "none",
            fontSize: 11,
            lineHeight: 1.55,
            maxWidth: "56ch",
            fontFamily: "var(--trb-font-mono)",
            paddingLeft: "0.75rem",
            position: "relative",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: "0.6em",
              fontFamily: "var(--trb-font-mono)",
              fontSize: 10,
              color: "var(--trb-signal)",
              letterSpacing: 0,
            }}
          >
            ⊘
          </span>
          {surface.notIt}
        </p>
      </div>

      {/* Right: specimen metadata */}
      <SpecimenPanel label={surface.label} rows={surface.spec} />

      {/* GRAPH only: nested three-layer table spanning the full row width */}
      {isGraph && (
        <div
          style={{
            gridColumn: "1 / -1",
            marginTop: "clamp(1.25rem, 2.5vw, 2rem)",
          }}
        >
          <LayerTable />
        </div>
      )}
    </article>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Specimen metadata panel (right column on each surface row).
// ──────────────────────────────────────────────────────────────────────────
function SpecimenPanel({
  label,
  rows,
}: {
  label: string;
  rows: Array<{ k: string; v: string }>;
}) {
  return (
    <aside
      aria-label={`${label} specifications`}
      style={{
        border: "1px solid var(--trb-line)",
        padding: "0.875rem 1rem 1rem",
        background: "oklch(0.155 0.008 60)",
        minWidth: 0,
      }}
    >
      <div
        className="trb-mono-sm"
        style={{
          color: "var(--trb-ink-faint)",
          marginBottom: "0.75rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid var(--trb-line)",
          fontSize: 10,
          letterSpacing: "0.14em",
        }}
      >
        SPEC / {label}
      </div>
      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(86px, auto) 1fr",
          columnGap: "1rem",
          rowGap: "0.5rem",
          margin: 0,
        }}
      >
        {rows.map((row) => (
          <div key={row.k} style={{ display: "contents" }}>
            <dt
              style={{
                fontFamily: "var(--trb-font-mono)",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "var(--trb-ink-faint)",
                textTransform: "uppercase",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {row.k}
            </dt>
            <dd
              style={{
                fontFamily: "var(--trb-font-mono)",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "var(--trb-ink)",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {row.v}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// The three-layer table — the differentiator. Rendered inside §B / GRAPH.
// Layered visual: top = most specific (ORG), bottom = baseline (SOFTWARE).
// A mono "fusion direction" marker at the top-right makes the ranking
// order literal.
// ──────────────────────────────────────────────────────────────────────────
function LayerTable() {
  return (
    <div
      role="region"
      aria-label="Three-layer knowledge fusion"
      style={{
        border: "1px solid var(--trb-line-strong)",
        background: "oklch(0.152 0.008 60)",
        position: "relative",
      }}
    >
      {/* Header strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem 0.75rem 1.125rem",
          borderBottom: "1px solid var(--trb-line-strong)",
          background: "oklch(0.168 0.008 60)",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div className="flex items-baseline gap-3">
          <span
            className="trb-mono-sm"
            style={{
              color: "var(--trb-signal)",
              fontSize: 10,
              letterSpacing: "0.14em",
            }}
          >
            FIG-B.1
          </span>
          <span
            className="trb-mono-sm"
            style={{
              color: "var(--trb-ink-dim)",
              fontSize: 10,
              letterSpacing: "0.14em",
            }}
          >
            / THREE-LAYER FUSION
          </span>
        </div>
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            fontSize: 10,
            letterSpacing: "0.12em",
          }}
        >
          FUSION ORDER ·{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>YOUR ORG</span>
          {" → "}
          <span style={{ color: "var(--trb-ink-muted)" }}>YOUR VENDOR</span>
          {" → "}
          <span style={{ color: "var(--trb-ink-muted)" }}>THE SOFTWARE</span>
        </span>
      </div>

      {/* Layer rows */}
      <div>
        {LAYERS.map((layer, i) => (
          <LayerRow key={layer.name} layer={layer} isLast={i === LAYERS.length - 1} />
        ))}
      </div>
    </div>
  );
}

function LayerRow({ layer, isLast }: { layer: Layer; isLast: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 156px) minmax(0, 1.2fr) minmax(0, 1fr)",
        columnGap: "clamp(1rem, 2vw, 2rem)",
        padding: "1.125rem 1.125rem 1.25rem",
        borderBottom: isLast ? "none" : "1px solid var(--trb-line)",
        alignItems: "start",
      }}
      className="layer-row"
    >
      {/* Left: layer number + name */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            fontSize: 10,
            letterSpacing: "0.14em",
          }}
        >
          {layer.n} · {layer.tier}
        </span>
        <span
          style={{
            fontFamily: "var(--trb-font-display)",
            fontSize: "clamp(1.125rem, 0.6rem + 0.8vw, 1.375rem)",
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "var(--trb-ink)",
          }}
        >
          {layer.name}
        </span>
      </div>

      {/* Middle: description + example */}
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: "var(--trb-size-body-m)",
            lineHeight: 1.55,
            color: "var(--trb-ink-muted)",
            marginBottom: "0.5rem",
            maxWidth: "52ch",
          }}
        >
          {layer.lede}
        </p>
        <p
          style={{
            fontFamily: "var(--trb-font-mono)",
            fontSize: 11,
            letterSpacing: "0.02em",
            color: "var(--trb-ink-dim)",
            maxWidth: "58ch",
            lineHeight: 1.5,
          }}
        >
          {layer.example}
        </p>
      </div>

      {/* Right: contributor */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          paddingTop: "0.1875rem",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            fontSize: 10,
            letterSpacing: "0.14em",
          }}
        >
          CONTRIBUTED BY
        </span>
        <span
          style={{
            fontFamily: "var(--trb-font-mono)",
            fontSize: 11,
            letterSpacing: "0.04em",
            color: "var(--trb-ink)",
          }}
        >
          {layer.contributor}
        </span>
      </div>
    </div>
  );
}
