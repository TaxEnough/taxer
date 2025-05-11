import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, currentUser } from '@clerk/nextjs/server';
import { PRICES } from '@/lib/stripe';

// Debug logging function
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] PAYMENT DEBUG: ${message}`);
  if (data) {
    try {
      if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(data);
      }
    } catch (e) {
      console.log('Could not log data:', e);
    }
  }
}

// Error logging function
function errorLog(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] PAYMENT ERROR: ${message}`);
  if (error) {
    if (error instanceof Error) {
      console.error(`Error type: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
    } else {
      console.error(error);
    }
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Content-Type': 'application/json'
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new Response(null, { 
    status: 204, // No content
    headers: corsHeaders
  });
}

// GET method for checkout endpoint
export async function GET(req: NextRequest) {
  try {
    debugLog('GET request received', { url: req.url });
    
    // Get authenticated user from Clerk
    const session = await auth();
    const user = await currentUser();
    
    // Get URL search parameters
    const searchParams = req.nextUrl.searchParams;
    const priceId = searchParams.get('priceId');
    const successUrl = searchParams.get('successUrl');
    const cancelUrl = searchParams.get('cancelUrl');
    const requestEmail = searchParams.get('email');
    
    debugLog('URL parameters received', { priceId, successUrl, cancelUrl, requestEmail });
    
    // Get user ID first from session, then manually
    let userId = session?.userId;
    let userEmail = '';

    if (!userId) {
      debugLog('No user ID found via Clerk session, trying alternative methods');
      
      // Try to get user email from Clerk
      if (user) {
        const primaryEmailAddress = user.emailAddresses?.find(email => email.id === user.primaryEmailAddressId);
        userEmail = primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '';
        
        if (userEmail) {
          debugLog(`Email found: ${userEmail}, creating payment page`);
        } else {
          debugLog('User email not found');
        }
      }
      
      // Get email from request if not found from Clerk
      if (!userEmail) {
        userEmail = requestEmail || '';
        if (userEmail) {
          debugLog(`Email found from URL parameter: ${userEmail}`);
        }
      }

      // If still no email and authentication failed, return error
      if (!userEmail) {
        errorLog('User ID or email not found', { session });
        return NextResponse.json(
          { error: 'Please log in or provide your email' },
          { status: 401, headers: corsHeaders }
        );
      }
    } else {
      // Get user info and extract email
      const primaryEmailAddress = user?.emailAddresses?.find(email => email.id === user.primaryEmailAddressId);
      userEmail = primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
    }

    debugLog('Information for processing:', {
      userId: userId || 'N/A',
      email: userEmail,
      username: user?.username || 'N/A',
      fullName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'N/A'
    });
    
    debugLog('Checkout request data:', { priceId, successUrl, cancelUrl, userId, userEmail });

    // Check priceId
    if (!priceId) {
      errorLog('Missing priceId');
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate price IDs
    const validPriceIds = [
      PRICES.BASIC.MONTHLY.id,
      PRICES.BASIC.YEARLY.id,
      PRICES.PREMIUM.MONTHLY.id,
      PRICES.PREMIUM.YEARLY.id
    ];

    debugLog('Validating price ID', { 
      providedPriceId: priceId, 
      validPriceIds, 
      isValid: validPriceIds.includes(priceId) 
    });

    if (!validPriceIds.includes(priceId)) {
      errorLog('Invalid price ID:', { priceId, validPriceIds });
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      // Create Stripe payment session
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-03-31.basil'
      });
      
      // Prepare user metadata
      const userMetadata = {
        userId: userId || '',
        email: userEmail,
        username: user?.username || '',
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : ''
      };
      
      debugLog('User metadata prepared for Stripe:', userMetadata);
      
      // Create checkout session
      const checkoutSession = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/profile?tab=subscription&status=success&userId=${userId || ''}&email=${encodeURIComponent(userEmail)}`,
        cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?status=cancelled`,
        metadata: userMetadata,
        subscription_data: {
          metadata: userMetadata,
        },
        allow_promotion_codes: true,
      });
      
      debugLog('Payment session created:', { 
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        metadata: checkoutSession.metadata
      });

      // Return JSON response with proper headers
      return new Response(
        JSON.stringify({ 
          url: checkoutSession.url,
          sessionId: checkoutSession.id,
          email: userEmail,
          success: true,
          message: "Payment page created. After successful payment, a 7-day trial period will begin."
        }),
        { 
          status: 200,
          headers: corsHeaders
        }
      );
    } catch (stripeError: any) {
      errorLog('Stripe error:', stripeError);
      return new Response(
        JSON.stringify({ error: `Stripe error: ${stripeError.message}` }),
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }
  } catch (error: any) {
    errorLog('Error creating payment session:', error);
    return new Response(
      JSON.stringify({ error: `Something went wrong: ${error.message}` }),
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
} 