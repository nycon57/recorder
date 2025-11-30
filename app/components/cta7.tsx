import Link from "next/link";

import { Button } from "@/app/components/ui/button";
import { CheckIcon } from "@radix-ui/react-icons";
import { ArrowRight } from "lucide-react";

interface Cta7Props {
  title?: string;
  subtitle?: string;
  features?: string[];
  buttonText?: string;
  buttonHref?: string;
}

const Cta7 = ({
  title = "Ready to Transform Your Team's Knowledge?",
  subtitle = "Start capturing and organizing your team's expertise today.",
  features = [
    "No credit card required",
    "14-day free trial",
    "Cancel anytime",
    "Full Pro features",
  ],
  buttonText = "Start free trial",
  buttonHref = "/sign-up",
}: Cta7Props) => {
  return (
    <section className="py-24 lg:py-32">
      <div className="container">
        <div className="border-border bg-accent relative overflow-hidden rounded-2xl border px-6 py-12 md:px-12 md:py-16 lg:grid lg:grid-cols-2 lg:gap-12 lg:px-16 lg:py-20">
          {/* Background pattern */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
            <svg
              fill="none"
              width={404}
              height={384}
              viewBox="0 0 404 384"
              aria-hidden="true"
              className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/4 rotate-[30deg] opacity-50"
            >
              <defs>
                <pattern
                  x={0}
                  y={0}
                  id="cta-dots"
                  width={20}
                  height={20}
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx={2}
                    cy={2}
                    r={2}
                    fill="currentColor"
                    className="text-primary/20"
                  />
                </pattern>
              </defs>
              <rect fill="url(#cta-dots)" width={404} height={384} />
            </svg>
            <svg
              fill="none"
              width={404}
              height={384}
              viewBox="0 0 404 384"
              aria-hidden="true"
              className="absolute bottom-0 left-0 -translate-x-1/4 translate-y-1/4 rotate-[60deg] opacity-50"
            >
              <defs>
                <pattern
                  x={0}
                  y={0}
                  id="cta-dots-2"
                  width={20}
                  height={20}
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx={2}
                    cy={2}
                    r={2}
                    fill="currentColor"
                    className="text-primary/20"
                  />
                </pattern>
              </defs>
              <rect fill="url(#cta-dots-2)" width={404} height={384} />
            </svg>
          </div>

          {/* Content */}
          <div className="relative z-10 mb-10 lg:mb-0">
            <h3 className="mb-4 text-2xl font-bold md:text-3xl lg:text-4xl">
              {title}
            </h3>
            <p className="text-muted-foreground mb-8 text-lg">
              {subtitle}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="bg-primary/10 flex h-5 w-5 items-center justify-center rounded-full">
                    <CheckIcon className="text-primary h-3 w-3" />
                  </div>
                  <span className="text-foreground/80 text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="relative z-10 flex items-center justify-center lg:justify-end">
            <Button asChild size="lg" className="group px-8">
              <Link href={buttonHref}>
                {buttonText}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Cta7 };
