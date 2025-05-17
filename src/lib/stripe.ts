import { loadStripe, Stripe } from '@stripe/stripe-js';

// Load the Stripe.js
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Pricing configuration
export const PRICES = {
  BASIC: {
    MONTHLY: {
      id: 'price_1RPuH1LhWC2oNMWwQMSfyDP0', // Basic Monthly $19.99
      name: 'Basic Plan (Monthly)',
      price: 19.99,
      interval: 'month'
    },
    YEARLY: {
      id: 'price_1RPuIfLhWC2oNMWwjz4QUn0N', // Basic Yearly $120
      name: 'Basic Plan (Yearly)',
      price: 120,
      interval: 'year'
    },
    features: [
      'Basic tax calculations',
      'Tax estimate reports',
      'Annual tax summary',
      'Email support'
    ]
  },
  PREMIUM: {
    MONTHLY: {
      id: 'price_1RPuI9LhWC2oNMWwYQKvG2Ry', // Premium Monthly $29.99
      name: 'Premium Plan (Monthly)',
      price: 29.99,
      interval: 'month'
    },
    YEARLY: {
      id: 'price_1RPuIxLhWC2oNMWwA9xLh4ko', // Premium Yearly $180
      name: 'Premium Plan (Yearly)',
      price: 180,
      interval: 'year'
    },
    features: [
      'Everything in Basic',
      'Faster support response',
      'Reminder setup options',
      'Priority email support',
      'Multi-portfolio management'
    ]
  }
}; 