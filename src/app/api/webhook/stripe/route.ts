import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

// Stripe API client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
});

// Debug loglama fonksiyonu
function logInfo(message: string, data?: any) {
  console.log(`WEBHOOK INFO: ${message}`);
  if (data) {
    try {
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('Veri loglanamadı:', e);
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = headers().get('stripe-signature') as string;
    
    if (!signature) {
      console.error('Stripe signature missing');
      return NextResponse.json({ error: 'Stripe signature required' }, { status: 400 });
    }
    
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET environment variable missing');
      return NextResponse.json({ error: 'Webhook secret missing' }, { status: 500 });
    }

    // Gerçekten webhook'u doğrula
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error(`Webhook error: ${err.message}`);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Olayı logla
    logInfo(`Event received: ${event.type}`);
    
    // Burada olay işlemeyi yapacağız, ama şimdilik sadece başarılı olduğunu söyleyelim
    return NextResponse.json({ received: true, type: event.type });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return NextResponse.json(
      { error: `Webhook error: ${err.message}` },
      { status: 500 }
    );
  }
} 