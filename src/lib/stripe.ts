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
    id: 'price_1RIS0fLhWC2oNMWwizDKv78o',
    name: 'Basic Plan',
    price: 19.99,
    features: [
      'Basic tax calculations',
      'Tax estimate reports',
      'Annual tax summary',
      'Email support'
    ]
  },
  PREMIUM: {
    id: 'premium_price_id_here', // Replace with your premium price ID when needed
    name: 'Premium Plan',
    price: 29.99,
    features: [
      'Everything in Basic',
      'Faster support response',
      'Reminder setup options',
      'Priority email support',
      'Multi-portfolio management'
    ]
  }
}; 