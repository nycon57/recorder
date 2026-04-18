"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, ErrorBanner, Spinner, GoogleMark } from "@/app/components/auth/form";

/**
 * Sign In — specimen sheet.
 *
 * One hairline-bracketed column. Paper-white ink on warm-charcoal.
 * Warm Amber is reserved for the primary action and the focus ring.
 * Monospace carries structure (specimen markers, kbd chips, field labels).
 */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message || "Authentication failed. Check credentials and retry.");
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
        display: "grid",
        placeItems: "center",
        paddingTop: "6.5rem",
        paddingBottom: "5rem",
      }}
    >
      <div
        className="trb-inner"
        style={{
          width: "100%",
          maxWidth: 480,
        }}
      >
        {/* Specimen marker row — mirrors hero's §00 / HERO pattern */}
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
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
            / SIGN-IN
          </span>
          <span style={{ flex: 1, height: 1, background: "var(--trb-line)" }} />
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
            FIG-AUTH-01
          </span>
        </div>

        {/* Heading */}
        <h1
          data-reveal
          className="trb-display"
          style={{
            fontSize: "clamp(2rem, 1.3rem + 2.2vw, 2.75rem)",
            lineHeight: 1.02,
            marginTop: "1.5rem",
            marginBottom: "0.875rem",
            maxWidth: "16ch",
            // @ts-expect-error custom CSS var
            "--trb-reveal-delay": "60ms",
          }}
        >
          Welcome back<span style={{ color: "var(--trb-signal)" }}>.</span>
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
          Authenticate to your workspace. The recorder, the library, and the
          command palette will be waiting exactly where you left them.
        </p>

        {/* OAuth — bordered, no gradient, no glow */}
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
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
            OAUTH
          </span>
        </button>

        {/* Hairline divider with mono label */}
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
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-faint)" }}>
            OR · EMAIL
          </span>
          <span style={{ flex: 1, height: 1, background: "var(--trb-line)" }} />
        </div>

        {/* Form */}
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
            label="Email"
            hint="01"
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
            hint="02"
            type="password"
            name="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••••••"
            autoComplete="current-password"
            required
            trailing={
              <Link
                href="/forgot-password"
                className="trb-link"
                style={{
                  fontSize: "var(--trb-size-mono-s)",
                  fontFamily: "var(--trb-font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--trb-ink-muted)",
                }}
              >
                Forgot?
              </Link>
            }
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
                Authenticating
                <span className="trb-cta-glyph">…</span>
              </>
            ) : (
              <>
                Sign in
                <span className="trb-cta-glyph">↵</span>
              </>
            )}
          </button>

          {/* Keyboard hint */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              marginTop: "0.25rem",
              fontSize: "var(--trb-size-mono-s)",
              fontFamily: "var(--trb-font-mono)",
              color: "var(--trb-ink-faint)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span>Press</span>
            <span className="trb-kbd">↵</span>
            <span>to submit</span>
          </div>
        </form>

        {/* Sign-up pointer */}
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
            NO ACCOUNT?
          </span>
          <Link
            href="/sign-up"
            className="trb-link"
            style={{ color: "var(--trb-ink)" }}
          >
            Request access
            <span
              className="trb-mono-sm"
              style={{ color: "var(--trb-ink-dim)", marginLeft: 6 }}
            >
              →
            </span>
          </Link>
        </div>

        {/* Specimen strip — matches hero enterprise-readiness band */}
        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
            gap: "0.25rem 1rem",
            borderTop: "1px solid var(--trb-line-faint)",
            borderBottom: "1px solid var(--trb-line-faint)",
            padding: "0.625rem 0",
            marginTop: "1.5rem",
            // @ts-expect-error custom CSS var
            "--trb-reveal-delay": "380ms",
          }}
        >
          {[
            { label: "SOC 2", value: "TYPE II" },
            { label: "GDPR", value: "READY" },
            { label: "TLS", value: "1.3" },
            { label: "AES", value: "256" },
          ].map((item) => (
            <div
              key={item.label}
              style={{ display: "flex", flexDirection: "column", gap: 2 }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)" }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--trb-font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: "var(--trb-ink-muted)",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
