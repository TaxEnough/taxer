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
    console.log(`Kullanıcı ${userId} metadata güncelleniyor`, { privateMetadata, publicMetadata });
    
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
    console.log(`Clerk API'dan kullanıcı listesi alınıyor (limit: ${limit})`);
    
    const response = await fetch(`https://api.clerk.com/v1/users?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Clerk API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`${data.data.length} kullanıcı bulundu`);
    return data;
  } catch (error) {
    console.error("Kullanıcı listesi alınırken hata:", error);
    return { data: [] };
  }
}

// Belirli bir kullanıcıyı email ile bulmak için yardımcı fonksiyon
async function findUserByEmail(email: string): Promise<ClerkUser | null> {
  try {
    console.log(`${email} email adresi için kullanıcı aranıyor`);
    
    if (!email) {
      console.error("Email adresi belirtilmemiş");
      return null;
    }
    
    // Önce doğrudan email ile arama yapmayı dene (Clerk API sorgu parametresi)
    try {
      const response = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result && result.data && result.data.length > 0) {
          console.log(`API Email sorgusu ile kullanıcı bulundu: ${result.data[0].id}`);
          return result.data[0];
        }
        console.log("API Email sorgusu sonuç vermedi, kullanıcı listesi taramasına geçiliyor");
      }
    } catch (apiError) {
      console.error("Email API sorgusu sırasında hata:", apiError);
      // Hata olursa liste taramasına geç
    }
    
    // Kullanıcı listesini al (yedek yöntem)
    const userList = await getClerkUserList(100);
    const normalizedEmail = email.toLowerCase();
    
    // Email'e göre kullanıcıları bul (daha ayrıntılı eşleştirme)
    const matchingUsers = userList.data.filter(u => {
      // Clerk'teki tüm email adresi yapılarını kontrol et
      const primaryEmailMatch = u.primaryEmail?.toLowerCase() === normalizedEmail;
      const emailMatch = u.email?.toLowerCase() === normalizedEmail;
      
      // Email adreslerinin domain kısmı öncesi kontrolü (örn. test@domain.com -> test)
      const emailUsername = normalizedEmail.split('@')[0];
      const usernameMatch = u.username?.toLowerCase() === emailUsername;
      
      if (primaryEmailMatch) console.log(`Kullanıcı primaryEmail ile eşleşti: ${u.id}`);
      if (emailMatch) console.log(`Kullanıcı email ile eşleşti: ${u.id}`);
      if (usernameMatch) console.log(`Kullanıcı username ile kısmen eşleşti: ${u.id}`);
      
      return primaryEmailMatch || emailMatch || usernameMatch;
    });
    
    if (matchingUsers.length > 0) {
      console.log(`${email} için ${matchingUsers.length} kullanıcı bulundu, ilk eşleşen seçiliyor: ${matchingUsers[0].id}`);
      return matchingUsers[0];
    }
    
    console.log(`${email} için kullanıcı bulunamadı`);
    return null;
  } catch (error) {
    console.error("Email ile kullanıcı arama hatası:", error);
    return null;
  }
}

// Belirli bir kullanıcıyı ID ile almak için yardımcı fonksiyon
async function getClerkUserById(userId: string): Promise<ClerkUser | null> {
  try {
    console.log(`Kullanıcı ID ile aranıyor: ${userId}`);
    
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Clerk API error: ${response.status}`);
    }
    
    const user = await response.json();
    console.log(`Kullanıcı bulundu: ${userId}`);
    return user;
  } catch (error) {
    console.error(`ID ile kullanıcı arama hatası (${userId}):`, error);
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
    
    console.log(`Stripe webhook event alındı: ${event.type}`);
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
          console.error('Checkout session metadata kullanıcı ID içermiyor');
          throw new Error('Missing userId in session metadata');
        }
        
        console.log(`Checkout tamamlandı - userId: ${userId}`);

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
        
        console.log(`Yeni abonelik oluşturuldu - ID: ${subscriptionId}, Customer: ${customerId}`);
        
        try {
          // Stripe'dan müşteri bilgilerini al
          const customer = await stripe.customers.retrieve(customerId) as any;
          console.log(`Müşteri bilgileri alındı - Email: ${customer.email}`);
          
          // Metadata bilgilerini kontrol et
          if (customer.metadata && customer.metadata.userId) {
            console.log(`Müşteri metadata'sında userId bulundu: ${customer.metadata.userId}`);
            const user = await getClerkUserById(customer.metadata.userId);
            
            if (user) {
              // Kullanıcı metadata üzerinden bulundu, abonelik işlemlerine devam et
              // ... subscription processing code ...
              const updateSuccess = await processSubscriptionForUser(user, subscription);
              return NextResponse.json({ success: updateSuccess });
            } else {
              console.log("Metadata'daki userId geçerli bir kullanıcıya ait değil, email ile arama yapılacak");
            }
          }
          
          // Customer email'i kullanarak Clerk'te kullanıcıyı bul
          const user = await findUserByEmail(customer.email);
          
          if (user) {
            // Kullanıcı bulundu, abonelik işlemlerine devam et
            const updateSuccess = await processSubscriptionForUser(user, subscription);
            return NextResponse.json({ success: updateSuccess });
          } else {
            // Kullanıcı bulunamadı
            console.error(`Kullanıcı bulunamadı: ${customer.email}`);
            return NextResponse.json(
              { error: `User not found for email: ${customer.email}` },
              { status: 404 }
            );
          }
        } catch (customerError: any) {
          console.error("Müşteri bilgileri alınırken hata:", customerError);
          return NextResponse.json(
            { error: `Error retrieving customer: ${customerError.message}` },
            { status: 500 }
          );
        }
      }
      
      case 'customer.created': {
        // Müşteri oluşturulduğunda gerekirse işlem yap
        const customer = event.data.object as any;
        console.log(`Müşteri oluşturuldu: ${customer.id}, Email: ${customer.email}`);
        
        // Customer email'i kullanarak Clerk'te kullanıcıyı bul
        const user = await findUserByEmail(customer.email);
        
        if (user) {
          console.log(`Müşteri ${customer.id} için Clerk kullanıcısı bulundu: ${user.id}`);
        } else {
          console.log(`Müşteri ${customer.id} için Clerk kullanıcısı bulunamadı, email: ${customer.email}`);
        }
        
        break;
      }
      
      case 'customer.updated': {
        // Müşteri güncellendiğinde gerekirse işlem yap
        const customer = event.data.object as any;
        console.log(`Müşteri güncellendi: ${customer.id}, Email: ${customer.email}`);
        
        // Customer email'i kullanarak Clerk'te kullanıcıyı bul
        const user = await findUserByEmail(customer.email);
        
        if (user) {
          console.log(`Müşteri ${customer.id} için Clerk kullanıcısı bulundu: ${user.id}`);
        } else {
          console.log(`Müşteri ${customer.id} için Clerk kullanıcısı bulunamadı, email: ${customer.email}`);
        }
        
        break;
      }
      
      case 'invoice.payment_succeeded': {
        // Ödeme başarılı olduğunda abonelik kaydını güncelle
        const invoiceObj = event.data.object as any;
        const subscriptionId = invoiceObj.subscription as string;
        const customerId = invoiceObj.customer as string;
        
        console.log(`Fatura ödemesi başarılı - Abonelik: ${subscriptionId}, Müşteri: ${customerId}`);
        
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
            
            console.log(`Abonelik ID ${subscriptionId} ile kullanıcı bulundu: ${userId}`);
            
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
            // Kullanıcıyı abonelik ID'sine göre bulamadıysak, customer ID'ye göre deneyelim
            console.log(`Abonelik ID ${subscriptionId} ile kullanıcı bulunamadı, müşteri ID ${customerId} kullanılacak`);
            
            try {
              // Stripe müşterisini al
              const customer = await stripe.customers.retrieve(customerId) as any;
              
              // Customer email'i kullanarak Clerk'te kullanıcıyı bul
              const user = await findUserByEmail(customer.email);
              
              if (user) {
                const userId = user.id;
                console.log(`Müşteri email ${customer.email} ile kullanıcı bulundu: ${userId}`);
                
                // Planı belirlemek için price ID'yi al
                const priceId = subscription.items.data[0].price.id;
                let planType = 'premium'; // varsayılan olarak premium
                
                // Fiyat ID'ye göre planı belirle - gerekirse ayarla
                if (priceId === process.env.PRICE_ID_BASIC_MONTHLY || 
                    priceId === process.env.PRICE_ID_BASIC_YEARLY) {
                  planType = 'basic';
                }
                
                // Kullanıcının abonelik bilgilerini güncelle
                const updateSuccess = await updateClerkUserMetadata(
                  userId,
                  { 
                    subscription: {
                      id: subscription.id,
                      status: subscription.status,
                      plan: planType,
                      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                      priceId: subscription.items.data[0].price.id
                    }
                  },
                  { 
                    subscription: {
                      status: subscription.status,
                      plan: planType
                    }
                  }
                );
                
                if (updateSuccess) {
                  console.log(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi başarılı oldu (email ile eşleştirilerek)`);
                } else {
                  console.error(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi kaydedilemedi (email ile eşleştirilerek)`);
                }
              } else {
                console.log(`${subscriptionId} abonelik ID'sine sahip kullanıcı bulunamadı - email: ${customer.email}`);
              }
            } catch (error) {
              console.error(`Müşteri bilgileri alınırken hata: ${error}`);
            }
          }
        }
        
        break;
      }
      
      case 'customer.subscription.updated': {
        // Abonelik durumu değişikliklerini yönet
        const subscription = event.data.object as any;
        const subscriptionId = subscription.id;
        
        console.log(`Abonelik güncellendi - ID: ${subscriptionId}`);
        
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
          
          console.log(`Abonelik ID ${subscriptionId} için kullanıcı bulundu: ${userId}`);
          
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
        
        console.log(`Abonelik silindi - ID: ${subscriptionId}`);
        
        // Bu abonelik ID'ye sahip kullanıcıyı bul
        const userList = await getClerkUserList(100);
        
        // Eşleşen kullanıcıları manuel olarak filtrele
        const matchingUsers = userList.data.filter((user: ClerkUser) => {
          const metadata = user.privateMetadata;
          return metadata?.subscription?.id === subscriptionId;
        });
        
        if (matchingUsers.length > 0) {
          const userId = matchingUsers[0].id;
          
          console.log(`Abonelik ID ${subscriptionId} için kullanıcı bulundu: ${userId}`);
          
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
      
      case 'customer.deleted': {
        // Müşteri silme işlemi
        const customer = event.data.object as any;
        console.log(`Müşteri silindi - ID: ${customer.id}, Email: ${customer.email}`);
        
        // Email ile kullanıcıyı bul
        const user = await findUserByEmail(customer.email);
        
        if (user) {
          const userId = user.id;
          console.log(`Silinen müşteri için kullanıcı bulundu: ${userId}`);
          
          // Kullanıcının abonelik bilgilerini iptal olarak güncelle
          const updateSuccess = await updateClerkUserMetadata(
            userId,
            { 
              subscription: null // Abonelik bilgilerini temizle
            },
            { 
              subscription: null // Abonelik bilgilerini temizle
            }
          );
          
          if (updateSuccess) {
            console.log(`${userId} kullanıcısının abonelik bilgileri silindi`);
          } else {
            console.error(`${userId} kullanıcısının abonelik bilgileri silinemedi`);
          }
        } else {
          console.log(`Silinen müşteri için kullanıcı bulunamadı: ${customer.email}`);
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

// Abonelik işleme yardımcı fonksiyonu
async function processSubscriptionForUser(user: ClerkUser, subscription: any): Promise<boolean> {
  try {
    const userId = user.id;
    console.log(`Email'e göre kullanıcı bulundu - ID: ${userId}`);
    
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
      console.log(`Yeni abonelik ${subscription.id} kullanıcısı ${userId} için oluşturuldu`);
      return true;
    } else {
      console.error(`Yeni abonelik ${subscription.id} kullanıcı ${userId} için oluşturulamadı`);
      return false;
    }
  } catch (error) {
    console.error("Abonelik işleme hatası:", error);
    return false;
  }
} 