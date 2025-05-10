import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
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

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
});

export async function POST(req: Request) {
  try {
    // Get authenticated user from Clerk
    const session = await auth();
    const user = await currentUser();
    
    if (!session || !session.userId) {
      console.error('User not authenticated');
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Get request data
    const { priceId, successUrl, cancelUrl } = await req.json();
    console.log('Checkout request data:', { priceId, successUrl, cancelUrl });

    // Validate priceId
    if (!priceId) {
      console.error('Missing priceId');
      return NextResponse.json(
        { error: 'Missing priceId' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get all valid price IDs from the PRICES configuration
    const validPriceIds = [
      PRICES.BASIC.MONTHLY.id,
      PRICES.BASIC.YEARLY.id,
      PRICES.PREMIUM.MONTHLY.id,
      PRICES.PREMIUM.YEARLY.id,
    ];

    if (!validPriceIds.includes(priceId)) {
      console.error('Invalid price ID:', priceId);
      console.log('Valid price IDs:', validPriceIds);
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Get user email from Clerk
    const userEmail = user?.emailAddresses[0]?.emailAddress;
    
    // If email not found, create a fallback email
    const customerEmail = userEmail || `user+${session.userId}@example.com`;
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
        success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/profile?tab=subscription&status=success`,
        cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?status=cancelled`,
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