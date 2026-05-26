import Image from 'next/image'
import Link from 'next/link'

export default function PrivacyPolicyPage() {
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
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Privacy Policy</h1>
            <p className="text-sm text-zinc-500 mt-2">Last updated: May 14, 2026</p>
          </div>

          {/* Content */}
          <div className="space-y-6 text-sm text-zinc-300 leading-relaxed">
            <p>
              Memora Bond (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Chrome extension and web application (collectively, the &quot;Service&quot;). By using the Service, you agree to the collection and use of information in accordance with this policy.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">1. Information We Collect</h2>
            <h3 className="text-base font-medium text-zinc-200 mt-4 mb-2">1.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Account Information:</strong> When you sign in with Google, we receive your Google account identifier, display name, email address, and profile picture from Google. We do not request or store your Google password.</li>
              <li><strong className="text-zinc-300">Payment Information:</strong> Subscription payments are processed through PayPal. We do not collect, store, or have access to your credit card number, bank account details, or PayPal login credentials. We only receive your subscription status from PayPal.</li>
              <li><strong className="text-zinc-300">User Preferences:</strong> Settings you configure within the app, such as data retention preferences, notification settings, and sensitivity filters.</li>
            </ul>

            <h3 className="text-base font-medium text-zinc-200 mt-4 mb-2">1.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Browsing Data:</strong> When you use the Chrome extension, we collect the URL, page title, and content snippets of web pages you visit. This data is stored as &quot;memories&quot; in your personal account and is used solely to provide the memory search and recall features.</li>
              <li><strong className="text-zinc-300">Session Data:</strong> Information about your browsing sessions, including session duration, active project context, and task descriptions you provide.</li>
              <li><strong className="text-zinc-300">Usage Analytics:</strong> Aggregated, anonymized data about how you interact with the Service, such as features used, search queries (in anonymized form), and dashboard navigation patterns.</li>
              <li><strong className="text-zinc-300">Device Information:</strong> Browser type and version, operating system, and a browser fingerprint hash used to identify your device for session continuity.</li>
              <li><strong className="text-zinc-300">Log Data:</strong> IP address, access times, and pages viewed within our web application, collected automatically by our hosting provider (Firebase/Google Cloud).</li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li>To provide, maintain, and improve the Service, including saving, organizing, and searching your browsing memories.</li>
              <li>To authenticate your identity and secure your account using Google Sign-In and Firebase Authentication.</li>
              <li>To process subscription payments and manage your billing status through PayPal.</li>
              <li>To provide AI-powered features, including memory summarization, contextual search, knowledge graph generation, and recall assistance.</li>
              <li>To detect and filter sensitive content (such as passwords, API keys, and personal identification numbers) through our Vault feature.</li>
              <li>To communicate with you about your account, subscription status, and important service updates.</li>
              <li>To analyze usage patterns and improve the Service&apos;s performance, reliability, and user experience.</li>
              <li>To comply with legal obligations and enforce our terms of service.</li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">3. Data Storage and Security</h2>
            <p>
              Your data is stored in Google Cloud Firestore, a fully managed, serverless NoSQL database with encryption at rest. All data transmission between your browser, our extension, and our servers is encrypted using TLS (HTTPS). We implement Firebase Authentication with JWT tokens for secure session management. Access to your data is restricted to your authenticated account, and our backend services only access your data to provide the Service functionalities described above.
            </p>
            <p>
              We use the Vault feature to automatically detect and redact sensitive information from your browsing memories. However, no system is perfectly secure, and we cannot guarantee the absolute security of your data. We encourage you to review sensitive memories regularly and use the Vault feature to flag content you consider sensitive.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">4. Data Sharing and Disclosure</h2>
            <p>We do not sell, rent, or trade your personal data to third parties. We may share your information in the following limited circumstances:</p>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Service Providers:</strong> We share data with Google (Firebase) for authentication, database storage, and hosting, and with PayPal for subscription payment processing. These service providers are bound by their own privacy policies and data processing agreements.</li>
              <li><strong className="text-zinc-300">Legal Requirements:</strong> We may disclose your information if required to do so by law, in response to valid legal process, or to protect our rights, privacy, safety, or property, or that of our users or the public.</li>
              <li><strong className="text-zinc-300">AI Processing:</strong> Your browsing memories may be processed by AI models (hosted by our service providers) to generate summaries, search results, and contextual insights. Your data is not used to train AI models for any purpose outside of providing the Service to you.</li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">5. Data Retention</h2>
            <p>
              We retain your browsing data for the duration of your subscription and for up to 90 days after account deletion or subscription cancellation, unless you request earlier deletion. Session data and usage analytics are retained for up to 90 days. You can configure your data retention preferences in the Settings section of the dashboard. You may request deletion of your data at any time by contacting us.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">6. Your Rights and Choices</h2>
            <p>You have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Access:</strong> You can view all your stored memories, sessions, and project data through your dashboard at any time.</li>
              <li><strong className="text-zinc-300">Deletion:</strong> You can delete individual memories, sessions, or your entire account. Upon account deletion, we will remove all your personal data within 90 days.</li>
              <li><strong className="text-zinc-300">Correction:</strong> You can edit memory titles, tags, and summaries within the dashboard.</li>
              <li><strong className="text-zinc-300">Data Portability:</strong> You can export your memories as PDF documents through the export feature in the dashboard.</li>
              <li><strong className="text-zinc-300">Opt-Out:</strong> You can disable browsing tracking, auto-capture, or sensitive content filtering at any time in the Settings section. Uninstalling the Chrome extension will stop all data collection from browsing activity.</li>
              <li><strong className="text-zinc-300">Subscription Cancellation:</strong> You can cancel your PayPal subscription at any time through the dashboard or through your PayPal account settings.</li>
            </ul>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">7. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for use by individuals under the age of 16. We do not knowingly collect personal data from children. If we become aware that we have collected personal data from a child under 16, we will take steps to delete that information promptly. If you believe we have collected data from a child, please contact us immediately.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">8. International Data Transfers</h2>
            <p>
              Your data is stored on Google Cloud servers, which may be located in different regions around the world. By using the Service, you consent to the transfer of your data to countries where Google operates data centers. Google Cloud complies with applicable data protection frameworks, including the EU-US Data Privacy Framework.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">9. Chrome Extension Permissions</h2>
            <p>
              The Memora Bond Chrome extension requires the following permissions to function:
            </p>
            <ul className="list-disc pl-6 space-y-1 text-zinc-400">
              <li><strong className="text-zinc-300">Read and change your data on all websites:</strong> Used to capture page titles, URLs, and content snippets from pages you visit to create searchable memories.</li>
              <li><strong className="text-zinc-300">Storage:</strong> Used to store extension settings and cached data locally on your device.</li>
              <li><strong className="text-zinc-300">Identity:</strong> Used to authenticate with your Google account and link the extension to your Memora Bond dashboard.</li>
            </ul>
            <p>
              The extension does not read passwords, form inputs, payment information, or any data on incognito/private tabs. All captured data is transmitted securely over HTTPS and stored in your personal, authenticated Firestore database.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page and updating the &quot;Last updated&quot; date. We encourage you to review this page periodically for the latest information on our privacy practices. Your continued use of the Service after any changes constitutes your acceptance of the updated policy.
            </p>

            <h2 className="text-lg font-semibold text-zinc-100 mt-8 mb-3">11. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
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
