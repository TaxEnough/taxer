import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
          throw new Error('Missing userId in session metadata');
        }

        // Get the subscription data from Stripe
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
        
        // Store subscription data in Firestore
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          // Create a subscription record
          await setDoc(doc(db, 'subscriptions', subscription.id), {
            userId,
            status: subscription.status,
            priceId: subscription.items.data[0].price.id,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          
          // Update user with subscription info
          await updateDoc(userRef, {
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            subscriptionPriceId: subscription.items.data[0].price.id,
            updatedAt: serverTimestamp(),
          });
          
          console.log(`Subscription ${subscription.id} created for user ${userId}`);
        } else {
          console.error(`User ${userId} not found`);
        }
        
        break;
      }
      
      case 'invoice.payment_succeeded': {
        // Update subscription record when payment is successful
        const invoice = event.data.object as any; // Use any to bypass type checking
        const subscriptionId = invoice.subscription as string;
        
        if (subscriptionId) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          
          // Update the subscription record
          await updateDoc(doc(db, 'subscriptions', subscriptionId), {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            updatedAt: serverTimestamp(),
          });
          
          console.log(`Subscription ${subscriptionId} payment succeeded`);
        }
        
        break;
      }
      
      case 'customer.subscription.updated': {
        // Handle subscription status changes
        const subscription = event.data.object as any; // Use any to bypass type checking
        
        // Find the user with this subscription
        const subscriptionRef = doc(db, 'subscriptions', subscription.id);
        const subscriptionDoc = await getDoc(subscriptionRef);
        
        if (subscriptionDoc.exists()) {
          const { userId } = subscriptionDoc.data() as { userId: string };
          
          // Update subscription record
          await updateDoc(subscriptionRef, {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            updatedAt: serverTimestamp(),
          });
          
          // Update user subscription status
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, {
            subscriptionStatus: subscription.status,
            updatedAt: serverTimestamp(),
          });
          
          console.log(`Subscription ${subscription.id} updated for user ${userId}`);
        }
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        // Handle subscription cancellation
        const subscription = event.data.object as any;
        
        // Find the user with this subscription
        const subscriptionRef = doc(db, 'subscriptions', subscription.id);
        const subscriptionDoc = await getDoc(subscriptionRef);
        
        if (subscriptionDoc.exists()) {
          const { userId } = subscriptionDoc.data() as { userId: string };
          
          // Update subscription record
          await updateDoc(subscriptionRef, {
            status: 'canceled',
            updatedAt: serverTimestamp(),
          });
          
          // Update user subscription status
          const userRef = doc(db, 'users', userId);
          await updateDoc(userRef, {
            subscriptionStatus: 'canceled',
            updatedAt: serverTimestamp(),
          });
          
          console.log(`Subscription ${subscription.id} canceled for user ${userId}`);
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