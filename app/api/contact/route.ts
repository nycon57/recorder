import { NextRequest } from 'next/server';
import { Resend } from 'resend';

import {
  apiHandler,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { contactFormSchema } from '@/lib/validations/contact';
import { rateLimit, RateLimitTier } from '@/lib/middleware/rate-limit';

// Initialize Resend client lazily
let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Escape HTML special characters to prevent XSS
 * Converts &, <, >, ", ', and / into safe HTML entities
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * POST /api/contact
 *
 * Submit contact form - sends email to support team
 * Public endpoint (no auth required)
 *
 * @body name - Contact's name
 * @body email - Contact's email
 * @body company - Company name (optional)
 * @body subject - Message subject
 * @body message - Message content
 *
 * @returns Success message
 *
 * @security Rate limited to 5 requests per hour per IP for public access
 */
export const POST = rateLimit(RateLimitTier.PUBLIC, async (req: NextRequest) => {
  // Rate limit by IP address for public endpoint
  // Parse x-forwarded-for (may contain multiple IPs) and take the first one
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');

  let ip: string | undefined;
  if (forwardedFor) {
    // x-forwarded-for format: "client, proxy1, proxy2"
    // Take the first IP (the actual client)
    ip = forwardedFor.split(',')[0]?.trim();
  }

  // Fallback chain: x-forwarded-for → x-real-ip → undefined
  return ip || realIp || undefined;
})(
  apiHandler(async (request: NextRequest) => {
    // Validate request body
    const body = await parseBody(request, contactFormSchema);

    if (
      !body ||
      typeof body !== 'object' ||
      !('name' in body) ||
      !('email' in body) ||
      !('subject' in body) ||
      !('message' in body)
    ) {
      return errors.badRequest('Invalid request body');
    }

    const { name, email, company, subject, message } = body as {
      name: string;
      email: string;
      company?: string;
      subject: string;
      message: string;
    };

    // Escape all user-controlled values to prevent XSS
    const escapedName = escapeHtml(name);
    const escapedEmail = escapeHtml(email);
    const escapedCompany = company ? escapeHtml(company) : null;
    const escapedSubject = escapeHtml(subject);
    // Escape message and preserve line breaks by replacing \n with <br/>
    const escapedMessage = escapeHtml(message).replace(/\n/g, '<br/>');

    try {
      // Send email using Resend
      const resend = getResendClient();
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'notifications@yourdomain.com';
      const toEmail = process.env.CONTACT_EMAIL || 'support@record.app';

      await resend.emails.send({
        from: fromEmail,
        to: toEmail as string,
        reply_to: email,
        subject: `Contact Form: ${escapedSubject}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
                .header h1 { margin: 0; font-size: 24px; }
                .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
                .field { margin-bottom: 20px; }
                .label { font-weight: 600; color: #374151; margin-bottom: 5px; display: block; }
                .value { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
                .message-box { background: white; padding: 20px; border-radius: 6px; border: 1px solid #e5e7eb; white-space: pre-wrap; }
                .footer { background: #f3f4f6; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 8px 8px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎥 New Contact Form Submission</h1>
                </div>
                <div class="content">
                  <div class="field">
                    <span class="label">From:</span>
                    <div class="value">${escapedName}</div>
                  </div>
                  <div class="field">
                    <span class="label">Email:</span>
                    <div class="value"><a href="mailto:${escapedEmail}">${escapedEmail}</a></div>
                  </div>
                  ${escapedCompany ? `
                  <div class="field">
                    <span class="label">Company:</span>
                    <div class="value">${escapedCompany}</div>
                  </div>
                  ` : ''}
                  <div class="field">
                    <span class="label">Subject:</span>
                    <div class="value">${escapedSubject}</div>
                  </div>
                  <div class="field">
                    <span class="label">Message:</span>
                    <div class="message-box">${escapedMessage}</div>
                  </div>
                </div>
                <div class="footer">
                  <p>This message was sent from the Record contact form</p>
                  <p>Reply directly to this email to respond to ${escapedName}</p>
                </div>
              </div>
            </body>
          </html>
        `,
      });

      return successResponse({
        message: 'Thank you for contacting us! We will get back to you within 24 hours.',
      });
    } catch (error) {
      console.error('[POST /api/contact] Error sending email:', error);
      return errors.internalError('Failed to send message. Please try again later.');
    }
  })
);
