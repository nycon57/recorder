import { Mail, MessageSquare, Github } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="container px-6 py-16 mx-auto max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-heading-1 mb-4">Get in Touch</h1>
        <p className="text-body-lg text-muted-foreground">
          Have questions? We'd love to hear from you.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="text-center p-6 border border-border rounded-xl bg-card">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-heading-6 mb-2">Email Us</h3>
          <p className="text-body-sm text-muted-foreground mb-3">
            For general inquiries and support
          </p>
          <a
            href="mailto:hello@record.app"
            className="text-primary hover:underline text-body-sm-medium"
          >
            hello@record.app
          </a>
        </div>

        <div className="text-center p-6 border border-border rounded-xl bg-card">
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-secondary" />
          </div>
          <h3 className="text-heading-6 mb-2">Sales</h3>
          <p className="text-body-sm text-muted-foreground mb-3">
            Interested in Enterprise plans?
          </p>
          <a
            href="mailto:sales@record.app"
            className="text-primary hover:underline text-body-sm-medium"
          >
            sales@record.app
          </a>
        </div>

        <div className="text-center p-6 border border-border rounded-xl bg-card">
          <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Github className="w-6 h-6 text-accent" />
          </div>
          <h3 className="text-heading-6 mb-2">Community</h3>
          <p className="text-body-sm text-muted-foreground mb-3">
            Join our developer community
          </p>
          <a
            href="https://github.com/yourusername/record"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-body-sm-medium"
          >
            GitHub
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="border border-border rounded-xl p-8 bg-card">
          <h2 className="text-heading-4 mb-6">Send us a message</h2>
          <form className="space-y-6">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                type="text"
                id="name"
                name="name"
                placeholder="Your name"
                required
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                type="email"
                id="email"
                name="email"
                placeholder="your@email.com"
                required
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                type="text"
                id="subject"
                name="subject"
                placeholder="How can we help?"
                required
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                rows={6}
                placeholder="Tell us more..."
                required
                className="mt-2"
              />
            </div>

            <Button type="submit" className="w-full">
              Send Message
            </Button>
          </form>
          <p className="text-body-sm text-muted-foreground mt-4 text-center">
            We typically respond within 24 hours.
          </p>
        </div>
      </div>

      <div className="mt-16 p-8 bg-accent rounded-xl text-center">
        <h2 className="text-heading-4 mb-4">Looking for Support?</h2>
        <p className="text-muted-foreground mb-6">
          Check out our documentation and FAQ for quick answers to common
          questions.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/pricing">
            <Button variant="secondary">View Pricing</Button>
          </Link>
          <a href="mailto:support@record.app">
            <Button>Contact Support</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
