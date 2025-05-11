import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

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
  email?: string;
  username?: string;
  primaryEmail?: string;
  privateMetadata: SubscriptionUserMetadata;
  publicMetadata: SubscriptionUserMetadata;
};

// Stripe API client'ı oluştur
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
});

// Clerk API'ına yapılacak çağrılar için yardımcı fonksiyon
async function updateClerkUserMetadata(
  userId: string, 
  privateMetadata: any, 
  publicMetadata: any
): Promise<boolean> {
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        private_metadata: privateMetadata,
        public_metadata: publicMetadata
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Clerk güncelleme hatası:", errorData);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Clerk API çağrısı sırasında hata:", error);
    return false;
  }
}

// Clerk API'ından kullanıcı listesi almak için yardımcı fonksiyon
async function getClerkUserList(limit: number = 100): Promise<{ data: ClerkUser[] }> {
  try {
    const response = await fetch(`https://api.clerk.com/v1/users?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Clerk API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Kullanıcı listesi alınırken hata:", error);
    return { data: [] };
  }
}

// Belirli bir kullanıcıyı email ile bulmak için yardımcı fonksiyon
async function findUserByEmail(email: string): Promise<ClerkUser | null> {
  try {
    // Kullanıcı listesini al
    const userList = await getClerkUserList(100);
    
    // Email'e göre kullanıcıyı bul
    const user = userList.data.find(u => 
      u.primaryEmail === email || 
      u.email === email || 
      (u.username && u.username.toLowerCase() === email.toLowerCase())
    );
    
    return user || null;
  } catch (error) {
    console.error("Email ile kullanıcı arama hatası:", error);
    return null;
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
        
        const updateSuccess = await updateClerkUserMetadata(
          userId,
          { subscription: subscriptionDetails },
          { 
            subscription: {
              status: subscription.status,
              plan: planType
            }
          }
        );
        
        if (updateSuccess) {
          console.log(`${subscription.id} aboneliği ${userId} kullanıcısı için başarıyla kaydedildi`);
        } else {
          console.error(`${subscription.id} aboneliği ${userId} kullanıcısı için kaydedilemedi`);
          throw new Error('Clerk user metadata update failed');
        }
        
        break;
      }
      
      case 'customer.subscription.created': {
        // Yeni abonelik oluşturulduğunda işle
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer;
        
        // Stripe'dan müşteri bilgilerini al
        const customer = await stripe.customers.retrieve(customerId) as any;
        
        // Customer email'i kullanarak Clerk'te kullanıcıyı bul
        const user = await findUserByEmail(customer.email);
        
        if (user) {
          const userId = user.id;
          
          // Planı belirle
          const priceId = subscription.items.data[0].price.id;
          let planType = 'premium'; // varsayılan olarak premium
          
          // Fiyat ID'ye göre planı belirle - gerekirse ayarla
          if (priceId === process.env.PRICE_ID_BASIC_MONTHLY || 
              priceId === process.env.PRICE_ID_BASIC_YEARLY) {
            planType = 'basic';
          }
          
          // Abonelik detaylarını oluştur
          const subscriptionDetails = {
            id: subscription.id,
            status: subscription.status,
            plan: planType,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            priceId: priceId
          };
          
          // Clerk kullanıcı metadatasını güncelle
          const updateSuccess = await updateClerkUserMetadata(
            userId,
            { subscription: subscriptionDetails },
            { 
              subscription: {
                status: subscription.status,
                plan: planType
              }
            }
          );
          
          if (updateSuccess) {
            console.log(`Yeni abonelik ${subscriptionId} kullanıcısı ${userId} için oluşturuldu`);
          } else {
            console.error(`Yeni abonelik ${subscriptionId} kullanıcı ${userId} için oluşturulamadı`);
          }
        } else {
          console.error(`Kullanıcı bulunamadı: ${customer.email}`);
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
          const userList = await getClerkUserList(100);
          
          // Abonelik ID'ye göre filtrele
          const matchingUsers = userList.data.filter((user: ClerkUser) => {
            const metadata = user.privateMetadata;
            return metadata?.subscription?.id === subscriptionId;
          });
          
          if (matchingUsers.length > 0) {
            const userId = matchingUsers[0].id;
            const userMetadata = matchingUsers[0].privateMetadata;
            const currentPlan = userMetadata?.subscription?.plan || 'premium';
            
            // Kullanıcının abonelik bilgilerini güncelle
            const updateSuccess = await updateClerkUserMetadata(
              userId,
              { 
                subscription: {
                  id: subscription.id,
                  status: subscription.status,
                  plan: currentPlan,
                  currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                  priceId: subscription.items.data[0].price.id
                }
              },
              { 
                subscription: {
                  status: subscription.status,
                  plan: currentPlan
                }
              }
            );
            
            if (updateSuccess) {
              console.log(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi başarılı oldu`);
            } else {
              console.error(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi kaydedilemedi`);
            }
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
        const userList = await getClerkUserList(100);
        
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
          const updateSuccess = await updateClerkUserMetadata(
            userId,
            { 
              subscription: {
                id: subscription.id,
                status: subscription.status,
                plan: currentPlan,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                priceId: subscription.items.data[0].price.id
              }
            },
            { 
              subscription: {
                status: subscription.status,
                plan: currentPlan
              }
            }
          );
          
          if (updateSuccess) {
            console.log(`${subscriptionId} aboneliği ${userId} kullanıcısı için güncellendi`);
          } else {
            console.error(`${subscriptionId} aboneliği ${userId} kullanıcısı için güncellenemedi`);
          }
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
        const userList = await getClerkUserList(100);
        
        // Eşleşen kullanıcıları manuel olarak filtrele
        const matchingUsers = userList.data.filter((user: ClerkUser) => {
          const metadata = user.privateMetadata;
          return metadata?.subscription?.id === subscriptionId;
        });
        
        if (matchingUsers.length > 0) {
          const userId = matchingUsers[0].id;
          
          // Abonelik bilgilerini iptal olarak güncelle
          const updateSuccess = await updateClerkUserMetadata(
            userId,
            { 
              subscription: {
                id: subscription.id,
                status: 'canceled',
                plan: 'free',
                canceledAt: new Date().toISOString()
              }
            },
            { 
              subscription: {
                status: 'canceled',
                plan: 'free'
              }
            }
          );
          
          if (updateSuccess) {
            console.log(`${subscriptionId} aboneliği ${userId} kullanıcısı için iptal edildi`);
          } else {
            console.error(`${subscriptionId} aboneliği ${userId} kullanıcısı için iptal edilemedi`);
          }
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