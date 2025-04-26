import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function RefundPage() {
  return (
    <>
      <Navbar />
      <div className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Refund Policy</h1>
            
            <div className="prose prose-blue max-w-none">
              <p className="text-gray-600 mb-6">
                <strong>Effective Date:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              
              <p className="text-gray-600 mb-6">
                At taxenough.com, we are committed to providing helpful and easy-to-use tax estimation tools. Please read our refund policy carefully before making a purchase.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">1. All Payments Are Final</h2>
              <p className="text-gray-600 mb-4">
                Due to the digital nature of our services, <strong>all subscription fees are non-refundable once access has been granted</strong>. When a user subscribes, they receive immediate access to our proprietary tools and resources.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">2. No Refunds for Partial Use or Change of Mind</h2>
              <p className="text-gray-600 mb-4">
                We do not offer refunds for:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2">Partial use of the service</li>
                <li className="mb-2">Change of mind after subscribing</li>
                <li className="mb-2">Forgetting to cancel the subscription</li>
              </ul>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">3. Exceptions (Limited Eligibility)</h2>
              <p className="text-gray-600 mb-4">
                Refunds may only be considered under the following conditions:
              </p>
              <ul className="list-disc pl-5 text-gray-600 mb-6">
                <li className="mb-2"><strong>Duplicate payment</strong> or accidental charge</li>
                <li className="mb-2"><strong>Technical issue</strong> that prevents access to the service, verified by our support team</li>
                <li className="mb-2"><strong>Fraudulent transaction</strong> not initiated by the user</li>
              </ul>
              <p className="text-gray-600 mb-4">
                All such refund requests must be submitted within <strong>7 days</strong> of the original transaction date.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">4. How to Request a Refund</h2>
              <p className="text-gray-600 mb-4">
                To request a refund under the above exceptions, users must contact our support team at: <a href="mailto:support@taxenough.com" className="text-primary-600 hover:text-primary-800">support@taxenough.com</a>
              </p>
              <p className="text-gray-600 mb-4">
                Please include your account email, transaction ID, and a brief description of the issue.
              </p>
              
              <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">5. Subscription Cancellation</h2>
              <p className="text-gray-600 mb-4">
                Users can cancel their subscription at any time from their account settings. The cancellation will prevent the next billing cycle but will <strong>not result in a refund</strong> for the current or past billing periods.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
} 