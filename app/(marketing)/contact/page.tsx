'use client';

import * as motion from 'motion/react-client';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Mail01Icon,
  Message01Icon,
  ArrowRight01Icon,
  SparklesIcon,
  Location01Icon,
  Call02Icon,
  Clock01Icon,
  Tick02Icon,
  Loading03Icon,
  SentIcon,
  Calendar03Icon,
  LinkSquare01Icon,
} from '@hugeicons/core-free-icons';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { contactFormSchema, type ContactFormData } from '@/lib/validations/contact';
import { AuroraCTA } from '@/app/components/sections';

// ============================================================================
// ANIMATION VARIANTS (Consistent with Aurora design system)
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
};

// ============================================================================
// DATA
// ============================================================================

interface ContactMethod {
  icon: typeof Mail01Icon;
  title: string;
  description: string;
  action: string;
  actionHref: string;
  highlight?: boolean;
}

const CONTACT_METHODS: ContactMethod[] = [
  {
    icon: Mail01Icon,
    title: 'Email Us',
    description: 'General inquiries and support questions',
    action: 'hello@tribora.com',
    actionHref: 'mailto:hello@tribora.com',
  },
  {
    icon: Calendar03Icon,
    title: 'Book a Demo',
    description: 'See Tribora in action with a personalized walkthrough',
    action: 'Schedule a call',
    actionHref: '/contact?type=demo',
    highlight: true,
  },
  {
    icon: Message01Icon,
    title: 'Enterprise Sales',
    description: 'Custom solutions for large organizations',
    action: 'sales@tribora.com',
    actionHref: 'mailto:sales@tribora.com',
  },
];

const INQUIRY_TYPES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'demo', label: 'Request a Demo' },
  { value: 'sales', label: 'Enterprise Sales' },
  { value: 'support', label: 'Technical Support' },
  { value: 'partnership', label: 'Partnership' },
];

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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
      inquiryType: 'general',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to send message');
      }

      toast.success('Message sent successfully!', {
        description: result.data.message,
      });

      setIsSubmitted(true);
      reset();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Contact form error:', { message: errorMessage });

      toast.error('Failed to send message', {
        description: errorMessage || 'Please try again later',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* ================================================================== */}
      {/* HERO SECTION */}
      {/* ================================================================== */}
      <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 lg:pt-40 lg:pb-24 overflow-hidden">
        {/* Aurora Background */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Flowing aurora orbs */}
          <div
            className="absolute top-[5%] right-[10%] w-[600px] h-[600px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.1)_0%,transparent_70%)]
              blur-[100px] animate-float"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="absolute top-[40%] left-[5%] w-[500px] h-[500px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(44,194,149,0.08)_0%,transparent_70%)]
              blur-[80px] animate-float"
            style={{ animationDelay: '2s' }}
          />

          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0,223,130,0.5) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0,223,130,0.5) 1px, transparent 1px)
              `,
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {/* Badge */}
            <motion.div variants={scaleIn}>
              <Badge
                variant="outline"
                className="mb-6 px-4 py-2 rounded-full
                  bg-accent/5 backdrop-blur-sm border-accent/30"
              >
                <HugeiconsIcon icon={SparklesIcon} size={14} className="mr-2 text-accent" />
                <span className="text-sm font-medium text-accent">
                  We'd Love to Hear From You
                </span>
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="font-outfit text-4xl sm:text-5xl lg:text-6xl xl:text-7xl
                font-light leading-tight tracking-tight mb-6"
              variants={fadeInUp}
            >
              Let's start a{' '}
              <span
                className="bg-gradient-to-r from-accent via-secondary to-primary
                  bg-clip-text text-transparent"
              >
                conversation
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="text-lg sm:text-xl lg:text-2xl text-muted-foreground
                font-light max-w-2xl mx-auto"
              variants={fadeInUp}
            >
              Whether you have questions, need a demo, or want to discuss enterprise
              solutions—we're here to help illuminate your path forward.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CONTACT METHOD CARDS */}
      {/* ================================================================== */}
      <section className="relative py-8 sm:py-12">
        <div className="container px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {CONTACT_METHODS.map((method, index) => (
              <motion.a
                key={index}
                href={method.actionHref}
                variants={cardVariants}
                whileHover={{ y: -8, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
                className={cn(
                  'group relative rounded-2xl overflow-hidden p-6',
                  'bg-card/50 backdrop-blur-sm',
                  'border transition-all duration-500',
                  method.highlight
                    ? 'border-accent/50 shadow-[0_0_40px_rgba(0,223,130,0.12)]'
                    : 'border-border/50 hover:border-accent/30',
                  'hover:shadow-[0_0_50px_rgba(0,223,130,0.1)]'
                )}
              >
                {/* Card gradient background */}
                <div
                  className={cn(
                    'absolute inset-0 opacity-0 transition-opacity duration-500',
                    'bg-gradient-to-br from-accent/5 via-transparent to-secondary/5',
                    method.highlight ? 'opacity-100' : 'group-hover:opacity-100'
                  )}
                />

                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-14 h-14 rounded-xl mb-5 flex items-center justify-center',
                      'bg-accent/10 border border-accent/20',
                      'transition-all duration-300',
                      'group-hover:bg-accent/15 group-hover:border-accent/30',
                      'group-hover:shadow-[0_0_20px_rgba(0,223,130,0.2)]'
                    )}
                  >
                    <HugeiconsIcon
                      icon={method.icon}
                      size={24}
                      className="text-accent"
                    />
                  </div>

                  {/* Content */}
                  <h3 className="font-outfit text-lg font-medium mb-2 text-foreground">
                    {method.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {method.description}
                  </p>

                  {/* Action */}
                  <span
                    className="inline-flex items-center text-sm font-medium text-accent
                      group-hover:text-accent transition-colors"
                  >
                    {method.action}
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={16}
                      className="ml-2 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </div>

                {/* Highlight badge for featured method */}
                {method.highlight && (
                  <div className="absolute top-4 right-4">
                    <Badge
                      className="text-xs px-2 py-0.5
                        bg-gradient-to-r from-accent to-secondary
                        text-accent-foreground border-0"
                    >
                      Recommended
                    </Badge>
                  </div>
                )}
              </motion.a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* MAIN CONTACT SECTION - Form + Info */}
      {/* ================================================================== */}
      <section className="relative py-16 sm:py-24 lg:py-32 overflow-hidden">
        {/* Background aurora */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-0 right-0 h-px
              bg-gradient-to-r from-transparent via-accent/20 to-transparent"
          />
          <div
            className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full
              bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.06)_0%,transparent_70%)]
              blur-[80px]"
          />
        </div>

        <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
              {/* ============================================= */}
              {/* LEFT COLUMN - Contact Form (3 cols) */}
              {/* ============================================= */}
              <motion.div
                className="lg:col-span-3"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              >
                {/* Form Card */}
                <div
                  className="rounded-2xl overflow-hidden
                    bg-card/50 backdrop-blur-sm
                    border border-border/50
                    shadow-[0_0_60px_rgba(0,223,130,0.05)]"
                >
                  {/* Form Header */}
                  <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-border/50">
                    <h2 className="font-outfit text-2xl sm:text-3xl font-light mb-2">
                      Send us a message
                    </h2>
                    <p className="text-muted-foreground">
                      We typically respond within 24 hours.
                    </p>
                  </div>

                  {/* Form Body */}
                  <div className="p-6 sm:p-8">
                    {isSubmitted ? (
                      <SuccessState onReset={() => setIsSubmitted(false)} />
                    ) : (
                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Name & Email Row */}
                        <div className="grid sm:grid-cols-2 gap-6">
                          <FormField
                            name="name"
                            label="Name"
                            required
                            control={control}
                            error={formErrors.name?.message}
                            disabled={isSubmitting}
                            placeholder="Your name"
                          />
                          <FormField
                            name="email"
                            label="Email"
                            type="email"
                            required
                            control={control}
                            error={formErrors.email?.message}
                            disabled={isSubmitting}
                            placeholder="you@company.com"
                          />
                        </div>

                        {/* Company & Inquiry Type Row */}
                        <div className="grid sm:grid-cols-2 gap-6">
                          <FormField
                            name="company"
                            label="Company"
                            control={control}
                            error={formErrors.company?.message}
                            disabled={isSubmitting}
                            placeholder="Your company"
                          />
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">
                              Inquiry Type
                            </Label>
                            <Controller
                              name="inquiryType"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={isSubmitting}
                                >
                                  <SelectTrigger
                                    className="h-12 rounded-xl bg-background/50
                                      border-border/50 focus:border-accent/50
                                      focus:ring-2 focus:ring-accent/20
                                      transition-all duration-200"
                                  >
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {INQUIRY_TYPES.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        {/* Subject */}
                        <FormField
                          name="subject"
                          label="Subject"
                          required
                          control={control}
                          error={formErrors.subject?.message}
                          disabled={isSubmitting}
                          placeholder="How can we help you?"
                        />

                        {/* Message */}
                        <div className="space-y-2">
                          <Label htmlFor="message" className="text-sm font-medium">
                            Message <span className="text-accent">*</span>
                          </Label>
                          <Controller
                            name="message"
                            control={control}
                            render={({ field }) => (
                              <Textarea
                                {...field}
                                id="message"
                                rows={5}
                                placeholder="Tell us more about your inquiry..."
                                disabled={isSubmitting}
                                className="resize-none rounded-xl bg-background/50
                                  border-border/50 focus:border-accent/50
                                  focus:ring-2 focus:ring-accent/20
                                  transition-all duration-200"
                              />
                            )}
                          />
                          {formErrors.message ? (
                            <p className="text-sm text-destructive">
                              {formErrors.message.message}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Minimum 20 characters
                            </p>
                          )}
                        </div>

                        {/* Submit Button */}
                        <Button
                          type="submit"
                          size="lg"
                          disabled={isSubmitting}
                          className="w-full h-14 rounded-full group
                            bg-gradient-to-r from-accent to-secondary
                            text-accent-foreground font-medium
                            hover:shadow-[0_0_40px_rgba(0,223,130,0.4)]
                            transition-all duration-300
                            disabled:opacity-70"
                        >
                          {isSubmitting ? (
                            <>
                              <HugeiconsIcon
                                icon={Loading03Icon}
                                size={20}
                                className="mr-2 animate-spin"
                              />
                              Sending...
                            </>
                          ) : (
                            <>
                              <HugeiconsIcon icon={SentIcon} size={20} className="mr-2" />
                              Send Message
                              <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                size={20}
                                className="ml-2 transition-transform group-hover:translate-x-1"
                              />
                            </>
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* ============================================= */}
              {/* RIGHT COLUMN - Contact Info (2 cols) */}
              {/* ============================================= */}
              <motion.div
                className="lg:col-span-2 space-y-8"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 400, damping: 30, delay: 0.1 }}
              >
                {/* Contact Info Card */}
                <div
                  className="rounded-2xl overflow-hidden p-6
                    bg-card/30 backdrop-blur-sm
                    border border-border/50"
                >
                  <h3 className="font-outfit text-lg font-medium mb-6">
                    Other Ways to Reach Us
                  </h3>

                  <div className="space-y-5">
                    <ContactInfoItem
                      icon={Mail01Icon}
                      title="Email Support"
                      subtitle="For technical support"
                      action="support@tribora.com"
                      actionHref="mailto:support@tribora.com"
                    />
                    <ContactInfoItem
                      icon={Call02Icon}
                      title="Sales Team"
                      subtitle="Talk to our enterprise team"
                      action="Schedule a call"
                      actionHref="/contact?type=demo"
                    />
                    <ContactInfoItem
                      icon={Location01Icon}
                      title="Office"
                      subtitle="San Francisco, CA"
                      action="United States"
                    />
                    <ContactInfoItem
                      icon={Clock01Icon}
                      title="Business Hours"
                      subtitle="Mon - Fri, 9am - 6pm PST"
                      action="24hr support for Enterprise"
                    />
                  </div>
                </div>

                {/* Quick Links Card */}
                <div
                  className="rounded-2xl overflow-hidden p-6
                    bg-gradient-to-br from-accent/5 via-card/50 to-secondary/5
                    backdrop-blur-sm border border-accent/20"
                >
                  <h3 className="font-outfit text-lg font-medium mb-4">
                    Looking for Quick Answers?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Explore our resources for instant help with common questions.
                  </p>
                  <div className="space-y-3">
                    <QuickLink href="/pricing" label="View Pricing Plans" />
                    <QuickLink href="/features" label="Explore Features" />
                    <QuickLink href="/features/knowledge-graph" label="Knowledge Graph" />
                  </div>
                </div>

                {/* Response Time Indicator */}
                <motion.div
                  className="flex items-center gap-3 p-4 rounded-xl
                    bg-accent/5 border border-accent/20"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
                  <p className="text-sm text-muted-foreground">
                    <span className="text-foreground font-medium">Fast response</span>
                    {' '}— We typically reply within 24 hours
                  </p>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA SECTION */}
      {/* ================================================================== */}
      <AuroraCTA />
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface FormFieldProps {
  name: keyof ContactFormData;
  label: string;
  type?: string;
  required?: boolean;
  control: any;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

function FormField({
  name,
  label,
  type = 'text',
  required,
  control,
  error,
  disabled,
  placeholder,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-sm font-medium">
        {label} {required && <span className="text-accent">*</span>}
      </Label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            type={type}
            id={name}
            placeholder={placeholder}
            disabled={disabled}
            className="h-12 rounded-xl bg-background/50
              border-border/50 focus:border-accent/50
              focus:ring-2 focus:ring-accent/20
              transition-all duration-200"
          />
        )}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

interface ContactInfoItemProps {
  icon: typeof Mail01Icon;
  title: string;
  subtitle: string;
  action: string;
  actionHref?: string;
}

function ContactInfoItem({
  icon,
  title,
  subtitle,
  action,
  actionHref,
}: ContactInfoItemProps) {
  const content = (
    <div className="flex items-start gap-4 group">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0
          bg-accent/10 border border-accent/20
          transition-all duration-300
          group-hover:bg-accent/15 group-hover:border-accent/30"
      >
        <HugeiconsIcon icon={icon} size={20} className="text-accent" />
      </div>
      <div>
        <h4 className="font-medium text-sm mb-0.5">{title}</h4>
        <p className="text-xs text-muted-foreground mb-1">{subtitle}</p>
        <span
          className={cn(
            'text-sm font-medium',
            actionHref ? 'text-accent hover:underline' : 'text-muted-foreground'
          )}
        >
          {action}
        </span>
      </div>
    </div>
  );

  if (actionHref) {
    return (
      <a href={actionHref} className="block">
        {content}
      </a>
    );
  }

  return content;
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 text-sm font-medium text-accent
        hover:underline transition-colors group"
    >
      <HugeiconsIcon icon={LinkSquare01Icon} size={14} className="text-accent/70" />
      {label}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        size={14}
        className="ml-auto transition-transform group-hover:translate-x-1"
      />
    </Link>
  );
}

function SuccessState({ onReset }: { onReset: () => void }) {
  return (
    <motion.div
      className="text-center py-12"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Success Icon */}
      <motion.div
        className="w-20 h-20 mx-auto mb-6 rounded-full
          bg-gradient-to-br from-accent/20 to-secondary/20
          border border-accent/30
          flex items-center justify-center
          shadow-[0_0_40px_rgba(0,223,130,0.2)]"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
      >
        <HugeiconsIcon icon={Tick02Icon} size={36} className="text-accent" />
      </motion.div>

      <h3 className="font-outfit text-2xl font-light mb-3">
        Message Sent Successfully!
      </h3>
      <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
        Thank you for reaching out. Our team will review your message and get back
        to you within 24 hours.
      </p>

      <Button
        variant="outline"
        onClick={onReset}
        className="rounded-full px-6 border-accent/30 hover:border-accent/50
          hover:bg-accent/5 transition-all duration-300"
      >
        Send Another Message
      </Button>
    </motion.div>
  );
}
