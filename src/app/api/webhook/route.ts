import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { updateUserSubscription } from '@/lib/clerkStripeIntegration';

// Debug loglama fonksiyonu
function logInfo(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] WEBHOOK INFO: ${message}`);
  if (data) {
    try {
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Veri loglanamadı:', e);
    }
  }
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error(`Webhook Error: ${error.message}`);
    return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
  }

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Extract user ID from metadata
        const userId = session.metadata?.userId;
        if (!userId) {
          console.error('Missing userId in session metadata');
          return NextResponse.json(
            { error: 'Missing userId in session metadata' },
            { status: 400 }
          );
        }

        logInfo('Checkout session completed', { 
          sessionId: session.id,
          userId,
          customerEmail: session.customer_email
        });

        // Get the subscription data from Stripe
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
        
        // Plan tipini belirle
        const priceId = subscription.items.data[0]?.price?.id;
        const planType = determinePlanType(priceId);
        
        // Clerk metadata'sına kaydet
        const updateResult = await updateUserSubscription(userId, {
          status: 'active',
          plan: planType,
          id: subscription.id,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        });
        
        if (updateResult) {
          logInfo(`Subscription ${subscription.id} created for user ${userId} and saved to Clerk metadata`);
        } else {
          console.error(`Failed to update Clerk metadata for user ${userId}`);
        }
        
        break;
      }
      
      case 'invoice.payment_succeeded': {
        // Update subscription record when payment is successful
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription as string;
        const customerId = invoice.customer as string;
        
        if (subscriptionId) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          
          // Metadata'dan userId'yi al
          const userId = subscription.metadata?.userId;
          
          if (userId) {
            // Plan tipini belirle
            const priceId = subscription.items.data[0]?.price?.id;
            const planType = determinePlanType(priceId);
            
            // Clerk metadata'sını güncelle
            const updateResult = await updateUserSubscription(userId, {
              status: 'active',
              plan: planType,
              id: subscription.id,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000)
            });
            
            if (updateResult) {
              logInfo(`Subscription ${subscriptionId} payment succeeded and Clerk metadata updated for user ${userId}`);
            } else {
              console.error(`Failed to update Clerk metadata for user ${userId}`);
            }
          } else {
            console.error(`UserId not found in subscription metadata for subscription ${subscriptionId}`);
          }
        }
        
        break;
      }
      
      case 'customer.subscription.updated': {
        // Handle subscription status changes
        const subscription = event.data.object as any;
        
        // Metadata'dan userId'yi al
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          // Plan tipini belirle
          const priceId = subscription.items.data[0]?.price?.id;
          const planType = determinePlanType(priceId);
          
          // Clerk metadata'sını güncelle
          const updateResult = await updateUserSubscription(userId, {
            status: subscription.status,
            plan: planType,
            id: subscription.id,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000)
          });
          
          if (updateResult) {
            logInfo(`Subscription ${subscription.id} updated and Clerk metadata updated for user ${userId}`);
          } else {
            console.error(`Failed to update Clerk metadata for user ${userId}`);
          }
        } else {
          console.error(`UserId not found in subscription metadata for subscription ${subscription.id}`);
        }
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        // Handle subscription cancellation
        const subscription = event.data.object as any;
        
        // Metadata'dan userId'yi al
        const userId = subscription.metadata?.userId;
        
        if (userId) {
          // Clerk metadata'sını güncelle - aboneliği iptal olarak işaretle
          const updateResult = await updateUserSubscription(userId, {
            status: 'canceled',
            plan: 'free',
            id: subscription.id,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000)
          });
          
          if (updateResult) {
            logInfo(`Subscription ${subscription.id} canceled and Clerk metadata updated for user ${userId}`);
          } else {
            console.error(`Failed to update Clerk metadata for user ${userId}`);
          }
        } else {
          console.error(`UserId not found in subscription metadata for subscription ${subscription.id}`);
        }
        
        break;
      }
      
      default:
        logInfo(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}

// Fiyat ID'sine göre plan tipini belirle
function determinePlanType(priceId: string): 'basic' | 'premium' | 'free' {
  // Burada fiyat ID'lerini kontrol edip uygun plan tipini döndür
  // Örnek kontrol (gerçek price ID'lerinize göre güncellenmeli)
  const premiumPriceIds = [
    'price_1RIoIVLhWC2oNMWwZZ7GOZhY', // Premium Monthly
    'price_1RIoJ3LhWC2oNMWwBpw1oZTl'  // Premium Yearly
  ];
  
  const basicPriceIds = [
    'price_1RIS0fLhWC2oNMWwizDKv78o', // Basic Monthly
    'price_1RIoHlLhWC2oNMWwKzOx9WBD'  // Basic Yearly
  ];
  
  if (premiumPriceIds.includes(priceId)) {
    return 'premium';
  } else if (basicPriceIds.includes(priceId)) {
    return 'basic';
  }
  
  return 'free';
} 