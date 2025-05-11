import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { clerkClient } from '@clerk/nextjs/server';

// TypeScript türleri
type SubscriptionUserMetadata = {
  subscription?: {
    id: string;
    status: string;
    plan: string;
    currentPeriodEnd?: string;
    priceId?: string;
  }
};

type ClerkUser = {
  id: string;
  privateMetadata: SubscriptionUserMetadata;
  publicMetadata: SubscriptionUserMetadata;
};

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
    // Event tipine göre işlem yap
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Kullanıcı ID'sini metadata'dan al
        const userId = session.metadata?.userId;
        if (!userId) {
          throw new Error('Missing userId in session metadata');
        }

        // Stripe'dan abonelik bilgilerini al
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
        
        // Planı belirlemek için price ID'yi al
        const priceId = subscription.items.data[0].price.id;
        
        // Fiyat ID'ye göre plan tipini belirle
        let planType = 'premium'; // varsayılan olarak premium
        
        // Fiyat ID'ye göre planı belirle - gerekirse ayarla
        if (priceId === process.env.PRICE_ID_BASIC_MONTHLY || 
            priceId === process.env.PRICE_ID_BASIC_YEARLY) {
          planType = 'basic';
        }
        
        // Abonelik Detayları
        const subscriptionDetails = {
          id: subscription.id,
          status: subscription.status,
          plan: planType,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          priceId: priceId
        };
        
        // Clerk kullanıcı verilerini güncelle - hem private hem public metadata
        console.log(`Kullanıcı ${userId} için abonelik bilgileri güncelleniyor: ${JSON.stringify(subscriptionDetails)}`);
        
        try {
          // Clerk kullanıcıyı güncelle
          await clerkClient.users.updateUser(userId, {
            privateMetadata: {
              subscription: subscriptionDetails
            },
            publicMetadata: {
              subscription: {
                status: subscription.status,
                plan: planType
              }
            }
          });
          
          console.log(`${subscription.id} aboneliği ${userId} kullanıcısı için başarıyla kaydedildi`);
        } catch (clerkError) {
          console.error(`Clerk güncelleme hatası:`, clerkError);
          throw new Error(`Clerk user metadata update failed: ${clerkError}`);
        }
        
        break;
      }
      
      case 'invoice.payment_succeeded': {
        // Ödeme başarılı olduğunda abonelik kaydını güncelle
        const invoiceObj = event.data.object as any;
        const subscriptionId = invoiceObj.subscription as string;
        
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          
          // Bu abonelik ID'ye sahip kullanıcıyı bul
          const userList = await clerkClient.users.getUserList({
            limit: 100,  // Makul bir limit belirle
          });
          
          // Abonelik ID'ye göre filtrele
          const matchingUsers = userList.data.filter((user: ClerkUser) => {
            const metadata = user.privateMetadata;
            return metadata?.subscription?.id === subscriptionId;
          });
          
          if (matchingUsers.length > 0) {
            const userId = matchingUsers[0].id;
            const userMetadata = matchingUsers[0].privateMetadata;
            
            // Kullanıcının abonelik bilgilerini güncelle
            await clerkClient.users.updateUser(userId, {
              privateMetadata: {
                subscription: {
                  id: subscription.id,
                  status: subscription.status,
                  plan: userMetadata?.subscription?.plan || 'premium',
                  currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                  priceId: subscription.items.data[0].price.id
                }
              },
              publicMetadata: {
                subscription: {
                  status: subscription.status,
                  plan: userMetadata?.subscription?.plan || 'premium'
                }
              }
            });
            
            console.log(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi başarılı oldu`);
          } else {
            console.log(`${subscriptionId} abonelik ID'sine sahip kullanıcı bulunamadı`);
          }
        }
        
        break;
      }
      
      case 'customer.subscription.updated': {
        // Abonelik durumu değişikliklerini yönet
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        
        // Bu abonelik ID'ye sahip kullanıcıyı bul
        const userList = await clerkClient.users.getUserList({
          limit: 100,  // Makul bir limit belirle
        });
        
        // Eşleşen kullanıcıları manuel olarak filtrele
        const matchingUsers = userList.data.filter((user: ClerkUser) => {
          const metadata = user.privateMetadata;
          return metadata?.subscription?.id === subscriptionId;
        });
        
        if (matchingUsers.length > 0) {
          const userId = matchingUsers[0].id;
          const userMetadata = matchingUsers[0].privateMetadata;
          const currentPlan = userMetadata?.subscription?.plan || 'premium';
          
          // Abonelik bilgilerini güncelle
          await clerkClient.users.updateUser(userId, {
            privateMetadata: {
              subscription: {
                id: subscription.id,
                status: subscription.status,
                plan: currentPlan,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                priceId: subscription.items.data[0].price.id
              }
            },
            publicMetadata: {
              subscription: {
                status: subscription.status,
                plan: currentPlan
              }
            }
          });
          
          console.log(`${subscriptionId} aboneliği ${userId} kullanıcısı için güncellendi`);
        } else {
          console.log(`${subscriptionId} abonelik ID'sine sahip kullanıcı bulunamadı`);
        }
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        // Abonelik iptalini yönet
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        
        // Bu abonelik ID'ye sahip kullanıcıyı bul
        const userList = await clerkClient.users.getUserList({
          limit: 100,  // Makul bir limit belirle
        });
        
        // Eşleşen kullanıcıları manuel olarak filtrele
        const matchingUsers = userList.data.filter((user: ClerkUser) => {
          const metadata = user.privateMetadata;
          return metadata?.subscription?.id === subscriptionId;
        });
        
        if (matchingUsers.length > 0) {
          const userId = matchingUsers[0].id;
          
          // Abonelik bilgilerini iptal olarak güncelle
          await clerkClient.users.updateUser(userId, {
            privateMetadata: {
              subscription: {
                id: subscription.id,
                status: 'canceled',
                plan: 'free',
                canceledAt: new Date().toISOString()
              }
            },
            publicMetadata: {
              subscription: {
                status: 'canceled',
                plan: 'free'
              }
            }
          });
          
          console.log(`${subscriptionId} aboneliği ${userId} kullanıcısı için iptal edildi`);
        } else {
          console.log(`${subscriptionId} abonelik ID'sine sahip kullanıcı bulunamadı`);
        }
        
        break;
      }
      
      default:
        console.log(`İşlenmeyen event tipi: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook işleme hatası:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
} 