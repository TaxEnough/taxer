import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { clerkClient } from '@clerk/nextjs/server';

// Stripe API client'ı oluştur
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature') as string;

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Stripe webhookunu doğrula
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
          throw new Error('Missing userId in session metadata');
        }

        // Get the subscription data from Stripe
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
        
        // Get the price ID to determine the plan type (basic or premium)
        const priceId = subscription.items.data[0].price.id;
        
        // Determine plan type based on the price ID
        let planType = 'premium'; // default to premium
        
        // You could determine plan based on price ID
        if (priceId === 'price_1RIS0fLhWC2oNMWwizDKv78o' || priceId === 'price_1RIoHlLhWC2oNMWwKzOx9WBD') {
          planType = 'basic';
        }
        
        // Update Clerk user metadata with subscription details
        await clerkClient.users.updateUser(userId, {
          privateMetadata: {
            subscription: {
              id: subscription.id,
              status: subscription.status,
              plan: planType,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
              priceId: priceId
            }
          }
        });
        
        console.log(`Subscription ${subscription.id} created for user ${userId}`);
        break;
      }
      
      case 'invoice.payment_succeeded': {
        // Update subscription record when payment is successful
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          
          // Find user with this subscription ID in metadata
          const users = await clerkClient.users.getUserList({
            privateMetadata: { 
              // This query checks if the subscription ID exists in the user's metadata
              'subscription.id': subscriptionId
            }
          });
          
          if (users.length > 0) {
            const userId = users[0].id;
            
            // Update the subscription metadata
            await clerkClient.users.updateUser(userId, {
              privateMetadata: {
                subscription: {
                  id: subscription.id,
                  status: subscription.status,
                  currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                }
              }
            });
            
            console.log(`Subscription ${subscriptionId} payment succeeded for user ${userId}`);
          } else {
            console.log(`No user found with subscription ID ${subscriptionId}`);
          }
        }
        
        break;
      }
      
      case 'customer.subscription.updated': {
        // Handle subscription status changes
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        
        // Find user with this subscription ID in metadata
        const users = await clerkClient.users.getUserList({
          privateMetadata: { 
            'subscription.id': subscriptionId
          }
        });
        
        if (users.length > 0) {
          const userId = users[0].id;
          
          // Update the subscription metadata
          await clerkClient.users.updateUser(userId, {
            privateMetadata: {
              subscription: {
                id: subscription.id,
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
              }
            }
          });
          
          console.log(`Subscription ${subscriptionId} updated for user ${userId}`);
        }
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        // Handle subscription cancellation
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        
        // Find user with this subscription ID in metadata
        const users = await clerkClient.users.getUserList({
          privateMetadata: { 
            'subscription.id': subscriptionId
          }
        });
        
        if (users.length > 0) {
          const userId = users[0].id;
          
          // Update the subscription metadata to show canceled status
          await clerkClient.users.updateUser(userId, {
            privateMetadata: {
              subscription: {
                id: subscription.id,
                status: 'canceled',
              }
            }
          });
          
          console.log(`Subscription ${subscriptionId} canceled for user ${userId}`);
        }
        
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
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