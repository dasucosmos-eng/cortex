import Image from 'next/image'
import Link from 'next/link'

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start px-4 py-12">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">
            &larr; Back to Memora Bond
          </Link>
        </div>

        <div className="glass rounded-2xl p-8 md:p-12 shadow-2xl">
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-10">
            <Image src="/logo.png" alt="Memora Bond" width={48} height={48} className="mb-4 rounded-xl shadow-lg shadow-violet-500/25" />
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Terms and Conditions</h1>
            <p className="text-sm text-zinc-500 mt-2">Last updated: May 14, 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
            <p>
              These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of the Memora Bond Chrome extension and web application (collectively, the &quot;Service&quot;), operated by Memora Bond (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the Service.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">1. Acceptance of Terms</h2>
            <p>
              By creating an account, installing the Chrome extension, or using any part of the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. These Terms apply to all visitors, users, and others who access or use the Service. We reserve the right to update or modify these Terms at any time without prior notice. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">2. Eligibility</h2>
            <p>
              You must be at least 16 years of age to use the Service. By using the Service, you represent and warrant that you are at least 16 years old and have the legal capacity to enter into these Terms. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">3. Account Registration and Security</h2>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li>You must sign in using a Google account to use the Service. You are responsible for maintaining the confidentiality of your Google account credentials.</li>
              <li>You are responsible for all activities that occur under your account. If you become aware of any unauthorized use of your account, you must notify us immediately.</li>
              <li>We reserve the right to suspend or terminate your account if any information provided is found to be inaccurate, incomplete, or in violation of these Terms.</li>
              <li>One person or entity may not maintain more than one account without our written permission.</li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">4. Subscription and Billing</h2>
            <h3 className="text-base font-medium text-zinc-200 mt-4 mb-2">4.1 Free Trial</h3>
            <p>
              New users are eligible for a 2-day free trial of the Pro Plan. The free trial begins upon account creation and lasts for exactly 48 hours. During the trial period, you have full access to all Pro features. No payment is required during the trial.
            </p>

            <h3 className="text-base font-medium text-zinc-200 mt-4 mb-2">4.2 Subscription Pricing</h3>
            <p>
              After the free trial ends, continued use of the Service requires an active Pro subscription at $12 USD per month (or the equivalent in your local currency as displayed by PayPal). Prices are subject to change with 30 days&apos; advance notice.
            </p>

            <h3 className="text-base font-medium text-zinc-200 mt-4 mb-2">4.3 Payment Processing</h3>
            <p>
              All subscription payments are processed through PayPal. By subscribing, you agree to PayPal&apos;s terms of service. Your subscription will automatically renew each month unless you cancel it before the renewal date. You can cancel your subscription at any time through the Memora Bond dashboard or through your PayPal account settings.
            </p>

            <h3 className="text-base font-medium text-zinc-200 mt-4 mb-2">4.4 Refund Policy</h3>
            <p>
              Subscription fees are non-refundable once charged. If you cancel your subscription, you will retain access to Pro features until the end of your current billing period. We do not provide partial refunds for unused portions of a billing period. If you believe you have been charged in error, please contact us within 7 days of the charge.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">5. Description of Service</h2>
            <p>
              Memora Bond is an AI-powered browser memory extension and web dashboard that captures, organizes, and makes searchable the web pages you visit. The Service includes, but is not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li>Automatic capture of browsing data (URLs, page titles, content snippets) via the Chrome extension.</li>
              <li>Organization of browsing memories into sessions, projects, and a knowledge graph.</li>
              <li>AI-powered search, summarization, and recall of stored memories.</li>
              <li>A web dashboard for viewing, managing, and exporting your memories.</li>
              <li>A sensitive content vault for flagging and redacting private information.</li>
              <li>PDF export of memories and context summaries.</li>
            </ul>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the Service.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">6. User Responsibilities</h2>
            <p>When using the Service, you agree that you will:</p>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li>Use the Service only for lawful purposes and in compliance with all applicable laws and regulations.</li>
              <li>Not use the Service to store, process, or share any content that is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable.</li>
              <li>Not attempt to gain unauthorized access to any portion of the Service, other user accounts, or any systems or networks connected to the Service.</li>
              <li>Not use the Service in any way that could damage, disable, overburden, or impair the Service&apos;s servers, networks, or infrastructure.</li>
              <li>Not use any automated means (bots, scrapers, etc.) to access the Service or collect information from it, except through the provided extension API.</li>
              <li>Not reproduce, duplicate, sell, or exploit any portion of the Service without our express written permission.</li>
              <li>Be responsible for the content you store using the Service and ensure it does not infringe on the rights of others.</li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">7. Intellectual Property</h2>
            <p>
              The Service and its original content (excluding user-provided content), features, and functionality are and will remain the exclusive property of Memora Bond and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Memora Bond. You retain all rights to the browsing data and memories you create using the Service.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">8. User Content</h2>
            <p>
              &quot;User Content&quot; refers to any data, text, memories, sessions, and other content you submit, store, or create through the Service. You retain ownership of your User Content. By using the Service, you grant us a limited, non-exclusive, non-transferable, revocable license to store, process, and display your User Content solely for the purpose of providing the Service to you. We do not claim ownership over your User Content and will not share it with third parties except as described in our Privacy Policy.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, in no event shall Memora Bond, its affiliates, directors, employees, agents, or licensors be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of profits, or business interruption, arising out of or in connection with your use of or inability to use the Service. Our total liability to you for all claims arising out of or relating to the Service shall not exceed the amount you have paid us in the twelve (12) months preceding the event giving rise to the liability.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">10. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis, without any warranties of any kind, either express or implied. We do not guarantee that the Service will be uninterrupted, timely, secure, or error-free. We do not warrant that the results obtained from the use of the Service will be accurate or reliable. You understand and agree that your use of the Service is at your sole risk.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">11. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless Memora Bond and its affiliates, directors, employees, agents, and licensors from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt arising from your use of the Service, your violation of these Terms, or your violation of any rights of a third party.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">12. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including without limitation if you breach these Terms. Upon termination, your right to use the Service will immediately cease. All provisions of these Terms which by their nature should survive termination shall survive, including without limitation ownership provisions, warranty disclaimers, indemnification, and limitations of liability.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">13. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with applicable laws, without regard to conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">14. Contact Information</h2>
            <p>
              For any questions or concerns about these Terms and Conditions, please contact us at:
            </p>
            <div className="mt-3 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/30 text-zinc-400">
              <p><strong className="text-zinc-300">Memora Bond</strong></p>
              <p>Email: cornelius1stcen@gmail.com</p>
              <p>Website: https://memora.bond</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 mt-8 text-xs text-zinc-600">
          <Link href="/privacy-policy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <span>|</span>
          <Link href="/terms-and-conditions" className="hover:text-zinc-400 transition-colors">Terms and Conditions</Link>
        </div>
      </div>
    </div>
  )
}
