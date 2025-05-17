import Navbar from '@/components/Navbar';
export default function TermsPage() {
  return (
    <>
      <Navbar />
      <div className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
            
            <div className="prose prose-blue max-w-none">
              <p className="text-gray-600 mb-6">
                <strong>Effective Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              
              <p className="text-gray-600 mb-6">
                Welcome to taxenough.com ("we", "our", "us"). By accessing or using our website and services, you ("user", "you") agree to be bound by these Terms of Service. If you do not agree with these terms, please <strong>do not use our services</strong>.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">1. Nature of Our Service</h2>
              <p className="text-gray-600 mb-4">
                taxenough.com provides tools that help users estimate the potential tax liabilities on their investment income in the United States. These tools use automated algorithms and data analysis to simplify the complex process of understanding U.S. tax obligations.
              </p>
              <p className="text-gray-600 mb-4">
                <strong>Important:</strong> We do not offer tax advice or tax preparation services. Our platform is designed strictly for educational and informational purposes based on user-provided inputs. You should consult a licensed tax professional for personalized tax guidance or filing assistance.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">2. User Accounts</h2>
              <p className="text-gray-600 mb-4">
                To access certain features and save your progress, you are required to create an account. You are responsible for maintaining the confidentiality of your account information and for all activities that occur under your account.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">3. Acceptable and Restricted Use</h2>
              <p className="text-gray-600 mb-4">
                Our service is intended only for:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2">Individuals looking to understand the potential U.S. tax implications of their investment gains.</li>
              </ul>
              <p className="text-gray-600 mb-4">
                You may not use our service:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2">To seek official or binding tax advice</li>
                <li className="mb-2">As a substitute for professional tax consultation or filing</li>
                <li className="mb-2">In any fraudulent, unlawful, or misleading manner</li>
                <li className="mb-2">To attempt to reverse-engineer, copy, or exploit our software or data</li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">4. Account Termination and Access Restriction</h2>
              <p className="text-gray-600 mb-4">
                We reserve the right to suspend or terminate user accounts without notice if there is evidence of:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2">Abuse or misuse of our platform</li>
                <li className="mb-2">Violation of our terms or applicable laws</li>
                <li className="mb-2">Attempted data scraping, hacking, or unauthorized access</li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">5. Accuracy and Limitations of Information</h2>
              <p className="text-gray-600 mb-4">
                We are committed to providing helpful, timely, and accurate tools based on current publicly available U.S. tax laws and rates. Our calculators and estimators are developed with care and updated regularly to reflect recent tax changes.
              </p>
              <p className="text-gray-600 mb-4">
                However, due to the complexity and frequent changes in tax regulations, we cannot guarantee that all results will be 100% accurate or applicable to your specific situation. The information provided is intended for informational purposes only and should not be used as a substitute for professional tax advice or filing.
              </p>
              <p className="text-gray-600 mb-4">
                We recommend consulting a licensed tax professional before making any final decisions regarding your tax filings.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">6. Ownership of Content and Technology</h2>
              <p className="text-gray-600 mb-4">
                All content, source code, algorithms, and software infrastructure used on this website are the property of taxenough.com and are protected under intellectual property laws. You may not reproduce, modify, or distribute any part of our platform without prior written permission.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">7. User Input and Data</h2>
              <p className="text-gray-600 mb-4">
                Any data you input into our calculators or tools is used solely for providing personalized results and improving our service. By using our platform, you agree that you do not retain ownership over any computed results, summaries, or analytics provided by the system.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">8. Changes to the Terms</h2>
              <p className="text-gray-600 mb-4">
                We may revise these Terms of Service from time to time. Updates will be posted on this page with a revised effective date. Your continued use of the service after such changes indicates your acceptance of the updated terms.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have any questions about these Terms, please contact us at:
                <br />
                <a href="mailto:support@taxenough.com" className="text-primary-600 hover:text-primary-800">support@taxenough.com</a>
              </p>
            </div>
          </div>
        </div>
      </div>
          </>
  );
} 