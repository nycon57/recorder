export default function PrivacyPage() {
  return (
    <div className="container px-4 py-16 mx-auto max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p className="text-muted-foreground mb-4">
            Record ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your information when you use our Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>

          <h3 className="text-xl font-semibold mb-3 mt-4">Information You Provide</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Account information (name, email address)</li>
            <li>Organization details</li>
            <li>Payment and billing information</li>
            <li>Recordings, transcripts, and generated documents</li>
            <li>Communications with us</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 mt-4">Information Automatically Collected</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Device and browser information</li>
            <li>IP address and location data</li>
            <li>Usage data and analytics</li>
            <li>Cookies and similar technologies</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
          <p className="text-muted-foreground mb-4">
            We use your information to:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Provide and maintain the Service</li>
            <li>Process recordings and generate transcripts/documents</li>
            <li>Enable AI-powered search and assistance features</li>
            <li>Process payments and manage subscriptions</li>
            <li>Send service-related communications</li>
            <li>Improve and develop new features</li>
            <li>Ensure security and prevent fraud</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Data Processing and AI</h2>
          <p className="text-muted-foreground mb-4">
            We use third-party AI services (OpenAI) to process your recordings:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Audio transcription using OpenAI Whisper</li>
            <li>Document generation using GPT models</li>
            <li>Text embeddings for semantic search</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            Your content is not used to train AI models. We have Data Processing Agreements with our
            AI providers that protect your data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
          <p className="text-muted-foreground mb-4">
            We do not sell your personal information. We may share data with:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li><strong>Service Providers:</strong> Cloud hosting (Vercel), storage (Supabase), AI processing (OpenAI), payment processing (Stripe)</li>
            <li><strong>Team Members:</strong> Within your organization as configured by admins</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect rights</li>
            <li><strong>Business Transfers:</strong> In connection with mergers or acquisitions</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
          <p className="text-muted-foreground mb-4">
            We retain your data for as long as your account is active or as needed to provide the Service.
            You can delete your recordings and documents at any time. After account deletion, we retain
            data only as required by law or for legitimate business purposes (e.g., billing records).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Data Security</h2>
          <p className="text-muted-foreground mb-4">
            We implement industry-standard security measures to protect your data:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Encryption in transit (TLS) and at rest</li>
            <li>Access controls and authentication</li>
            <li>Regular security audits and monitoring</li>
            <li>Secure infrastructure and hosting</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Your Privacy Rights</h2>
          <p className="text-muted-foreground mb-4">
            Depending on your location, you may have the following rights:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Correction:</strong> Update inaccurate information</li>
            <li><strong>Deletion:</strong> Request deletion of your data</li>
            <li><strong>Portability:</strong> Export your data</li>
            <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
            <li><strong>Objection:</strong> Object to certain data processing</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            To exercise these rights, contact us at{' '}
            <a href="mailto:privacy@record.app" className="text-blue-600 hover:underline">
              privacy@record.app
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Cookies and Tracking</h2>
          <p className="text-muted-foreground mb-4">
            We use cookies and similar technologies for:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Essential functionality (authentication, session management)</li>
            <li>Analytics and performance monitoring</li>
            <li>User preferences and settings</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            You can control cookies through your browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
          <p className="text-muted-foreground mb-4">
            Your data may be processed in countries outside your own. We ensure adequate protections
            through standard contractual clauses and compliance with applicable data protection laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Children's Privacy</h2>
          <p className="text-muted-foreground mb-4">
            The Service is not intended for children under 13. We do not knowingly collect personal
            information from children. If you believe we have collected such data, contact us immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Changes to This Policy</h2>
          <p className="text-muted-foreground mb-4">
            We may update this Privacy Policy from time to time. We will notify you of material changes
            via email or through the Service. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
          <p className="text-muted-foreground">
            For questions about this Privacy Policy or our data practices, contact us at:
          </p>
          <ul className="list-none text-muted-foreground space-y-1 mt-4">
            <li>Email: <a href="mailto:privacy@record.app" className="text-blue-600 hover:underline">privacy@record.app</a></li>
            <li>Address: [Your Company Address]</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
