export default function TermsPage() {
  return (
    <div className="container px-4 py-16 mx-auto max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <div className="prose prose-gray dark:prose-invert max-w-none">
        <p className="text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground mb-4">
            By accessing and using Record ("the Service"), you accept and agree to be bound by the terms
            and provision of this agreement. If you do not agree to these Terms of Service, please do not
            use the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
          <p className="text-muted-foreground mb-4">
            Record provides a cloud-based platform for screen recording, transcription, document generation,
            and AI-powered knowledge management. The Service allows users to:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Record screen, camera, and audio</li>
            <li>Automatically transcribe recordings</li>
            <li>Generate AI-powered documentation</li>
            <li>Search and query recorded content</li>
            <li>Collaborate with team members</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
          <p className="text-muted-foreground mb-4">
            To use certain features of the Service, you must register for an account. You agree to:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain and promptly update your account information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Accept responsibility for all activities under your account</li>
            <li>Notify us immediately of any unauthorized use</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
          <p className="text-muted-foreground mb-4">
            You agree not to use the Service to:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Violate any laws or regulations</li>
            <li>Infringe on intellectual property rights</li>
            <li>Upload malicious code or content</li>
            <li>Harass, abuse, or harm others</li>
            <li>Spam or send unsolicited communications</li>
            <li>Attempt to gain unauthorized access to the Service</li>
            <li>Record individuals without their consent where legally required</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Content and Intellectual Property</h2>
          <p className="text-muted-foreground mb-4">
            You retain all rights to content you upload to the Service. By uploading content, you grant
            Record a worldwide, non-exclusive license to host, store, and process your content solely to
            provide the Service.
          </p>
          <p className="text-muted-foreground mb-4">
            The Service itself, including its software, design, and trademarks, is owned by Record and
            protected by intellectual property laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Privacy and Data</h2>
          <p className="text-muted-foreground mb-4">
            Your use of the Service is also governed by our Privacy Policy. We collect and use your data
            as described in the Privacy Policy to provide and improve the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Subscription and Payments</h2>
          <p className="text-muted-foreground mb-4">
            Certain features require a paid subscription. By subscribing, you agree to:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
            <li>Pay all fees associated with your subscription tier</li>
            <li>Provide valid payment information</li>
            <li>Authorize automatic renewal unless cancelled</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            You may cancel your subscription at any time. Refunds are provided on a case-by-case basis
            at our discretion.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Termination</h2>
          <p className="text-muted-foreground mb-4">
            We reserve the right to suspend or terminate your account if you violate these Terms. Upon
            termination, your right to use the Service ceases immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
          <p className="text-muted-foreground mb-4">
            The Service is provided "as is" without warranties of any kind, either express or implied,
            including but not limited to warranties of merchantability, fitness for a particular purpose,
            or non-infringement.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
          <p className="text-muted-foreground mb-4">
            Record shall not be liable for any indirect, incidental, special, consequential, or punitive
            damages resulting from your use or inability to use the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Changes to Terms</h2>
          <p className="text-muted-foreground mb-4">
            We may modify these Terms at any time. We will notify users of material changes via email or
            through the Service. Continued use of the Service after changes constitutes acceptance.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">12. Contact Information</h2>
          <p className="text-muted-foreground">
            For questions about these Terms, please contact us at{' '}
            <a href="mailto:legal@record.app" className="text-blue-600 hover:underline">
              legal@record.app
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
