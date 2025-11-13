'use client';

import { motion } from 'framer-motion';
import { Mail, MessageSquare, Github, MapPin, Phone, Send, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { contactFormSchema, type ContactFormData } from '@/lib/validations/contact';

const CONTACT_METHODS = [
  {
    icon: Mail,
    title: 'Email Us',
    description: 'For general inquiries and support',
    link: 'mailto:hello@record.app',
    linkText: 'hello@record.app',
    color: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    icon: MessageSquare,
    title: 'Sales',
    description: 'Interested in Enterprise plans?',
    link: 'mailto:sales@record.app',
    linkText: 'sales@record.app',
    color: 'from-green-500/20 to-emerald-500/20',
  },
];

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      company: '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to send message');
      }

      toast.success('Message sent successfully!', {
        description: result.data.message,
      });

      reset(); // Reset form on success
    } catch (error) {
      // SECURITY: Only log error message, not the full error object which may contain form data
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error instanceof Error && 'code' in error ? (error as any).code : undefined;
      console.error('Contact form error:', { message: errorMessage, code: errorCode });

      toast.error('Failed to send message', {
        description: errorMessage || 'Please try again later',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />

        <div className="relative z-10 container px-6 mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 text-sm font-medium text-primary backdrop-blur-sm mb-6">
              <Sparkles className="h-4 w-4" />
              Contact Us
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-heading-1 mb-6"
          >
            Get in Touch
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Have questions? We'd love to hear from you. Send us a message and we'll respond as
            soon as possible.
          </motion.p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="container px-6 py-16 mx-auto max-w-6xl">
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {CONTACT_METHODS.map((method, index) => {
            const Icon = method.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                className="text-center p-8 border border-border rounded-2xl bg-card hover:shadow-xl transition-all group"
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${method.color} rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-heading-4 mb-2">{method.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{method.description}</p>
                <a
                  href={method.link}
                  target={method.link.startsWith('http') ? '_blank' : undefined}
                  rel={method.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="text-primary hover:underline font-medium inline-flex items-center gap-2 transition-colors"
                >
                  {method.linkText}
                  {method.link.startsWith('http') && (
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  )}
                </a>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Contact Form */}
      <section className="container px-6 py-16 mx-auto max-w-4xl">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Left Column - Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-heading-2 mb-6">Send us a message</h2>
            <p className="text-muted-foreground mb-8">
              Fill out the form below and we'll get back to you within 24 hours.
            </p>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="text"
                      id="name"
                      placeholder="John Doe"
                      className="transition-all focus:ring-2 focus:ring-primary/20"
                      disabled={isSubmitting}
                    />
                  )}
                />
                {formErrors.name && (
                  <p className="text-sm text-destructive">{formErrors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="email"
                      id="email"
                      placeholder="john@company.com"
                      className="transition-all focus:ring-2 focus:ring-primary/20"
                      disabled={isSubmitting}
                    />
                  )}
                />
                {formErrors.email && (
                  <p className="text-sm text-destructive">{formErrors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="text-sm font-medium">
                  Company
                </Label>
                <Controller
                  name="company"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="text"
                      id="company"
                      placeholder="Acme Inc."
                      className="transition-all focus:ring-2 focus:ring-primary/20"
                      disabled={isSubmitting}
                    />
                  )}
                />
                {formErrors.company && (
                  <p className="text-sm text-destructive">{formErrors.company.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-medium">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="subject"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="text"
                      id="subject"
                      placeholder="How can we help you?"
                      className="transition-all focus:ring-2 focus:ring-primary/20"
                      disabled={isSubmitting}
                    />
                  )}
                />
                {formErrors.subject && (
                  <p className="text-sm text-destructive">{formErrors.subject.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">
                  Message <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="message"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      id="message"
                      rows={6}
                      placeholder="Tell us more about your inquiry..."
                      className="resize-none transition-all focus:ring-2 focus:ring-primary/20"
                      disabled={isSubmitting}
                    />
                  )}
                />
                {formErrors.message ? (
                  <p className="text-sm text-destructive">{formErrors.message.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Minimum 20 characters</p>
                )}
              </div>

              <Button type="submit" size="lg" className="w-full group" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2 transition-transform group-hover:translate-x-1" />
                    Send Message
                  </>
                )}
              </Button>

              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground text-center">
                  <Sparkles className="h-4 w-4 inline mr-2 text-primary" />
                  We typically respond within 24 hours
                </p>
              </div>
            </form>
          </motion.div>

          {/* Right Column - Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-heading-3 mb-6">Other Ways to Reach Us</h3>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Email Support</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      For technical support and questions
                    </p>
                    <a
                      href="mailto:support@record.app"
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      support@record.app
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Enterprise Sales</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Talk to our sales team about Enterprise plans
                    </p>
                    <a
                      href="mailto:sales@record.app"
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      Schedule a Call
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Office</h4>
                    <p className="text-sm text-muted-foreground">
                      San Francisco, CA
                      <br />
                      United States
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ Quick Links */}
            <div className="p-6 border border-border rounded-2xl bg-card">
              <h4 className="font-semibold mb-4">Looking for Quick Answers?</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Check out our frequently asked questions for instant help.
              </p>
              <div className="space-y-2">
                <Link
                  href="/pricing"
                  className="block text-sm text-primary hover:underline font-medium"
                >
                  → View Pricing Plans
                </Link>
                <Link
                  href="/features"
                  className="block text-sm text-primary hover:underline font-medium"
                >
                  → Explore Features
                </Link>
                <Link
                  href="/about"
                  className="block text-sm text-primary hover:underline font-medium"
                >
                  → About Record
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Support Section */}
      <section className="container px-6 py-16 mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="p-12 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-2xl text-center border border-primary/20"
        >
          <h2 className="text-heading-2 mb-4">Need Immediate Help?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Check out our documentation and FAQ for quick answers to common questions, or contact
            our support team for immediate assistance.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                View Pricing
              </Button>
            </Link>
            <a href="mailto:support@record.app">
              <Button size="lg">
                <Mail className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            </a>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
