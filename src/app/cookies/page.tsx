import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function CookiesPage() {
  return (
    <>
      <Navbar />
      <div className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Cookie Policy</h1>
            
            <div className="prose prose-blue max-w-none">
              <p className="text-gray-600 mb-6">
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">About Cookies</h2>
              <p className="text-gray-600 mb-4">
                At TaxEnough, we place cookies on your browser when you visit our website. These cookies are used to provide you with a better user experience, analyze how our website is used, and ensure your security.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">What Are Cookies?</h2>
              <p className="text-gray-600 mb-4">
                Cookies are small text files that websites store on your computer or mobile device. They are managed by your browser and can contain certain information. This information helps us recognize you and remember your preferences when you visit our site again.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Types of Cookies We Use</h2>
              
              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">1. Essential Cookies</h3>
              <p className="text-gray-600 mb-4">
                These cookies are necessary for the proper functioning of our website and cannot be turned off in our systems.
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2"><strong>auth-token:</strong> Used to remember your login status. Duration is 7 days.</li>
              </ul>
              
              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-3">2. Analytics Cookies</h3>
              <p className="text-gray-600 mb-4">
                These cookies help us collect information about how visitors use our website. This helps us improve our website.
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2"><strong>Google Analytics cookies:</strong> Used to collect statistical data about how visitors use our website. These cookies do not identify visitors. Duration is typically for the session or up to 2 years.</li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">How You Can Control Cookies</h2>
              <p className="text-gray-600 mb-4">
                Most web browsers automatically accept cookies, but you can modify your browser settings to decline or block cookies if you prefer. If you disable cookies, you may not be able to use all features of our website.
              </p>
              <p className="text-gray-600 mb-4">
                Cookie management or deletion methods vary from browser to browser. To configure your browser's cookie settings, you can use your browser's "Help" menu or visit the following links:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2"><a href="https://support.google.com/chrome/answer/95647" className="text-primary-600 hover:text-primary-800" target="_blank" rel="noopener noreferrer">Google Chrome</a></li>
                <li className="mb-2"><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" className="text-primary-600 hover:text-primary-800" target="_blank" rel="noopener noreferrer">Mozilla Firefox</a></li>
                <li className="mb-2"><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" className="text-primary-600 hover:text-primary-800" target="_blank" rel="noopener noreferrer">Safari</a></li>
                <li className="mb-2"><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" className="text-primary-600 hover:text-primary-800" target="_blank" rel="noopener noreferrer">Microsoft Edge</a></li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Policy Changes</h2>
              <p className="text-gray-600 mb-4">
                We may update this Cookie Policy from time to time. We will take reasonable measures to inform you of significant changes to the policy, but we recommend that you regularly check this page.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have any questions, comments, or concerns about this Cookie Policy, please contact us through our <a href="/support" className="text-primary-600 hover:text-primary-800">support page</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 