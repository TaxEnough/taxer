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
      id: 'price_1RIS0fLhWC2oNMWwizDKv78o', // Basic Monthly $19.99
      name: 'Basic Plan (Monthly)',
      price: 19.99,
      interval: 'month'
    },
    YEARLY: {
      id: 'price_1RIoHlLhWC2oNMWwKzOx9WBD', // Basic Yearly $199.99
      name: 'Basic Plan (Yearly)',
      price: 199.99,
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
      id: 'price_1RIoIVLhWC2oNMWwZZ7GOZhY', // Premium Monthly $29.99
      name: 'Premium Plan (Monthly)',
      price: 29.99,
      interval: 'month'
    },
    YEARLY: {
      id: 'price_1RIoJ3LhWC2oNMWwBpw1oZTl', // Premium Yearly $299.99
      name: 'Premium Plan (Yearly)',
      price: 299.99,
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