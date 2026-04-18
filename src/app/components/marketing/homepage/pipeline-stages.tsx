"use client";

const STAGES = [
  {
    index: "§01",
    label: "CAPTURE",
    headline: "Four streams, one ingest path.",
    body: "Screen, camera, microphone, and system audio land on a single chunked-upload endpoint. Chunks are fingerprinted so a dropped network, a closed tab, or a slept laptop resumes exactly where it left off — no duplicate bytes, no re-encodes.",
    specimen: [
      { k: "SOURCES", v: "SCREEN · CAM · SYS · MIC" },
      { k: "CODEC", v: "VP9 / OPUS" },
      { k: "RESUMES", v: "NET DROP · TAB CLOSE · SLEEP" },
    ],
  },
  {
    index: "§02",
    label: "TRANSCRIBE",
    headline: "Words, aligned to frames.",
    body: "Streaming multi-speaker transcription with word-level timestamps and automatic language detection. Each sentence is anchored to the frame it was spoken on, so downstream citations resolve to an exact second — not a fuzzy paragraph range.",
    specimen: [
      { k: "PROVIDER", v: "DEEPGRAM NOVA-3" },
      { k: "WER", v: "3.1% / EN-US" },
      { k: "DIARIZATION", v: "LINE-LEVEL" },
    ],
  },
  {
    index: "§03",
    label: "STRUCTURE",
    headline: "Extract the evidence, attach the cite.",
    body: "An LLM pass pulls steps, decisions, and named entities out of the transcript and binds each to the supporting sentence. The structured output stores a citation pointer alongside every claim, so no downstream surface ever invents a fact it cannot footnote.",
    specimen: [
      { k: "MODEL", v: "GEMINI 2.5 PRO" },
      { k: "EMBED", v: "3072-D / HNSW" },
      { k: "CITATIONS", v: "INLINE / LINE-LEVEL" },
    ],
  },
  {
    index: "§04",
    label: "RETRIEVE",
    headline: "Vector index, rerank, cite.",
    body: "Semantic search runs against a pgvector HNSW index, a learned reranker re-orders the top-k, and the answer is returned with its source quote inline. Same index powers the extension, the console, and every API call — one retrieval path, one ranking, one set of citations.",
    specimen: [
      { k: "INDEX", v: "PGVECTOR / HNSW" },
      { k: "RERANK", v: "COHERE R3" },
      { k: "TTFB", v: "380MS / P50" },
    ],
  },
];

export function PipelineStages() {
  return (
    <section
      id="pipeline"
      className="trb-section"
      aria-labelledby="pipeline-head"
      style={{
        position: "relative",
        paddingTop: "clamp(5rem, 8vw + 1rem, 9rem)",
        paddingBottom: "clamp(4rem, 6vw + 1rem, 7rem)",
        borderTop: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        {/* Section header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr minmax(0, 620px)",
            gap: "clamp(1.5rem, 3vw, 3rem)",
            marginBottom: "clamp(3rem, 6vw, 5rem)",
            alignItems: "end",
          }}
          data-reveal
        >
          <div>
            <div
              className="flex items-center gap-3"
              style={{ marginBottom: "0.75rem" }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-signal)" }}
              >
                §04
              </span>
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                / THE ENGINE
              </span>
            </div>
            <h2
              id="pipeline-head"
              className="trb-display"
              style={{
                fontSize: "var(--trb-size-display-l)",
                maxWidth: "14ch",
              }}
            >
              Under the hood,
              <br />
              <span style={{ color: "var(--trb-ink-muted)" }}>
                four stages.
              </span>
            </h2>
          </div>
          <p
            style={{
              fontSize: "var(--trb-size-body-l)",
              lineHeight: 1.55,
              color: "var(--trb-ink-muted)",
              maxWidth: "52ch",
              paddingBottom: "0.5rem",
            }}
          >
            For the technical reader. Everything you just read rides on a
            single record-through-retrieve pipeline &mdash; capture,
            transcribe, structure, retrieve. Every step preserves the
            evidence the next step needs, so a claim in the search surface
            can always trace back to the second it was spoken. This section
            is the engine; everything above is the product.
          </p>
        </div>

        {/* Stage rows */}
        <div>
          {STAGES.map((stage, i) => (
            <StageRow
              key={stage.index}
              stage={stage}
              isLast={i === STAGES.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StageRow({
  stage,
  isLast,
}: {
  stage: (typeof STAGES)[number];
  isLast: boolean;
}) {
  return (
    <div
      data-reveal
      style={{
        display: "grid",
        gridTemplateColumns:
          "minmax(0, 110px) minmax(0, 1.2fr) minmax(0, 1fr)",
        gap: "clamp(1rem, 2vw, 2.5rem)",
        padding: "2rem 0 2.25rem",
        borderTop: "1px solid var(--trb-line)",
        borderBottom: isLast ? "1px solid var(--trb-line)" : "none",
        alignItems: "start",
      }}
    >
      {/* Left rail: index + label vertical */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.1875rem",
          paddingTop: "0.25rem",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-signal)",
            fontSize: 11,
            letterSpacing: "0.14em",
          }}
        >
          {stage.index}
        </span>
        <span
          style={{
            fontFamily: "var(--trb-font-display)",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--trb-ink)",
          }}
        >
          {stage.label}
        </span>
      </div>

      {/* Middle: headline + body */}
      <div style={{ minWidth: 0 }}>
        <h3
          className="trb-display"
          style={{
            fontSize: "clamp(1.5rem, 0.9rem + 1.8vw, 2.125rem)",
            lineHeight: 1.05,
            marginBottom: "0.875rem",
            maxWidth: "26ch",
          }}
        >
          {stage.headline}
        </h3>
        <p
          style={{
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            color: "var(--trb-ink-muted)",
            maxWidth: "56ch",
          }}
        >
          {stage.body}
        </p>
      </div>

      {/* Right: specimen metadata table */}
      <div
        style={{
          border: "1px solid var(--trb-line)",
          padding: "0.875rem 1rem",
          background: "oklch(0.155 0.008 60)",
        }}
      >
        <div
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            marginBottom: "0.625rem",
            paddingBottom: "0.5rem",
            borderBottom: "1px solid var(--trb-line)",
          }}
        >
          SPEC / {stage.label}
        </div>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(80px, auto) 1fr",
            columnGap: "1rem",
            rowGap: "0.4375rem",
            margin: 0,
          }}
        >
          {stage.specimen.map((row) => (
            <div key={row.k} style={{ display: "contents" }}>
              <dt
                style={{
                  fontFamily: "var(--trb-font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: "var(--trb-ink-faint)",
                  textTransform: "uppercase",
                  margin: 0,
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
                }}
              >
                {row.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
