"use client";

import { useEffect, useRef, useState } from "react";

type Metric = {
  value: number;
  prefix?: string;
  suffix?: string;
  signed?: boolean;       // prepend a signal-colored minus
  label: string;
  context: string;
  decimals?: number;
};

const METRICS: Metric[] = [
  {
    value: -62,
    suffix: "%",
    signed: true,
    label: "ONBOARDING TIME",
    context: "AVG · PILOT COHORT · n=14",
  },
  {
    value: 9.4,
    decimals: 1,
    suffix: "s",
    label: "TIME TO ANSWER",
    context: "RETRIEVAL P50 · ENTERPRISE LIBRARY",
  },
  {
    value: 100,
    suffix: "%",
    label: "CITATIONS RESOLVED",
    context: "LINE-LEVEL · TO SOURCE TIMESTAMP",
  },
  {
    value: 3.1,
    decimals: 1,
    suffix: "%",
    label: "WORD-ERROR RATE",
    context: "EN-US · DEEPGRAM NOVA-3",
  },
];

export function Metrics() {
  return (
    <section
      id="metrics"
      className="trb-section"
      aria-labelledby="metrics-head"
      style={{
        paddingTop: "clamp(5rem, 8vw, 8rem)",
        paddingBottom: "clamp(5rem, 8vw, 8rem)",
        borderTop: "1px solid var(--trb-line)",
      }}
    >
      <div className="trb-inner">
        {/* Header */}
        <div
          data-reveal
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1rem",
            borderBottom: "1px solid var(--trb-line)",
            paddingBottom: "0.875rem",
            marginBottom: "clamp(2.5rem, 4vw, 4rem)",
            flexWrap: "wrap",
          }}
        >
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-signal)" }}
          >
            §05
          </span>
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-dim)" }}
          >
            / OUTCOMES
          </span>
          <h2
            id="metrics-head"
            style={{
              fontFamily: "var(--trb-font-display)",
              fontSize: "clamp(1rem, 0.75rem + 0.6vw, 1.125rem)",
              fontWeight: 500,
              color: "var(--trb-ink)",
              letterSpacing: "-0.005em",
            }}
          >
            Instrument panel &mdash; measured, not claimed.
          </h2>
          <span
            style={{
              flex: 1,
              height: 1,
              background: "var(--trb-line)",
              minWidth: 40,
            }}
          />
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-ink-faint)" }}
          >
            FIG-04 / BENCHMARKS
          </span>
        </div>

        {/* Metric instrument strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 0,
            border: "1px solid var(--trb-line)",
            background: "oklch(0.15 0.008 60)",
          }}
        >
          {METRICS.map((m, i) => (
            <MetricCell key={i} metric={m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCell({ metric, index }: { metric: Metric; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCurrent(metric.value);
      return;
    }
    const duration = 900;
    const start = performance.now();
    const from = 0;
    const to = metric.value;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // ease-out-quint
      const eased = 1 - Math.pow(1 - p, 5);
      setCurrent(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setCurrent(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, metric.value]);

  const decimals = metric.decimals ?? 0;
  const formatted = Math.abs(current).toFixed(decimals);
  const isNeg = metric.value < 0;

  return (
    <div
      ref={ref}
      style={{
        padding: "clamp(1.25rem, 2vw, 2rem) clamp(1rem, 2vw, 1.75rem) 1.25rem",
        borderRight: "1px solid var(--trb-line)",
        borderBottom: "1px solid var(--trb-line)",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        position: "relative",
      }}
    >
      {/* Corner index */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{ color: "var(--trb-ink-faint)" }}
        >
          METRIC / {String(index + 1).padStart(2, "0")}
        </span>
        <span
          aria-hidden
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "var(--trb-ink-faint)",
          }}
        />
      </div>

      {/* Value */}
      <div
        className="trb-num"
        style={{
          fontFamily: "var(--trb-font-display)",
          fontSize: "clamp(2.5rem, 1.4rem + 3vw, 4rem)",
          fontWeight: 600,
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
          color: "var(--trb-ink)",
          display: "flex",
          alignItems: "baseline",
          gap: 2,
          minHeight: "1em",
        }}
      >
        {isNeg && (
          <span
            style={{
              color: "var(--trb-signal)",
              fontWeight: 500,
              marginRight: "0.1em",
            }}
          >
            −
          </span>
        )}
        {metric.prefix}
        <span>{formatted}</span>
        <span
          style={{
            fontSize: "0.5em",
            color: "var(--trb-ink-muted)",
            fontWeight: 500,
            marginLeft: 2,
          }}
        >
          {metric.suffix}
        </span>
      </div>

      <div
        style={{
          height: 1,
          background: "var(--trb-line)",
          marginTop: "0.25rem",
        }}
      />

      {/* Label */}
      <div
        className="trb-mono-sm"
        style={{
          color: "var(--trb-ink)",
          fontSize: 11,
          letterSpacing: "0.14em",
        }}
      >
        {metric.label}
      </div>

      {/* Bracketed context */}
      <div
        className="trb-mono-sm"
        style={{
          color: "var(--trb-ink-faint)",
          fontSize: 10,
          letterSpacing: "0.1em",
        }}
      >
        [ {metric.context} ]
      </div>
    </div>
  );
}
