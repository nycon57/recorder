import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface Faq3Props {
  heading?: string;
  description?: string;
  items?: FaqItem[];
}

const defaultFaqItems: FaqItem[] = [
  {
    id: "faq-1",
    question: "What's included in the free plan?",
    answer:
      "The free plan includes 5 recordings per month, basic transcription, 1GB of storage, and basic search functionality. It's perfect for individuals who want to explore how Tribora can help capture and organize their knowledge.",
  },
  {
    id: "faq-2",
    question: "Can I upgrade or downgrade my plan at any time?",
    answer:
      "Yes! You can upgrade your plan at any time, and the new features will be available immediately. If you downgrade, the change will take effect at the end of your current billing period. Your data is always safe and accessible.",
  },
  {
    id: "faq-3",
    question: "How does the free trial work?",
    answer:
      "Our 14-day free trial gives you full access to all Pro features with no credit card required. At the end of the trial, you can choose to subscribe or continue with the free plan. All your recordings and data will be preserved.",
  },
  {
    id: "faq-4",
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express) and can also accommodate invoicing for Enterprise customers. All payments are processed securely through Stripe.",
  },
  {
    id: "faq-5",
    question: "Is my data secure?",
    answer:
      "Absolutely. All data is encrypted at rest and in transit. We use enterprise-grade security measures and comply with SOC 2 Type II standards. Enterprise customers can also opt for on-premise deployment for complete data control.",
  },
  {
    id: "faq-6",
    question: "What integrations are available?",
    answer:
      "Tribora integrates with Google Drive, Microsoft SharePoint, Notion, and more. Our bidirectional sync allows you to publish enriched content back to your connected services. Enterprise plans can access custom integrations.",
  },
  {
    id: "faq-7",
    question: "Do you offer discounts for nonprofits or education?",
    answer:
      "Yes! We offer special pricing for qualifying nonprofits, educational institutions, and open source projects. Contact our sales team for more information about our discount programs.",
  },
];

const Faq3 = ({
  heading = "Frequently asked questions",
  description = "Everything you need to know about Tribora pricing and plans.",
  items = defaultFaqItems,
}: Faq3Props) => {
  return (
    <section className="py-24 lg:py-32">
      <div className="container space-y-16">
        <div className="mx-auto flex max-w-3xl flex-col text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">
            {heading}
          </h2>
          <p className="text-muted-foreground text-lg">{description}</p>
        </div>
        <Accordion
          type="single"
          collapsible
          className="mx-auto w-full lg:max-w-3xl"
        >
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="text-left transition-opacity duration-200 hover:no-underline hover:opacity-70">
                <div className="pr-4 font-medium sm:py-1 lg:py-2 lg:text-lg">
                  {item.question}
                </div>
              </AccordionTrigger>
              <AccordionContent className="sm:mb-1 lg:mb-2">
                <div className="text-muted-foreground lg:text-base">
                  {item.answer}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export { Faq3 };
