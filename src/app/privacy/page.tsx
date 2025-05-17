import Navbar from '@/components/Navbar';
export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <div className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
            
            <div className="prose prose-blue max-w-none">
              <p className="text-gray-600 mb-6">
                <strong>Effective Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              
              <p className="text-gray-600 mb-6">
                taxenough.com ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and store your personal information when you use our website and services.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">1. Information We Collect</h2>
              <p className="text-gray-600 mb-4">
                We collect:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2">Name</li>
                <li className="mb-2">Email address</li>
                <li className="mb-2">Usage data (such as page visits, time spent on site, and user interactions)</li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">2. How We Collect Information</h2>
              <p className="text-gray-600 mb-4">
                We collect data through:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2">Voluntary form submissions</li>
                <li className="mb-2">Automated tracking technologies (e.g., browser session data, analytics)</li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">3. Third-Party Access to Data</h2>
              <p className="text-gray-600 mb-4">
                We may share or allow access to your information with trusted third parties, strictly for operational purposes:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2"><strong>Google Analytics</strong> (to monitor and analyze site usage)</li>
                <li className="mb-2"><strong>Stripe</strong> (to securely process payments)</li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">4. Use of Information</h2>
              <p className="text-gray-600 mb-4">
                Your information is used for the following purposes:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2">To enable tax calculations and related features</li>
                <li className="mb-2">To improve the functionality and experience of our website</li>
                <li className="mb-2">To analyze user behavior and usage trends</li>
                <li className="mb-2">To communicate with users, when necessary</li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">5. Data Retention</h2>
              <p className="text-gray-600 mb-4">
                User data is stored for a period of up to two (2) years, depending on subscription type or usage activity.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">6. User Rights and Data Access</h2>
              <p className="text-gray-600 mb-4">
                Most user data can be accessed, modified, or updated directly through the user interface. For additional data-related requests, please contact us via email at support@taxenough.com.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">7. International Users</h2>
              <p className="text-gray-600 mb-4">
                While our services are primarily designed for users residing in the United States, we do accept international users. All collected information is stored securely in our databases, with measures to ensure data protection.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">8. Cookies</h2>
              <p className="text-gray-600 mb-4">
                Please refer to our <a href="/cookies" className="text-primary-600 hover:text-primary-800">Cookie Policy</a> for detailed information about how we use cookies on our site.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">9. Age Restriction</h2>
              <p className="text-gray-600 mb-4">
                Our services are only available to individuals who are 18 years of age or older.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Contact Us</h2>
              <p className="text-gray-600 mb-4">
                If you have any questions regarding this Privacy Policy, you may contact us at:
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