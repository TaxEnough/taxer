'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused' | null;
type PlanType = 'basic' | 'premium' | 'free';

interface SubscriptionData {
  status: SubscriptionStatus;
  planType: PlanType;
  currentPeriodEnd?: Date;
  formattedEndDate?: string;
}

export default function SubscriptionInfo() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!isLoaded || !user) return;

      try {
        // Kullanıcının meta verilerinden abonelik bilgilerini al
        // any tipini kullanmak zorundayız çünkü Clerk tiplerindeki privateMetadata'yı
        // doğrudan erişemiyoruz
        const subData = (user as any).privateMetadata?.subscription || 
                        (user as any).publicMetadata?.subscription;
        
        if (subData && subData.status === 'active') {
          let endDate = '';
          if (subData.currentPeriodEnd) {
            const date = new Date(subData.currentPeriodEnd);
            endDate = date.toLocaleDateString('en-US', {
              year: 'numeric', 
              month: 'long', 
              day: 'numeric'
            });
          }
          
          setSubscription({
            status: 'active',
            planType: subData.plan || 'premium',
            currentPeriodEnd: subData.currentPeriodEnd ? new Date(subData.currentPeriodEnd) : undefined,
            formattedEndDate: endDate
          });
        } else {
          setSubscription({
            status: subData?.status || null,
            planType: 'free',
          });
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setSubscription({
          status: null,
          planType: 'free'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user, isLoaded]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const getPlanBadgeColor = (planType: PlanType) => {
    switch (planType) {
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      case 'basic':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getFeatures = (planType: PlanType) => {
    if (planType === 'premium') {
      return [
        'Everything in Basic',
        'Faster support response',
        'Reminder setup options',
        'Priority email support',
        'Multi-portfolio management'
      ];
    } else if (planType === 'basic') {
      return [
        'Basic tax calculations',
        'Tax estimate reports',
        'Annual tax summary',
        'Email support'
      ];
    } else {
      return [
        'Limited tax calculations',
        'Basic profile management'
      ];
    }
  };

  return (
    <div>
      <div className="bg-gray-50 p-6 rounded-lg mb-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Current Plan</dt>
            <dd className="mt-1">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPlanBadgeColor(subscription?.planType || 'free')}`}>
                {subscription?.planType === 'premium'
                  ? 'Premium Plan'
                  : subscription?.planType === 'basic'
                  ? 'Basic Plan'
                  : 'Free Plan'}
              </span>
            </dd>
          </div>
          
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 text-sm">
              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                subscription?.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {subscription?.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
          
          {subscription?.status === 'active' && subscription.formattedEndDate && (
            <div className="sm:col-span-1">
              <dt className="text-sm font-medium text-gray-500">Renewal Date</dt>
              <dd className="mt-1 text-sm text-gray-900">{subscription.formattedEndDate}</dd>
            </div>
          )}
        </dl>
      </div>
      
      {/* Plan Features */}
      <div className="mb-6">
        <h3 className="text-md font-medium mb-4">Plan Features</h3>
        <ul className="space-y-2">
          {getFeatures(subscription?.planType || 'free').map((feature, index) => (
            <li key={index} className="flex items-start">
              <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Action Buttons */}
      {subscription?.status === 'active' ? (
        <div className="flex space-x-4">
          <button 
            onClick={() => router.push('/pricing')}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Change Plan
          </button>
          <button 
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            onClick={() => window.open('https://dashboard.stripe.com/billing/portal', '_blank')}
          >
            Manage Billing
          </button>
        </div>
      ) : (
        <div>
          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">Upgrade to Premium Features!</h3>
            <p className="text-sm text-gray-700 mb-4">
              Enhance your investment tracking experience with our premium plans. Unlock advanced features and tools.
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm font-semibold text-gray-900">Starting at just $19.99/month</span>
                <span className="ml-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Save 20% yearly</span>
              </div>
              <button 
                onClick={() => router.push('/pricing')}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                View Plans
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 