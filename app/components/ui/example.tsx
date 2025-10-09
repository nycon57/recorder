// Example component to demonstrate UI component usage
// This file can be deleted - it's just for testing the components

import { Button } from './button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from './accordion';
import { Input } from './input';
import { Textarea } from './textarea';
import { Label } from './label';

export default function UIComponentExample() {
  return (
    <div className="container mx-auto py-12 space-y-8">
      {/* Buttons */}
      <section>
        <h2 className="text-heading-3 mb-4">Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      {/* Card */}
      <section>
        <h2 className="text-heading-3 mb-4">Card</h2>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>
              This is a card description explaining what this card is about.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-body-md">
              This is the main content of the card. You can put any content
              here.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Action Button</Button>
          </CardFooter>
        </Card>
      </section>

      {/* Form Fields */}
      <section>
        <h2 className="text-heading-3 mb-4">Form Fields</h2>
        <Card className="max-w-md">
          <CardContent>
            <form className="flex flex-col gap-4 pt-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" placeholder="Enter your name" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" placeholder="Your message..." />
              </div>
              <Button type="submit">Submit</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Accordion */}
      <section>
        <h2 className="text-heading-3 mb-4">Accordion</h2>
        <Accordion type="single" collapsible className="max-w-2xl">
          <AccordionItem value="item-1">
            <AccordionTrigger>What is Record?</AccordionTrigger>
            <AccordionContent>
              Record is an AI-powered knowledge management platform that
              combines browser-based recording, automatic transcription, and
              intelligent document generation.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>How does it work?</AccordionTrigger>
            <AccordionContent>
              You record your screen and audio, we transcribe it using OpenAI
              Whisper, then generate searchable documents using GPT-5 Nano.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>
              Yes! All components are built with accessibility in mind using
              Radix UI primitives and proper ARIA attributes.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
}
