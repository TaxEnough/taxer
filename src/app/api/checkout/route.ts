import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PRICES } from '@/lib/stripe';
import { getAuthCookieFromRequest, verifyToken } from '@/lib/auth-server';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// CORS headers for Vercel
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token',
};

// Handle OPTIONS request (preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Get user's email from Firestore
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    console.log('Fetching user email from Firestore for userId:', userId);
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log('User document found:', userData.email ? 'Email exists' : 'No email');
      return userData.email || null;
    }
    
    console.log('User document not found');
    return null;
  } catch (error) {
    console.error('Error fetching user email:', error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    console.log('Checkout API endpoint called');
    
    // Get the request body
    const body = await req.json();
    const { priceId, successUrl, cancelUrl } = body;
    
    console.log('Request body:', { priceId, successUrl, cancelUrl });

    // Validate price ID immediately
    if (!priceId) {
      console.error('Missing price ID');
      return NextResponse.json(
        { error: 'Missing price ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get auth token and verify it
    const token = await getAuthCookieFromRequest(req);
    
    if (!token) {
      console.error('No auth token found in request');
      return NextResponse.json(
        { error: 'You must be logged in to create a checkout session' },
        { status: 401, headers: corsHeaders }
      );
    }
    
    console.log('Auth token found, verifying...');
    const session = await verifyToken(token);
    
    if (!session) {
      console.error('Invalid or expired auth token');
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401, headers: corsHeaders }
      );
    }
    
    console.log('User authenticated:', session.userId);

    // Validate Stripe Secret Key
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY is not defined');
      return NextResponse.json(
        { error: 'Stripe configuration is missing' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized');

    // Validate price ID against our defined prices
    const validPriceIds = [
      PRICES.BASIC.MONTHLY.id,
      PRICES.BASIC.YEARLY.id,
      PRICES.PREMIUM.MONTHLY.id,
      PRICES.PREMIUM.YEARLY.id
    ];

    if (!validPriceIds.includes(priceId)) {
      console.error('Invalid price ID:', priceId);
      console.log('Valid price IDs:', validPriceIds);
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user's email from Firestore
    const userEmail = await getUserEmail(session.userId);
    
    // If email not found, create a fallback email
    const customerEmail = userEmail || `user+${session.userId}@taxenough.com`;
    console.log('Using email for checkout:', customerEmail);

    try {
      // Create Checkout Session
      const checkoutSession = await stripe.checkout.sessions.create({
        customer_email: customerEmail,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`,
        cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?subscription=cancelled`,
        metadata: {
          userId: session.userId,
        },
      });
      
      console.log('Checkout session created:', checkoutSession.id);
      console.log('Checkout URL:', checkoutSession.url);

      return NextResponse.json({ url: checkoutSession.url }, { headers: corsHeaders });
    } catch (stripeError: any) {
      console.error('Stripe error:', stripeError.message);
      return NextResponse.json(
        { error: `Stripe error: ${stripeError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    console.error('Error details:', error.message);
    return NextResponse.json(
      { error: `Something went wrong: ${error.message}` },
      { status: 500, headers: corsHeaders }
    );
  }
} 