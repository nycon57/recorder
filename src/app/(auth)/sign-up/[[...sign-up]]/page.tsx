"use client";

import { useState } from "react";
import { signIn, signUp } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, ErrorBanner, Spinner, GoogleMark } from "@/app/components/auth/form";

/**
 * Sign Up — two-column specimen.
 *
 * Left: registration form (same specimen sheet as sign-in, extended).
 * Right: REGISTRATION MANIFEST — a numbered §01–§04 pipeline that
 * previews what the user is about to join. Reinforces the instrument
 * metaphor without resorting to feature-card slop.
 */

const MANIFEST = [
  {
    id: "§01",
    phase: "CAPTURE",
    title: "A ninety-second screen share.",
    detail:
      "Your senior team records how the work actually gets done. No scripts, no studio lighting — just the answer.",
    meta: "≈ 90s",
  },
  {
    id: "§02",
    phase: "ENRICH",
    title: "Structured, traceable, searchable.",
    detail:
      "Every recording is transcribed, chaptered, and indexed against your playbook — not the internet.",
    meta: "pgvector",
  },
  {
    id: "§03",
    phase: "RETRIEVE",
    title: "Answers in under ten seconds.",
    detail:
      "Your team asks; the library responds with the exact moment — with receipts, not hallucinations.",
    meta: "p95 < 10s",
  },
  {
    id: "§04",
    phase: "HAND-OFF",
    title: "Share, embed, white-label.",
    detail:
      "Ship knowledge to teammates, customers, or downstream systems via links, chat, or a vendor-branded SDK.",
    meta: "SDK · SSO",
  },
];

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await signUp.email({ email, password, name });
    if (error) {
      setError(error.message || "Registration failed. Review your input and retry.");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleGoogleSignIn() {
    await signIn.social({ provider: "google", callbackURL: "/dashboard" });
  }

  return (
    <main
      className="trb-section"
      style={{
        minHeight: "100dvh",
        paddingTop: "6.5rem",
        paddingBottom: "5rem",
      }}
    >
      <div
        className="trb-inner"
        style={{
          display: "grid",
          gap: "clamp(2rem, 4vw, 5rem)",
          alignItems: "start",
          // On narrow screens: single column. At 960px+: specimen + manifest.
          gridTemplateColumns: "minmax(0, 1fr)",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "clamp(2rem, 4vw, 5rem)",
            gridTemplateColumns: "minmax(0, 1fr)",
            alignItems: "start",
          }}
          className="signup-split"
        >
          {/* Style tag: progressive enhancement to two columns on wide screens. */}
          <style>{`
            @media (min-width: 960px) {
              .signup-split {
                grid-template-columns: minmax(0, 0.95fr) minmax(0, 1fr) !important;
              }
            }
          `}</style>

          {/* LEFT — specimen form */}
          <div style={{ minWidth: 0, maxWidth: 520 }}>
            {/* Specimen marker row */}
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
                §AUTH
              </span>
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                / SIGN-UP
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--trb-line)" }} />
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)" }}
              >
                FIG-AUTH-02
              </span>
            </div>

            <h1
              data-reveal
              className="trb-display"
              style={{
                fontSize: "clamp(2rem, 1.3rem + 2.2vw, 2.75rem)",
                lineHeight: 1.02,
                marginTop: "1.5rem",
                marginBottom: "0.875rem",
                maxWidth: "15ch",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": "60ms",
              }}
            >
              Request access<span style={{ color: "var(--trb-signal)" }}>.</span>
            </h1>

            <p
              data-reveal
              style={{
                fontSize: "var(--trb-size-body-m)",
                color: "var(--trb-ink-muted)",
                marginBottom: "2rem",
                maxWidth: "48ch",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": "120ms",
              }}
            >
              Your workspace is provisioned on first sign-in. Bring your team in
              later — everything imports cleanly, nothing leaves the perimeter.
            </p>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              data-reveal
              className="trb-ghost"
              style={{
                width: "100%",
                justifyContent: "center",
                paddingBlock: "0.75rem",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": "180ms",
              }}
            >
              <GoogleMark />
              Continue with Google
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-dim)" }}
              >
                OAUTH
              </span>
            </button>

            <div
              data-reveal
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
                marginBlock: "1.5rem",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": "220ms",
              }}
            >
              <span style={{ flex: 1, height: 1, background: "var(--trb-line)" }} />
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)" }}
              >
                OR · EMAIL
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--trb-line)" }} />
            </div>

            <form
              onSubmit={handleSubmit}
              data-reveal
              style={{
                display: "grid",
                gap: "1rem",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": "260ms",
              }}
              noValidate
            >
              {error && <ErrorBanner message={error} />}

              <Field
                label="Full name"
                hint="01"
                type="text"
                name="name"
                value={name}
                onChange={setName}
                placeholder="Ada Lovelace"
                autoComplete="name"
                required
              />

              <Field
                label="Work email"
                hint="02"
                type="email"
                name="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />

              <Field
                label="Password"
                hint="03"
                type="password"
                name="password"
                value={password}
                onChange={setPassword}
                placeholder="min. 12 characters"
                autoComplete="new-password"
                required
              />

              <button
                type="submit"
                disabled={loading}
                className="trb-cta"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  paddingBlock: "0.875rem",
                  marginTop: "0.5rem",
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {loading ? (
                  <>
                    <Spinner />
                    Provisioning workspace
                    <span className="trb-cta-glyph">…</span>
                  </>
                ) : (
                  <>
                    Create account
                    <span className="trb-cta-glyph">→</span>
                  </>
                )}
              </button>

              <p
                style={{
                  fontSize: "var(--trb-size-mono-s)",
                  fontFamily: "var(--trb-font-mono)",
                  color: "var(--trb-ink-faint)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  marginTop: "0.25rem",
                  lineHeight: 1.5,
                }}
              >
                By continuing, you accept the{" "}
                <Link
                  href="/terms"
                  style={{
                    color: "var(--trb-ink-muted)",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  style={{
                    color: "var(--trb-ink-muted)",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Privacy Policy
                </Link>
                .
              </p>
            </form>

            {/* Sign-in pointer */}
            <div
              data-reveal
              style={{
                marginTop: "2.5rem",
                paddingTop: "1.25rem",
                borderTop: "1px solid var(--trb-line)",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "1rem",
                // @ts-expect-error custom CSS var
                "--trb-reveal-delay": "320ms",
              }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)" }}
              >
                ALREADY REGISTERED?
              </span>
              <Link
                href="/sign-in"
                className="trb-link"
                style={{ color: "var(--trb-ink)" }}
              >
                Sign in
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-ink-dim)", marginLeft: 6 }}
                >
                  →
                </span>
              </Link>
            </div>
          </div>

          {/* RIGHT — registration manifest */}
          <aside
            data-reveal
            style={{
              minWidth: 0,
              position: "relative",
              // @ts-expect-error custom CSS var
              "--trb-reveal-delay": "200ms",
            }}
          >
            <div
              style={{
                border: "1px solid var(--trb-line)",
                borderRadius: 3,
                background:
                  "linear-gradient(180deg, var(--trb-surface-1), var(--trb-surface-0))",
                padding: "1.25rem 1.25rem 1rem",
              }}
            >
              {/* Manifest header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid var(--trb-line)",
                }}
              >
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-signal)" }}
                >
                  REGISTRATION MANIFEST
                </span>
                <span
                  className="trb-mono-sm"
                  style={{ color: "var(--trb-ink-faint)" }}
                >
                  04 STAGES
                </span>
              </div>

              {/* Stages */}
              <ol
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: "1.125rem",
                  paddingTop: "1.125rem",
                }}
              >
                {MANIFEST.map((stage, i) => (
                  <li
                    key={stage.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "0.875rem",
                      paddingBottom: i === MANIFEST.length - 1 ? 0 : "1.125rem",
                      borderBottom:
                        i === MANIFEST.length - 1
                          ? "none"
                          : "1px solid var(--trb-line-faint)",
                    }}
                  >
                    {/* Specimen id + phase */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        minWidth: 56,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--trb-font-mono)",
                          fontSize: "var(--trb-size-mono-s)",
                          letterSpacing: "0.12em",
                          color: "var(--trb-signal)",
                          fontWeight: 500,
                        }}
                      >
                        {stage.id}
                      </span>
                      <span
                        className="trb-mono-sm"
                        style={{ color: "var(--trb-ink-faint)" }}
                      >
                        {stage.phase}
                      </span>
                    </div>

                    {/* Body */}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                        }}
                      >
                        <h3
                          style={{
                            fontFamily: "var(--trb-font-display)",
                            fontWeight: 600,
                            fontSize: "0.9375rem",
                            letterSpacing: "-0.01em",
                            color: "var(--trb-ink)",
                            margin: 0,
                            lineHeight: 1.25,
                          }}
                        >
                          {stage.title}
                        </h3>
                        <span
                          style={{
                            fontFamily: "var(--trb-font-mono)",
                            fontSize: 11,
                            letterSpacing: "0.04em",
                            color: "var(--trb-ink-muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {stage.meta}
                        </span>
                      </div>
                      <p
                        style={{
                          marginTop: 4,
                          fontSize: "0.8125rem",
                          lineHeight: 1.55,
                          color: "var(--trb-ink-muted)",
                          maxWidth: "52ch",
                        }}
                      >
                        {stage.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Metric strip below manifest */}
            <div
              style={{
                marginTop: "1.25rem",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                borderTop: "1px solid var(--trb-line-faint)",
                borderBottom: "1px solid var(--trb-line-faint)",
              }}
            >
              {[
                { label: "MEDIAN LIFT", value: "−62%", sub: "time-to-answer" },
                { label: "ADOPTION", value: "94%", sub: "in 30 days" },
                { label: "UPTIME", value: "99.97%", sub: "24-mo trailing" },
              ].map((m, i) => (
                <div
                  key={m.label}
                  style={{
                    padding: "0.875rem 1rem",
                    borderLeft:
                      i === 0 ? "none" : "1px solid var(--trb-line-faint)",
                  }}
                >
                  <div
                    className="trb-mono-sm"
                    style={{ color: "var(--trb-ink-faint)" }}
                  >
                    {m.label}
                  </div>
                  <div
                    className="trb-num"
                    style={{
                      fontFamily: "var(--trb-font-display)",
                      fontSize: "1.5rem",
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      color: "var(--trb-ink)",
                      marginTop: 4,
                      lineHeight: 1,
                    }}
                  >
                    {m.value.startsWith("−") ? (
                      <>
                        <span style={{ color: "var(--trb-signal)" }}>−</span>
                        {m.value.slice(1)}
                      </>
                    ) : (
                      m.value
                    )}
                  </div>
                  <div
                    className="trb-mono-sm"
                    style={{ color: "var(--trb-ink-dim)", marginTop: 2 }}
                  >
                    {m.sub}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
