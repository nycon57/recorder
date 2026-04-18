import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────────────────────── */

const NARRATIVE_PILLARS = [
  {
    mark: "P-01",
    title: "The Tribe",
    description:
      "Every team has one or two people who know how the work actually gets done. When they answer a question for the fortieth time — or worse, when they leave — the rest of the team slows down. Tribora captures what they know before either of those things happens.",
  },
  {
    mark: "P-02",
    title: "The Aurora",
    description:
      "Most team knowledge lives in the dark: inside a senior rep’s head, in a forgotten Slack thread, in a screenshare that nobody recorded. Tribora turns those ninety-second explanations into searchable, cited answers your whole team can find.",
  },
  {
    mark: "P-03",
    title: "The Connective Thread",
    description:
      "One person explains a task once. A new hire finds it three months later, in the exact tool where they got stuck, with a citation back to the second it was said. The senior person’s time compounds instead of being spent on the same question again.",
  },
  {
    mark: "P-04",
    title: "The Dawn of Understanding",
    description:
      "Every recording becomes an answer. Every answer stays cited to the moment it was spoken. The goal isn’t a wiki — it’s an always-on tutor, trained on your team instead of the internet.",
  },
];

const VALUES = [
  {
    mark: "V-01",
    title: "Simplicity first",
    description:
      "Powerful features shouldn’t need complex workflows. Ease of use without giving up capability.",
  },
  {
    mark: "V-02",
    title: "Privacy & security",
    description:
      "Your knowledge is valuable. We protect it with enterprise-grade security and transparent data practices.",
  },
  {
    mark: "V-03",
    title: "Speed & reliability",
    description:
      "Knowledge should be instant. Built for performance and uptime so the answer is there when you need it.",
  },
  {
    mark: "V-04",
    title: "Customer success",
    description:
      "We succeed when you do. Your feedback drives the roadmap. Our support team answers.",
  },
];

const STATS = [
  { label: "USERS", value: "10K+", caption: "ACTIVE" },
  { label: "RECORDINGS", value: "1M+", caption: "PROCESSED" },
  { label: "UPTIME", value: "99.9%", caption: "GUARANTEED" },
  { label: "COUNTRIES", value: "50+", caption: "SERVED" },
];

const MILESTONES = [
  {
    mark: "2023 · Q3",
    title: "The Spark",
    description:
      "Tribora was born from a simple idea: stop making senior reps answer the same question forty times.",
  },
  {
    mark: "2023 · Q4",
    title: "Beta Launch",
    description:
      "Released to 100 design partners. Their feedback shaped the product that shipped publicly.",
  },
  {
    mark: "2024 · Q2",
    title: "Public Launch",
    description:
      "Opened to the public with transcription, auto-docs, and semantic search out of the box.",
  },
  {
    mark: "2024 · Q4",
    title: "Knowledge Graph",
    description:
      "Cross-recording concept linking: every answer pulls from every clip that touches it.",
  },
];

const TEAM = [
  {
    mark: "R-01",
    name: "Sarah Chen",
    role: "Co-Founder · CEO",
    bio: "Former engineering lead at a Fortune 500 tech company. Believes knowledge should be accessible to everyone on the team, not just the senior ones.",
    initials: "SC",
  },
  {
    mark: "R-02",
    name: "Michael Rodriguez",
    role: "Co-Founder · CTO",
    bio: "AI researcher with a PhD in NLP. Building the retrieval and reasoning layer that turns raw clips into cited answers.",
    initials: "MR",
  },
  {
    mark: "R-03",
    name: "Emily Watson",
    role: "Head of Product",
    bio: "Ten-plus years shipping product that senior operators actually keep using after week one. Here for the interview-to-ship loop.",
    initials: "EW",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────────────────────── */

export default function AboutPage() {
  return (
    <>
      <Hero />
      <Stats />
      <Story />
      <Values />
      <Timeline />
      <Team />
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
      aria-labelledby="about-head"
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
        <SectionMarkerRow mark="§01" label="/ ABOUT" index="PAGE 03 OF 07" />

        <h1
          id="about-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "var(--trb-size-display-l)",
            marginTop: "1.25rem",
            marginBottom: "1.5rem",
            maxWidth: "18ch",
          }}
        >
          Every team has a senior rep who answers{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            the same question forty times
          </span>
          <span style={{ color: "var(--trb-signal)" }}>.</span>
        </h1>

        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 52ch) minmax(0, 1fr)",
            gap: "clamp(2rem, 4vw, 4rem)",
            alignItems: "start",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          <p
            style={{
              fontSize: "var(--trb-size-body-l)",
              lineHeight: 1.55,
              color: "var(--trb-ink-muted)",
            }}
          >
            <span style={{ color: "var(--trb-ink)", fontWeight: 500 }}>
              Tribora
            </span>{" "}
            = <em>Tribe</em> + <em>Aurora</em>. We capture how your senior
            people actually do the work — so the same question never gets asked
            twice.
          </p>

          <div
            style={{
              fontFamily: "var(--trb-font-mono)",
              fontSize: 12,
              letterSpacing: "0.04em",
              color: "var(--trb-ink-dim)",
              borderLeft: "1px solid var(--trb-line-strong)",
              paddingLeft: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ color: "var(--trb-ink-faint)", fontSize: 11 }}>
              ETYMOLOGY
            </span>
            <span>TRI · three voices into one signal</span>
            <span>BORA · aurora on the horizon</span>
            <span style={{ color: "var(--trb-signal)" }}>
              ALWAYS-ON TUTOR · TRAINED ON YOUR TEAM
            </span>
          </div>
        </div>
      </div>

      <CornerMarkers fig="FIG-01" caption="ABOUT / INDEX" />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STATS STRIP
   ──────────────────────────────────────────────────────────────────────── */

function Stats() {
  return (
    <section
      className="trb-section"
      aria-label="Key metrics"
      style={{
        paddingTop: "clamp(2rem, 4vw, 3.5rem)",
        paddingBottom: "clamp(2rem, 4vw, 3.5rem)",
        borderTop: "1px solid var(--trb-line)",
        borderBottom: "1px solid var(--trb-line)",
        background: "var(--trb-surface-1)",
      }}
    >
      <div className="trb-inner">
        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 0,
            borderLeft: "1px solid var(--trb-line)",
            borderTop: "1px solid var(--trb-line)",
          }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              style={{
                borderRight: "1px solid var(--trb-line)",
                borderBottom: "1px solid var(--trb-line)",
                padding: "1.25rem 1.25rem 1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
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
                  fontSize: "clamp(2rem, 1.4rem + 2vw, 2.75rem)",
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
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   STORY / NARRATIVE PILLARS
   ──────────────────────────────────────────────────────────────────────── */

function Story() {
  return (
    <section
      className="trb-section"
      aria-labelledby="story-head"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§02" label="/ STORY" index="4 PILLARS" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
            gap: "clamp(2rem, 5vw, 5rem)",
            marginTop: "1.25rem",
            alignItems: "start",
          }}
        >
          <div data-reveal style={{ position: "sticky", top: "6rem" }}>
            <h2
              id="story-head"
              className="trb-display"
              style={{
                fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)",
                marginBottom: "1rem",
                maxWidth: "22ch",
              }}
            >
              Four pillars{" "}
              <span style={{ color: "var(--trb-ink-muted)" }}>
                behind the name.
              </span>
            </h2>
            <p
              style={{
                fontSize: "var(--trb-size-body-m)",
                color: "var(--trb-ink-muted)",
                maxWidth: "42ch",
                lineHeight: 1.6,
              }}
            >
              Every feature we ship traces back to one of these. Useful when
              we&rsquo;re deciding what not to build.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              borderTop: "1px solid var(--trb-line)",
            }}
          >
            {NARRATIVE_PILLARS.map((pillar, i) => (
              <article
                key={pillar.mark}
                data-reveal
                style={{
                  display: "grid",
                  gridTemplateColumns: "6rem 1fr",
                  gap: "1.25rem",
                  padding: "1.5rem 0",
                  borderBottom: "1px solid var(--trb-line)",
                  alignItems: "start",
                  /* @ts-expect-error custom CSS var */
                  "--trb-reveal-delay": `${i * 80}ms`,
                }}
              >
                <span
                  className="trb-mono-sm"
                  style={{
                    color: "var(--trb-signal)",
                    letterSpacing: "0.14em",
                    paddingTop: "0.375rem",
                  }}
                >
                  {pillar.mark}
                </span>
                <div>
                  <h3
                    className="trb-display"
                    style={{
                      fontSize: "1.375rem",
                      marginBottom: "0.625rem",
                    }}
                  >
                    {pillar.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "var(--trb-size-body-m)",
                      lineHeight: 1.65,
                      color: "var(--trb-ink-muted)",
                      maxWidth: "62ch",
                    }}
                  >
                    {pillar.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   VALUES
   ──────────────────────────────────────────────────────────────────────── */

function Values() {
  return (
    <section
      className="trb-section"
      aria-labelledby="values-head"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
        background: "var(--trb-surface-1)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§03" label="/ VALUES" index="4 ENTRIES" />

        <h2
          id="values-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)",
            marginTop: "1.25rem",
            marginBottom: "2.5rem",
            maxWidth: "24ch",
          }}
        >
          What we optimize for{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>when no one is looking.</span>
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 0,
            border: "1px solid var(--trb-line)",
          }}
        >
          {VALUES.map((v, i) => (
            <div
              key={v.mark}
              data-reveal
              style={{
                padding: "1.5rem 1.25rem",
                borderRight: "1px solid var(--trb-line)",
                borderBottom: "1px solid var(--trb-line)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                background: "var(--trb-surface-0)",
                /* @ts-expect-error custom CSS var */
                "--trb-reveal-delay": `${i * 70}ms`,
              }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)" }}
              >
                {v.mark}
              </span>
              <h3
                className="trb-display"
                style={{ fontSize: "1.1875rem" }}
              >
                {v.title}
              </h3>
              <p
                style={{
                  fontSize: "var(--trb-size-body-s)",
                  lineHeight: 1.6,
                  color: "var(--trb-ink-muted)",
                }}
              >
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TIMELINE
   ──────────────────────────────────────────────────────────────────────── */

function Timeline() {
  return (
    <section
      className="trb-section"
      aria-labelledby="timeline-head"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§04" label="/ TIMELINE" index="2023 → NOW" />

        <h2
          id="timeline-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)",
            marginTop: "1.25rem",
            marginBottom: "2.5rem",
            maxWidth: "24ch",
          }}
        >
          Milestones,{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            not a roadmap slide.
          </span>
        </h2>

        <ol
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          {MILESTONES.map((m, i) => (
            <li
              key={m.mark}
              data-reveal
              style={{
                display: "grid",
                gridTemplateColumns: "9rem 1px 1fr",
                gap: "1.5rem",
                padding: "1.25rem 0",
                borderTop: "1px solid var(--trb-line)",
                alignItems: "start",
                /* @ts-expect-error custom CSS var */
                "--trb-reveal-delay": `${i * 80}ms`,
              }}
            >
              <span
                className="trb-mono-sm"
                style={{
                  color: "var(--trb-ink-dim)",
                  letterSpacing: "0.14em",
                  paddingTop: "0.375rem",
                }}
              >
                {m.mark}
              </span>
              <span
                aria-hidden
                style={{
                  background: "var(--trb-line)",
                  alignSelf: "stretch",
                  width: 1,
                }}
              />
              <div>
                <h3
                  className="trb-display"
                  style={{
                    fontSize: "1.25rem",
                    marginBottom: "0.375rem",
                  }}
                >
                  {m.title}
                </h3>
                <p
                  style={{
                    fontSize: "var(--trb-size-body-m)",
                    lineHeight: 1.6,
                    color: "var(--trb-ink-muted)",
                    maxWidth: "60ch",
                  }}
                >
                  {m.description}
                </p>
              </div>
            </li>
          ))}
          <li
            aria-hidden
            style={{ borderTop: "1px solid var(--trb-line)", height: 1 }}
          />
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   TEAM
   ──────────────────────────────────────────────────────────────────────── */

function Team() {
  return (
    <section
      className="trb-section"
      aria-labelledby="team-head"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
        background: "var(--trb-surface-1)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§05" label="/ CREW" index="3 OF MANY" />

        <h2
          id="team-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)",
            marginTop: "1.25rem",
            marginBottom: "2.5rem",
            maxWidth: "26ch",
          }}
        >
          Built by operators{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            who’ve been the senior rep.
          </span>
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 0,
            border: "1px solid var(--trb-line)",
            background: "var(--trb-surface-0)",
          }}
        >
          {TEAM.map((t, i) => (
            <article
              key={t.mark}
              data-reveal
              style={{
                padding: "1.75rem 1.5rem",
                borderRight: "1px solid var(--trb-line)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                /* @ts-expect-error custom CSS var */
                "--trb-reveal-delay": `${i * 80}ms`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid var(--trb-line)",
                }}
              >
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-ink-faint)" }}
                >
                  {t.mark}
                </span>
                <span
                  className="trb-mono-sm"
                  style={{
                    color: "var(--trb-ink-dim)",
                    letterSpacing: "0.12em",
                  }}
                >
                  {t.initials}
                </span>
              </div>
              <div>
                <h3
                  className="trb-display"
                  style={{
                    fontSize: "1.25rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  {t.name}
                </h3>
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-signal)" }}
                >
                  {t.role}
                </span>
              </div>
              <p
                style={{
                  fontSize: "var(--trb-size-body-s)",
                  lineHeight: 1.65,
                  color: "var(--trb-ink-muted)",
                }}
              >
                {t.bio}
              </p>
            </article>
          ))}
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
      aria-labelledby="about-closing"
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
            §06
          </span>
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
            / SEE IT RUN
          </span>
        </div>

        <h2
          id="about-closing"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(2.25rem, 1.5rem + 3vw, 4rem)",
            lineHeight: 1,
            maxWidth: "22ch",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          See it answer a question{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            from your actual data.
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
            href="/contact?type=demo"
            className="trb-cta"
            style={{ padding: "0.9375rem 1.625rem 1rem", fontSize: "1rem" }}
          >
            Book a demo
            <span className="trb-cta-glyph">→</span>
          </Link>
          <Link
            href="/pricing"
            className="trb-ghost"
            style={{ padding: "0.875rem 1.5rem" }}
          >
            Compare plans
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
   SHARED FRAGMENTS
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
