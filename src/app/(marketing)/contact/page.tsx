"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  contactFormSchema,
  type ContactFormData,
} from "@/lib/validations/contact";

/* ─────────────────────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────────────────────── */

const CONTACT_METHODS = [
  {
    mark: "M-01",
    label: "EMAIL",
    title: "General inquiries",
    description: "Support questions, curiosity, press. Reply within one business day.",
    action: "hello@tribora.com",
    actionHref: "mailto:hello@tribora.com",
  },
  {
    mark: "M-02",
    label: "DEMO",
    title: "Book a walkthrough",
    description: "Thirty minutes, your data, your team. One honest hour.",
    action: "Schedule",
    actionHref: "#contact-form",
    highlight: true,
  },
  {
    mark: "M-03",
    label: "SALES",
    title: "Enterprise",
    description: "Custom contracts, SSO, on-prem, data-residency conversations.",
    action: "sales@tribora.com",
    actionHref: "mailto:sales@tribora.com",
  },
];

const INQUIRY_TYPES = [
  { value: "general", label: "General inquiry" },
  { value: "demo", label: "Request a demo" },
  { value: "sales", label: "Enterprise sales" },
  { value: "support", label: "Technical support" },
  { value: "partnership", label: "Partnership" },
];

const SPECIMEN_STRIP = [
  { label: "HQ", value: "SAN FRANCISCO, CA" },
  { label: "HOURS", value: "MON–FRI · 09:00–17:00 PT" },
  { label: "RESPONSE", value: "<1 BUSINESS DAY" },
  { label: "SUPPORT", value: "24 / 7 FOR PRO+" },
];

/* ─────────────────────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────────────────────── */

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      inquiryType: "general",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to send message");
      }

      toast.success("Message sent successfully", {
        description: result.data.message,
      });

      setIsSubmitted(true);
      reset();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to send message", {
        description: message || "Please try again later",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Hero />
      <Methods />
      <FormSection
        onSubmit={handleSubmit(onSubmit)}
        register={register}
        errors={errors}
        isSubmitting={isSubmitting}
        isSubmitted={isSubmitted}
        onReset={() => setIsSubmitted(false)}
      />
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
      aria-labelledby="contact-head"
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
        <SectionMarkerRow mark="§01" label="/ CONTACT" index="PAGE 05 OF 07" />

        <h1
          id="contact-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "var(--trb-size-display-l)",
            marginTop: "1.25rem",
            marginBottom: "1.5rem",
            maxWidth: "18ch",
          }}
        >
          Talk to a person,{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            not a chatbot.
          </span>
          <span style={{ color: "var(--trb-signal)" }}>.</span>
        </h1>

        <p
          data-reveal
          style={{
            maxWidth: "56ch",
            fontSize: "var(--trb-size-body-l)",
            lineHeight: 1.55,
            color: "var(--trb-ink-muted)",
            marginBottom: "2rem",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "80ms",
          }}
        >
          One of the founders will see your message. Usually the same day.
          Thirty-minute demos are run by the team that built the product.
        </p>

        <div
          data-reveal
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(160px, max-content))",
            gap: "0.25rem 2rem",
            borderTop: "1px solid var(--trb-line)",
            borderBottom: "1px solid var(--trb-line)",
            padding: "0.75rem 0",
            /* @ts-expect-error custom CSS var */
            "--trb-reveal-delay": "160ms",
          }}
        >
          {SPECIMEN_STRIP.map((item) => (
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
                  fontSize: 12,
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

      <CornerMarkers fig="FIG-01" caption="CONTACT / INDEX" />
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   METHODS
   ──────────────────────────────────────────────────────────────────────── */

function Methods() {
  return (
    <section
      className="trb-section"
      aria-labelledby="methods-head"
      style={{
        paddingTop: "clamp(4rem, 6vw, 6rem)",
        paddingBottom: "clamp(2.5rem, 4vw, 4rem)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§02" label="/ CHANNELS" index="3 PATHS" />

        <h2
          id="methods-head"
          className="trb-display"
          data-reveal
          style={{
            fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.375rem)",
            marginTop: "1.25rem",
            marginBottom: "2.5rem",
            maxWidth: "26ch",
          }}
        >
          Pick the path{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            that matches why you&rsquo;re here.
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
          {CONTACT_METHODS.map((m, i) => (
            <article
              key={m.mark}
              data-reveal
              style={{
                padding: "1.75rem 1.5rem 1.75rem",
                borderRight: "1px solid var(--trb-line)",
                borderBottom: "1px solid var(--trb-line)",
                display: "flex",
                flexDirection: "column",
                gap: "0.875rem",
                background: m.highlight ? "var(--trb-signal-soft)" : "transparent",
                /* @ts-expect-error custom CSS var */
                "--trb-reveal-delay": `${i * 80}ms`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid var(--trb-line)",
                }}
              >
                <span
                  className="trb-mono-sm"
                  style={{
                    color: m.highlight
                      ? "var(--trb-signal)"
                      : "var(--trb-ink-faint)",
                  }}
                >
                  {m.mark}
                </span>
                <span
                  className="trb-mono-sm"
                  style={{
                    color: "var(--trb-ink-dim)",
                    letterSpacing: "0.14em",
                  }}
                >
                  {m.label}
                </span>
              </div>

              <h3 className="trb-display" style={{ fontSize: "1.25rem" }}>
                {m.title}
              </h3>

              <p
                style={{
                  fontSize: "var(--trb-size-body-s)",
                  lineHeight: 1.6,
                  color: "var(--trb-ink-muted)",
                  flex: 1,
                }}
              >
                {m.description}
              </p>

              {m.actionHref.startsWith("#") ? (
                <a
                  href={m.actionHref}
                  className={m.highlight ? "trb-cta" : "trb-ghost"}
                  style={{
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "0.6875rem 1rem 0.75rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {m.action}
                  <span
                    className={m.highlight ? "trb-cta-glyph" : "trb-mono-sm"}
                  >
                    →
                  </span>
                </a>
              ) : (
                <a
                  href={m.actionHref}
                  className={m.highlight ? "trb-cta" : "trb-ghost"}
                  style={{
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "0.6875rem 1rem 0.75rem",
                    fontSize: "0.875rem",
                  }}
                >
                  {m.action}
                  <span
                    className={m.highlight ? "trb-cta-glyph" : "trb-mono-sm"}
                  >
                    →
                  </span>
                </a>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FORM
   ──────────────────────────────────────────────────────────────────────── */

type RegisterFn = ReturnType<typeof useForm<ContactFormData>>["register"];
type ErrorsShape = Partial<Record<keyof ContactFormData, { message?: string }>>;

function FormSection({
  onSubmit,
  register,
  errors,
  isSubmitting,
  isSubmitted,
  onReset,
}: {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  register: RegisterFn;
  errors: ErrorsShape;
  isSubmitting: boolean;
  isSubmitted: boolean;
  onReset: () => void;
}) {
  return (
    <section
      id="contact-form"
      className="trb-section"
      aria-labelledby="form-head"
      style={{
        paddingTop: "clamp(3rem, 5vw, 5rem)",
        paddingBottom: "clamp(4rem, 6vw, 6rem)",
        borderTop: "1px solid var(--trb-line)",
        background: "var(--trb-surface-1)",
      }}
    >
      <div className="trb-inner">
        <SectionMarkerRow mark="§03" label="/ FORM" index="6 FIELDS" />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.3fr)",
            gap: "clamp(2rem, 5vw, 4rem)",
            marginTop: "1.25rem",
            alignItems: "start",
          }}
        >
          {/* Left — intro */}
          <div data-reveal style={{ position: "sticky", top: "6rem" }}>
            <h2
              id="form-head"
              className="trb-display"
              style={{
                fontSize: "clamp(1.75rem, 1.2rem + 1.5vw, 2.5rem)",
                marginBottom: "1rem",
                maxWidth: "18ch",
              }}
            >
              Send a message{" "}
              <span style={{ color: "var(--trb-ink-muted)" }}>
                — we read them all.
              </span>
            </h2>
            <p
              style={{
                fontSize: "var(--trb-size-body-m)",
                lineHeight: 1.65,
                color: "var(--trb-ink-muted)",
                maxWidth: "44ch",
                marginBottom: "1.5rem",
              }}
            >
              Demos are thirty minutes, pre-scheduled, run live on your data.
              Everything else gets a written reply from a human.
            </p>

            <div
              style={{
                borderTop: "1px solid var(--trb-line)",
                paddingTop: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <span
                className="trb-mono-sm"
                style={{ color: "var(--trb-ink-faint)" }}
              >
                ALT CHANNELS
              </span>
              <a
                href="mailto:hello@tribora.com"
                className="trb-link"
                style={{ fontSize: "0.9375rem" }}
              >
                hello@tribora.com
              </a>
              <a
                href="mailto:sales@tribora.com"
                className="trb-link"
                style={{ fontSize: "0.9375rem" }}
              >
                sales@tribora.com
              </a>
              <a
                href="mailto:privacy@tribora.com"
                className="trb-link"
                style={{ fontSize: "0.9375rem" }}
              >
                privacy@tribora.com
              </a>
            </div>
          </div>

          {/* Right — form or success */}
          <div data-reveal style={{ minWidth: 0 }}>
            {isSubmitted ? (
              <SuccessState onReset={onReset} />
            ) : (
              <form
                onSubmit={onSubmit}
                style={{
                  border: "1px solid var(--trb-line)",
                  background: "var(--trb-surface-0)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 0,
                  }}
                >
                  <Field
                    label="NAME"
                    mark="01"
                    error={errors.name?.message}
                    borderBottom
                    borderRight
                  >
                    <input
                      {...register("name")}
                      placeholder="Your name"
                      style={inputStyle}
                    />
                  </Field>
                  <Field
                    label="EMAIL"
                    mark="02"
                    error={errors.email?.message}
                    borderBottom
                  >
                    <input
                      {...register("email")}
                      type="email"
                      placeholder="you@company.com"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 0,
                  }}
                >
                  <Field
                    label="COMPANY"
                    mark="03"
                    error={errors.company?.message}
                    borderBottom
                    borderRight
                    optional
                  >
                    <input
                      {...register("company")}
                      placeholder="Tribora Inc."
                      style={inputStyle}
                    />
                  </Field>
                  <Field
                    label="INQUIRY"
                    mark="04"
                    error={errors.inquiryType?.message}
                    borderBottom
                  >
                    <select
                      {...register("inquiryType")}
                      style={{
                        ...inputStyle,
                        appearance: "none",
                        backgroundImage:
                          "linear-gradient(45deg, transparent 50%, var(--trb-ink-dim) 50%), linear-gradient(-45deg, transparent 50%, var(--trb-ink-dim) 50%)",
                        backgroundPosition:
                          "calc(100% - 18px) 50%, calc(100% - 12px) 50%",
                        backgroundSize: "6px 6px",
                        backgroundRepeat: "no-repeat",
                        paddingRight: "2rem",
                      }}
                    >
                      {INQUIRY_TYPES.map((t) => (
                        <option
                          key={t.value}
                          value={t.value}
                          style={{
                            background: "var(--trb-surface-0)",
                            color: "var(--trb-ink)",
                          }}
                        >
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field
                  label="SUBJECT"
                  mark="05"
                  error={errors.subject?.message}
                  borderBottom
                >
                  <input
                    {...register("subject")}
                    placeholder="One sentence on the ask"
                    style={inputStyle}
                  />
                </Field>

                <Field
                  label="MESSAGE"
                  mark="06"
                  error={errors.message?.message}
                >
                  <textarea
                    {...register("message")}
                    rows={6}
                    placeholder="The context that would help us give a useful reply…"
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      minHeight: 140,
                      paddingTop: "0.875rem",
                      paddingBottom: "0.875rem",
                    }}
                  />
                </Field>

                <div
                  style={{
                    padding: "1rem 1.125rem 1.125rem",
                    borderTop: "1px solid var(--trb-line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                    background: "var(--trb-surface-1)",
                  }}
                >
                  <span
                    className="trb-mono-sm"
                    style={{ color: "var(--trb-ink-faint)" }}
                  >
                    ENCRYPTED · TLS 1.3 · NO THIRD-PARTY TRACKING
                  </span>
                  <button
                    type="submit"
                    className="trb-cta"
                    disabled={isSubmitting}
                    style={{
                      padding: "0.6875rem 1.125rem 0.75rem",
                      fontSize: "0.875rem",
                      opacity: isSubmitting ? 0.6 : 1,
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {isSubmitting ? "Sending…" : "Send message"}
                    <span className="trb-cta-glyph">→</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  mark,
  error,
  optional,
  borderBottom,
  borderRight,
  children,
}: {
  label: string;
  mark: string;
  error?: string;
  optional?: boolean;
  borderBottom?: boolean;
  borderRight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "block",
        padding: "0.875rem 1.125rem 0.9375rem",
        borderBottom: borderBottom ? "1px solid var(--trb-line)" : "none",
        borderRight: borderRight ? "1px solid var(--trb-line)" : "none",
        background: "var(--trb-surface-0)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.375rem",
        }}
      >
        <span
          className="trb-mono-sm"
          style={{
            color: "var(--trb-ink-faint)",
            letterSpacing: "0.14em",
          }}
        >
          <span style={{ color: "var(--trb-ink-dim)", marginRight: "0.5rem" }}>
            {mark}
          </span>
          {label}
          {optional ? (
            <span
              style={{
                marginLeft: "0.5rem",
                color: "var(--trb-ink-faint)",
                letterSpacing: "0.08em",
              }}
            >
              · OPTIONAL
            </span>
          ) : null}
        </span>
        {error ? (
          <span
            className="trb-mono-sm"
            style={{ color: "var(--trb-signal)", fontSize: 10 }}
          >
            ERR · {error}
          </span>
        ) : null}
      </div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: "0.375rem 0",
  fontFamily: "var(--trb-font-body)",
  fontSize: "0.9375rem",
  lineHeight: 1.5,
  color: "var(--trb-ink)",
  letterSpacing: "0.005em",
};

function SuccessState({ onReset }: { onReset: () => void }) {
  return (
    <div
      style={{
        border: "1px solid var(--trb-line)",
        background: "var(--trb-surface-0)",
        padding: "clamp(2rem, 4vw, 3rem)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--trb-line)",
          marginBottom: "1.5rem",
        }}
      >
        <span className="trb-pip is-signal" aria-hidden />
        <span className="trb-mono-sm" style={{ color: "var(--trb-signal)" }}>
          TRANSMISSION · COMPLETE
        </span>
      </div>

      <h3
        className="trb-display"
        style={{
          fontSize: "clamp(1.5rem, 1.1rem + 1vw, 2rem)",
          marginBottom: "0.75rem",
        }}
      >
        Thanks — we got it.
      </h3>
      <p
        style={{
          fontSize: "var(--trb-size-body-m)",
          lineHeight: 1.65,
          color: "var(--trb-ink-muted)",
          maxWidth: "50ch",
          marginBottom: "1.75rem",
        }}
      >
        A human will reply within one business day. If it&rsquo;s a demo
        request, expect a scheduling link with times that match your calendar.
      </p>

      <button
        type="button"
        onClick={onReset}
        className="trb-ghost"
        style={{
          padding: "0.6875rem 1.125rem",
          fontSize: "0.875rem",
        }}
      >
        Send another
        <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
          ↻
        </span>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   CLOSING
   ──────────────────────────────────────────────────────────────────────── */

function Closing() {
  return (
    <section
      className="trb-section"
      aria-labelledby="contact-closing"
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
            §04
          </span>
          <span className="trb-mono-sm" style={{ color: "var(--trb-ink-dim)" }}>
            / OR SKIP THE QUEUE
          </span>
        </div>

        <h2
          id="contact-closing"
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
          Record the first clip now.{" "}
          <span style={{ color: "var(--trb-ink-muted)" }}>
            We can talk after.
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
