import { Check, Minus, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/app/components/ui/button";
import { ArrowRightIcon } from "@radix-ui/react-icons";

interface CompareValue {
  value: string | boolean;
  highlight?: boolean;
}

interface ComparisonRow {
  feature: string;
  sharepoint: CompareValue;
  google: CompareValue;
  manual: CompareValue;
  tribora: CompareValue;
}

const COMPARISON_DATA: ComparisonRow[] = [
  {
    feature: "Visual Knowledge Capture",
    sharepoint: { value: false },
    google: { value: false },
    manual: { value: false },
    tribora: { value: true, highlight: true },
  },
  {
    feature: "AI Transcription & Documentation",
    sharepoint: { value: false },
    google: { value: false },
    manual: { value: false },
    tribora: { value: true, highlight: true },
  },
  {
    feature: "Semantic Search",
    sharepoint: { value: "Basic" },
    google: { value: "Basic" },
    manual: { value: false },
    tribora: { value: "Advanced AI", highlight: true },
  },
  {
    feature: "Knowledge Graph",
    sharepoint: { value: false },
    google: { value: false },
    manual: { value: false },
    tribora: { value: true, highlight: true },
  },
  {
    feature: "Workflow Extraction",
    sharepoint: { value: false },
    google: { value: false },
    manual: { value: false },
    tribora: { value: true, highlight: true },
  },
  {
    feature: "Bidirectional Sync",
    sharepoint: { value: "One-way" },
    google: { value: "One-way" },
    manual: { value: false },
    tribora: { value: "Full sync", highlight: true },
  },
  {
    feature: "AI Assistant (RAG)",
    sharepoint: { value: "Copilot" },
    google: { value: "Gemini" },
    manual: { value: false },
    tribora: { value: "Context-aware", highlight: true },
  },
  {
    feature: "Auto-Generated Docs",
    sharepoint: { value: false },
    google: { value: false },
    manual: { value: false },
    tribora: { value: true, highlight: true },
  },
];

const renderValue = (item: CompareValue, isTriboraColumn: boolean) => {
  if (typeof item.value === "boolean") {
    if (item.value) {
      return (
        <div className={`flex items-center justify-center ${isTriboraColumn ? "text-primary" : "text-foreground"}`}>
          <Check className="h-5 w-5" />
        </div>
      );
    }
    return (
      <div className="text-muted-foreground/50 flex items-center justify-center">
        <X className="h-5 w-5" />
      </div>
    );
  }

  if (item.value === "One-way") {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-1 text-sm">
        <Minus className="h-4 w-4" />
        <span>{item.value}</span>
      </div>
    );
  }

  return (
    <span className={`text-sm font-medium ${item.highlight ? "text-primary" : "text-muted-foreground"}`}>
      {item.value}
    </span>
  );
};

interface Compare4Props {
  title?: string;
  subtitle?: string;
}

const Compare4 = ({
  title = "Why Tribora?",
  subtitle = "The Knowledge Intelligence Layer above your existing tools",
}: Compare4Props) => {
  return (
    <section className="bg-muted/30 py-24 lg:py-32">
      <div className="container">
        {/* Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl lg:text-5xl">
            {title}
          </h2>
          <p className="text-muted-foreground text-lg">
            {subtitle}
          </p>
        </div>

        {/* Comparison Table */}
        <div className="bg-card mx-auto max-w-5xl overflow-hidden rounded-xl border shadow-sm">
          {/* Table Header */}
          <div className="border-b bg-muted/30">
            <div className="grid grid-cols-5 gap-4 px-6 py-4">
              <div className="text-muted-foreground text-sm font-medium">
                Feature
              </div>
              <div className="text-muted-foreground text-center text-sm font-medium">
                SharePoint
              </div>
              <div className="text-muted-foreground text-center text-sm font-medium">
                Google Drive
              </div>
              <div className="text-muted-foreground text-center text-sm font-medium">
                Manual
              </div>
              <div className="text-primary text-center text-sm font-semibold">
                Tribora
              </div>
            </div>
          </div>

          {/* Table Body */}
          {COMPARISON_DATA.map((row, index) => (
            <div
              key={index}
              className="group border-b last:border-b-0 transition-colors hover:bg-muted/30"
            >
              <div className="grid grid-cols-5 items-center gap-4 px-6 py-4">
                <div className="text-foreground text-sm font-medium">
                  {row.feature}
                </div>
                <div className="text-center">
                  {renderValue(row.sharepoint, false)}
                </div>
                <div className="text-center">
                  {renderValue(row.google, false)}
                </div>
                <div className="text-center">
                  {renderValue(row.manual, false)}
                </div>
                <div className="bg-primary/5 -mx-4 rounded-lg px-4 py-2 text-center">
                  {renderValue(row.tribora, true)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mx-auto mt-8 max-w-5xl">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-muted-foreground text-sm">
              Tribora works with your existing storage. Connect Google Drive, SharePoint, or Notion.
            </p>
            <Button asChild className="rounded-full px-6">
              <Link href="/sign-up">
                Get started free
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export { Compare4 };
