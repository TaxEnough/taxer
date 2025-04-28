'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SubscribeButton from '@/components/SubscribeButton';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

// Define the plan type to include optional upgradeMessage
type Plan = {
  name: string;
  description: string;
  price: number;
  features: string[];
  highlight: boolean;
  upgradeMessage?: string;
};

export default function Pricing() {
  const { user } = useAuth();
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated
  useEffect(() => {
    console.log("Auth state:", user);
    setIsAuthenticated(!!user);
    if (user) {
      checkSubscriptionStatus();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Fetch subscription status from Firestore
  const checkSubscriptionStatus = async () => {
    if (user && user.id) {
      try {
        const userRef = doc(db, 'users', user.id);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setSubscriptionStatus(userData.subscriptionStatus || null);
          setSubscriptionPlan(userData.subscriptionPlan || null);
        } else {
          setSubscriptionStatus(null);
          setSubscriptionPlan(null);
        }
      } catch (error) {
        console.error("Error checking subscription status:", error);
        setSubscriptionStatus(null);
        setSubscriptionPlan(null);
      } finally {
        setLoading(false);
      }
    }
  };

  // Get plans to display based on subscription status
  const getPlansToDisplay = (): Plan[] => {
    // If user has active basic subscription, only show premium plan
    if (subscriptionStatus === 'active' && subscriptionPlan === 'basic') {
      return [
        {
          name: "Premium",
          description: "Upgrade to Premium for enhanced features",
          price: billingCycle === 'monthly' ? 19.99 : 180,
          features: [
            "Everything in Basic plan",
            "Advanced tax optimization strategies",
            "Priority customer support",
            "Monthly tax analysis reports",
            "Integration with accounting software",
            "Access to exclusive tax resources"
          ],
          highlight: true,
          upgradeMessage: "Upgrade from your Basic plan for just $9.99 more per month"
        }
      ];
    }
    
    // If user has active premium subscription, show a message
    if (subscriptionStatus === 'active' && subscriptionPlan === 'premium') {
      return [];
    }
    
    // Default: show both plans for users without subscription
    return [
      {
        name: "Basic",
        description: "Perfect for individual investors",
        price: billingCycle === 'monthly' ? 10 : 100,
        features: [
          "Track up to 50 investments",
          "Basic tax calculation",
          "Annual tax report generation",
          "Email support",
          "Mobile app access",
          "Data export in CSV format"
        ],
        highlight: false
      },
      {
        name: "Premium",
        description: "Comprehensive solution for serious investors",
        price: billingCycle === 'monthly' ? 19.99 : 180,
        features: [
          "Everything in Basic plan",
          "Unlimited investment tracking",
          "Advanced tax optimization strategies",
          "Priority customer support",
          "Monthly tax analysis reports",
          "Integration with accounting software",
          "Access to exclusive tax resources"
        ],
        highlight: true
      }
    ];
  };

  // Function to render the appropriate action button
  const renderActionButton = (plan: Plan) => {
    if (!isAuthenticated) {
      return (
        <button
          onClick={() => router.push('/register')}
          className="block w-full bg-primary-600 text-white text-center py-2 px-4 rounded-lg hover:bg-primary-700 transition duration-150 ease-in-out mt-4"
        >
          Sign Up
        </button>
      );
    }

    // If user has an active subscription
    if (subscriptionStatus === 'active') {
      // For premium user viewing premium plan (should never happen with current logic)
      if (subscriptionPlan === 'premium' && plan.name === 'Premium') {
        return (
          <div className="block w-full bg-gray-200 text-gray-700 text-center py-2 px-4 rounded-lg mt-4">
            Current Plan
          </div>
        );
      }
      
      // For basic user viewing premium plan
      if (subscriptionPlan === 'basic' && plan.name === 'Premium') {
        return (
          <SubscribeButton
            priceId={billingCycle === 'monthly' ? 'price_premium_monthly' : 'price_premium_yearly'}
            className="block w-full bg-primary-600 text-white text-center py-2 px-4 rounded-lg hover:bg-primary-700 transition duration-150 ease-in-out mt-4"
          >
            Upgrade Now
          </SubscribeButton>
        );
      }
    }

    // Default subscription button
    return (
      <SubscribeButton
        priceId={
          plan.name === 'Basic' 
            ? (billingCycle === 'monthly' ? 'price_basic_monthly' : 'price_basic_yearly')
            : (billingCycle === 'monthly' ? 'price_premium_monthly' : 'price_premium_yearly')
        }
        className="block w-full bg-primary-600 text-white text-center py-2 px-4 rounded-lg hover:bg-primary-700 transition duration-150 ease-in-out mt-4"
      >
        Subscribe Now
      </SubscribeButton>
    );
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex justify-center items-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
            {subscriptionStatus === 'active' && subscriptionPlan === 'premium'
              ? "You're on the Premium Plan"
              : subscriptionStatus === 'active' && subscriptionPlan === 'basic'
              ? "Upgrade to Premium"
              : "Simple, Transparent Pricing"}
          </h1>
          <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
            {subscriptionStatus === 'active' && subscriptionPlan === 'premium'
              ? "You're already enjoying all of our premium features. Thank you for your support!"
              : subscriptionStatus === 'active' && subscriptionPlan === 'basic'
              ? "Enhance your tax management experience with our Premium plan"
              : "Choose the plan that's right for you"}
          </p>
        </div>

        {/* Premium plan message for premium subscribers */}
        {subscriptionStatus === 'active' && subscriptionPlan === 'premium' && (
          <div className="mt-12 max-w-md mx-auto bg-gray-50 rounded-lg shadow-lg overflow-hidden md:max-w-2xl">
            <div className="md:flex">
              <div className="p-8">
                <div className="uppercase tracking-wide text-sm text-primary-600 font-semibold">Premium Plan</div>
                <p className="mt-2 text-gray-500">
                  You're currently subscribed to our Premium plan with full access to all features.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-start">
                    <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-2 text-gray-700">Unlimited investment tracking</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-2 text-gray-700">Advanced tax optimization strategies</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-2 text-gray-700">Priority customer support</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-2 text-gray-700">Monthly tax analysis reports</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-2 text-gray-700">Integration with accounting software</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="ml-2 text-gray-700">Access to exclusive tax resources</span>
                  </li>
                </ul>
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/profile')}
                    className="block w-full bg-primary-600 text-white text-center py-2 px-4 rounded-lg hover:bg-primary-700 transition duration-150 ease-in-out"
                  >
                    Manage Subscription
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing cycle toggle */}
        {(subscriptionStatus !== 'active' || subscriptionPlan === 'basic') && (
          <div className="mt-12 sm:mt-16 mb-8 flex justify-center">
            <div className="relative bg-gray-100 p-0.5 rounded-lg flex">
              <button
                type="button"
                className={`${
                  billingCycle === 'monthly' ? 'bg-white shadow-sm' : 'bg-transparent'
                } relative py-2 px-6 rounded-md text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-500 focus:z-10`}
                onClick={() => setBillingCycle('monthly')}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                className={`${
                  billingCycle === 'yearly' ? 'bg-white shadow-sm' : 'bg-transparent'
                } ml-0.5 relative py-2 px-6 rounded-md text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-500 focus:z-10`}
                onClick={() => setBillingCycle('yearly')}
              >
                Annual Billing
              </button>
            </div>
          </div>
        )}

        {/* Display discount message for yearly billing */}
        {billingCycle === 'yearly' && (subscriptionStatus !== 'active' || subscriptionPlan === 'basic') && (
          <div className="text-center mb-12">
            <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Save up to 20% with annual billing
            </span>
          </div>
        )}

        {/* Pricing plans */}
        {(subscriptionStatus !== 'active' || subscriptionPlan === 'basic') && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-8">
            {getPlansToDisplay().map((plan) => (
              <div
                key={plan.name}
                className={`
                  border rounded-lg shadow-sm divide-y divide-gray-200 overflow-hidden
                  ${plan.highlight ? 'border-primary-500 relative' : 'border-gray-200'}
                `}
              >
                {plan.highlight && (
                  <div className="absolute top-0 inset-x-0 transform translate-y-px">
                    <div className="flex justify-center transform -translate-y-1/2">
                      <span className="inline-flex rounded-full bg-primary-500 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                        Most Popular
                      </span>
                    </div>
                  </div>
                )}
                <div className="p-6">
                  <h2 className="text-xl font-medium text-gray-900">{plan.name}</h2>
                  <p className="mt-2 text-sm text-gray-500">{plan.description}</p>
                  <p className="mt-4">
                    <span className="text-4xl font-extrabold text-gray-900">${plan.price}</span>
                    <span className="text-base font-medium text-gray-500">
                      /{billingCycle === 'monthly' ? 'mo' : 'year'}
                    </span>
                  </p>

                  {/* Special upgrade message for basic subscribers viewing Premium */}
                  {plan.upgradeMessage && (
                    <div className="mt-4 bg-green-50 px-3 py-2 rounded-md">
                      <p className="text-sm text-green-700">{plan.upgradeMessage}</p>
                    </div>
                  )}
                  
                  {renderActionButton(plan)}
                </div>
                <div className="pt-6 pb-8 px-6">
                  <h3 className="text-sm font-medium text-gray-900">What's included</h3>
                  <ul className="mt-4 space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <svg className="flex-shrink-0 h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="ml-2 text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FAQ Section - conditional based on subscription status */}
        <div className="mt-16 border-t border-gray-200 pt-12">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Frequently Asked Questions
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {subscriptionStatus === 'active' 
                  ? "How can I cancel my subscription?" 
                  : "Can I cancel my subscription at any time?"}
              </h3>
              <p className="mt-2 text-base text-gray-500">
                {subscriptionStatus === 'active' 
                  ? "You can cancel your subscription anytime from your profile page. Your subscription will remain active until the end of your current billing period." 
                  : "Yes, you can cancel your subscription at any time. Once canceled, your subscription will remain active until the end of your current billing period."}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {subscriptionStatus === 'active' && subscriptionPlan === 'basic'
                  ? "How do I upgrade to Premium?"
                  : subscriptionStatus === 'active' && subscriptionPlan === 'premium'
                  ? "Can I downgrade to Basic?"
                  : "Is there a free trial available?"}
              </h3>
              <p className="mt-2 text-base text-gray-500">
                {subscriptionStatus === 'active' && subscriptionPlan === 'basic'
                  ? "You can upgrade to our Premium plan at any time. Your account will be upgraded immediately, and you'll be charged the prorated difference for the remainder of your billing period."
                  : subscriptionStatus === 'active' && subscriptionPlan === 'premium'
                  ? "Yes, you can downgrade to our Basic plan. The change will take effect at the end of your current billing cycle."
                  : "We don't currently offer a free trial, but we do have a 30-day money-back guarantee if you're not satisfied with our service."}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {subscriptionStatus === 'active'
                  ? "Will I get a refund if I cancel mid-cycle?"
                  : "What payment methods do you accept?"}
              </h3>
              <p className="mt-2 text-base text-gray-500">
                {subscriptionStatus === 'active'
                  ? "We don't provide refunds for partial billing periods. Your subscription will remain active until the end of your current billing cycle."
                  : "We accept all major credit cards including Visa, Mastercard, American Express, and Discover. We also support payment through PayPal."}
              </p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {subscriptionStatus === 'active' && subscriptionPlan === 'basic'
                  ? "What additional features do I get with Premium?"
                  : "How secure is my payment information?"}
              </h3>
              <p className="mt-2 text-base text-gray-500">
                {subscriptionStatus === 'active' && subscriptionPlan === 'basic'
                  ? "Premium includes unlimited investment tracking, advanced tax optimization strategies, priority support, monthly analysis reports, accounting software integration, and exclusive tax resources."
                  : "Very secure! We use Stripe for payment processing, which is PCI compliant and uses industry-leading encryption and security measures."}
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
} 