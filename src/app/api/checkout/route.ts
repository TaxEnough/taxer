import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { PRICES } from '@/lib/stripe';
import { getAuthCookieFromRequest, verifyToken } from '@/lib/auth-server';

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

export async function POST(req: Request) {
  try {
    // Add CORS headers to response
    const response = NextResponse;

    // Get the request body
    const body = await req.json();
    const { priceId, successUrl, cancelUrl } = body;

    // Get auth token and verify it
    const token = await getAuthCookieFromRequest(req);
    
    if (!token) {
      return response.json(
        { error: 'You must be logged in to create a checkout session' },
        { status: 401, headers: corsHeaders }
      );
    }
    
    const session = await verifyToken(token);
    
    if (!session) {
      return response.json(
        { error: 'Invalid authentication token' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Validate price ID
    if (!priceId || (priceId !== PRICES.BASIC.id && priceId !== PRICES.PREMIUM.id)) {
      return response.json(
        { error: 'Invalid price ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user from Firebase or other storage using session.userId
    // For now, we'll use a simplified approach
    const userEmail = session.userId; // In a real app, you would fetch the user's email

    // Create Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: userEmail,
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

    return response.json({ url: checkoutSession.url }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500, headers: corsHeaders }
    );
  }
} 