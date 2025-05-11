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

// Debug loglama fonksiyonu - daha detaylı
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] WEBHOOK DEBUG: ${message}`);
  if (data) {
    try {
      if (typeof data === 'object') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(data);
      }
    } catch (e) {
      console.log('Veri loglanamadı:', e);
    }
  }
}

// Hata loglama fonksiyonu
function errorLog(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] WEBHOOK ERROR: ${message}`);
  if (error) {
    if (error instanceof Error) {
      console.error(`Hata türü: ${error.name}`);
      console.error(`Hata mesajı: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
    } else {
      console.error(error);
    }
  }
}

// Clerk API'ına yapılacak çağrılar için yardımcı fonksiyon
async function updateClerkUserMetadata(
  userId: string, 
  privateMetadata: any, 
  publicMetadata: any
): Promise<boolean> {
  try {
    debugLog(`Kullanıcı ${userId} metadata güncelleniyor`, { privateMetadata, publicMetadata });
    
    // Clerk API anahtarını kontrol et
    if (!process.env.CLERK_SECRET_KEY) {
      errorLog('CLERK_SECRET_KEY çevre değişkeni bulunamadı');
      return false;
    }
    
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
      errorLog("Clerk güncelleme hatası:", errorData);
      return false;
    }
    
    const result = await response.json();
    debugLog("Clerk kullanıcı metadata güncellemesi başarılı", { userId, result: { id: result.id } });
    return true;
  } catch (error) {
    errorLog("Clerk API çağrısı sırasında hata:", error);
    return false;
  }
}

// Clerk API'ından kullanıcı listesi almak için yardımcı fonksiyon
async function getClerkUserList(limit: number = 100): Promise<{ data: ClerkUser[] }> {
  try {
    debugLog(`Clerk API'dan kullanıcı listesi alınıyor (limit: ${limit})`);
    
    // Clerk API anahtarını kontrol et
    if (!process.env.CLERK_SECRET_KEY) {
      errorLog('CLERK_SECRET_KEY çevre değişkeni bulunamadı');
      return { data: [] };
    }
    
    const response = await fetch(`https://api.clerk.com/v1/users?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      errorLog(`Clerk API error (${status}):`, text);
      throw new Error(`Clerk API error: ${status}`);
    }
    
    const data = await response.json();
    debugLog(`${data.data.length} kullanıcı bulundu`);
    return data;
  } catch (error) {
    errorLog("Kullanıcı listesi alınırken hata:", error);
    return { data: [] };
  }
}

// Belirli bir kullanıcıyı email ile bulmak için yardımcı fonksiyon
async function findUserByEmail(email: string): Promise<ClerkUser | null> {
  try {
    debugLog(`${email} email adresi için kullanıcı aranıyor`);
    
    if (!email) {
      errorLog("Email adresi belirtilmemiş");
      return null;
    }
    
    // Önce doğrudan email ile arama yapmayı dene (Clerk API sorgu parametresi)
    try {
      debugLog(`Doğrudan email parametresi ile sorgu deneniyor: ${email}`);
      
      // Clerk API anahtarını kontrol et
      if (!process.env.CLERK_SECRET_KEY) {
        errorLog('CLERK_SECRET_KEY çevre değişkeni bulunamadı');
        return null;
      }
      
      const response = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        debugLog("API Email sorgusu sonucu:", { 
          statusCode: response.status, 
          kullanıcıSayısı: result?.data?.length || 0
        });
        
        if (result && result.data && result.data.length > 0) {
          debugLog(`API Email sorgusu ile kullanıcı bulundu: ${result.data[0].id}`);
          return result.data[0];
        }
        debugLog("API Email sorgusu sonuç vermedi, kullanıcı listesi taramasına geçiliyor");
      } else {
        const status = response.status;
        const text = await response.text();
        errorLog(`Email sorgusu API hatası (${status}):`, text);
      }
    } catch (apiError) {
      errorLog("Email API sorgusu sırasında hata:", apiError);
      // Hata olursa liste taramasına geç
    }
    
    // Kullanıcı listesini al (yedek yöntem)
    const userList = await getClerkUserList(100);
    const normalizedEmail = email.toLowerCase();
    
    debugLog(`Manuel arama için ${userList.data.length} kullanıcı alındı`);
    
    // Email'e göre kullanıcıları bul (daha ayrıntılı eşleştirme)
    const matchingUsers = userList.data.filter(u => {
      // Clerk'teki tüm email adresi yapılarını kontrol et
      const primaryEmailMatch = u.primaryEmail?.toLowerCase() === normalizedEmail;
      const emailMatch = u.email?.toLowerCase() === normalizedEmail;
      
      // Email adreslerinin domain kısmı öncesi kontrolü (örn. test@domain.com -> test)
      const emailUsername = normalizedEmail.split('@')[0];
      const usernameMatch = u.username?.toLowerCase() === emailUsername;
      
      if (primaryEmailMatch) debugLog(`Kullanıcı primaryEmail ile eşleşti: ${u.id}`);
      if (emailMatch) debugLog(`Kullanıcı email ile eşleşti: ${u.id}`);
      if (usernameMatch) debugLog(`Kullanıcı username ile kısmen eşleşti: ${u.id}`);
      
      return primaryEmailMatch || emailMatch || usernameMatch;
    });
    
    if (matchingUsers.length > 0) {
      debugLog(`${email} için ${matchingUsers.length} kullanıcı bulundu, ilk eşleşen seçiliyor: ${matchingUsers[0].id}`);
      return matchingUsers[0];
    }
    
    debugLog(`${email} için kullanıcı bulunamadı. Tüm kullanıcı email bilgileri:`, 
      userList.data.map(u => ({ 
        id: u.id, 
        email: u.email, 
        primaryEmail: u.primaryEmail, 
        username: u.username 
      }))
    );
    
    return null;
  } catch (error) {
    errorLog("Email ile kullanıcı arama hatası:", error);
    return null;
  }
}

// Belirli bir kullanıcıyı ID ile almak için yardımcı fonksiyon
async function getClerkUserById(userId: string): Promise<ClerkUser | null> {
  try {
    debugLog(`Kullanıcı ID ile aranıyor: ${userId}`);
    
    // Clerk API anahtarını kontrol et
    if (!process.env.CLERK_SECRET_KEY) {
      errorLog('CLERK_SECRET_KEY çevre değişkeni bulunamadı');
      return null;
    }
    
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      errorLog(`Kullanıcı ID sorgusu API hatası (${status}):`, text);
      throw new Error(`Clerk API error: ${status}`);
    }
    
    const user = await response.json();
    debugLog(`Kullanıcı bulundu: ${userId}`);
    return user;
  } catch (error) {
    errorLog(`ID ile kullanıcı arama hatası (${userId}):`, error);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = headers().get('stripe-signature') as string;

    if (!signature) {
      errorLog('Missing Stripe signature in webhook request');
      return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      // Stripe webhookunu doğrula
      debugLog('Stripe webhook doğrulanıyor', { signatureLength: signature.length });
      
      // Webhook secret kontrolü
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        errorLog('STRIPE_WEBHOOK_SECRET çevre değişkeni bulunamadı');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
      }
      
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      debugLog(`Stripe webhook event alındı ve doğrulandı: ${event.type}`);
    } catch (error: any) {
      errorLog(`Webhook doğrulama hatası:`, error);
      return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
    }

    try {
      // Event tipine göre işlem yap
      debugLog(`İşleniyor: ${event.type} event`);
      
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          
          // Kullanıcı ID'sini metadata'dan al
          const userId = session.metadata?.userId;
          debugLog('Checkout session metadata:', session.metadata);
          
          if (!userId) {
            errorLog('Checkout session metadata kullanıcı ID içermiyor', session);
            throw new Error('Missing userId in session metadata');
          }
          
          debugLog(`Checkout tamamlandı - userId: ${userId}`);

          // Stripe'dan abonelik bilgilerini al
          if (!session.subscription) {
            errorLog('Checkout session abonelik ID içermiyor', session);
            throw new Error('Missing subscription in session');
          }
          
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
          debugLog('Abonelik alındı', { 
            id: subscription.id, 
            status: subscription.status, 
            items: subscription.items?.data?.length
          });
          
          // Planı belirlemek için price ID'yi al
          const priceId = subscription.items.data[0].price.id;
          debugLog('Fiyat ID:', priceId);
          
          // Fiyat ID'ye göre plan tipini belirle
          let planType = 'premium'; // varsayılan olarak premium
          
          // Fiyat ID'ye göre planı belirle - gerekirse ayarla
          const basicMonthlyPriceId = process.env.PRICE_ID_BASIC_MONTHLY;
          const basicYearlyPriceId = process.env.PRICE_ID_BASIC_YEARLY;
          
          debugLog('Fiyat karşılaştırması:', {
            currentPriceId: priceId,
            basicMonthlyPriceId,
            basicYearlyPriceId
          });
          
          if (priceId === basicMonthlyPriceId || priceId === basicYearlyPriceId) {
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
          debugLog(`Kullanıcı ${userId} için abonelik bilgileri güncelleniyor:`, subscriptionDetails);
          
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
            debugLog(`${subscription.id} aboneliği ${userId} kullanıcısı için başarıyla kaydedildi`);
          } else {
            errorLog(`${subscription.id} aboneliği ${userId} kullanıcısı için kaydedilemedi`);
            throw new Error('Clerk user metadata update failed');
          }
          
          break;
        }
        
        case 'customer.subscription.created': {
          // Yeni abonelik oluşturulduğunda işle
          const subscription = event.data.object as any;
          const subscriptionId = subscription.id;
          const customerId = subscription.customer;
          
          debugLog(`Yeni abonelik oluşturuldu - ID: ${subscriptionId}, Customer: ${customerId}`);
          
          try {
            // Stripe'dan müşteri bilgilerini al
            debugLog(`Müşteri bilgileri alınıyor: ${customerId}`);
            const customer = await stripe.customers.retrieve(customerId) as any;
            debugLog(`Müşteri bilgileri alındı - Email: ${customer.email}`);
            debugLog('Müşteri metadata:', customer.metadata);
            
            // Metadata bilgilerini kontrol et
            if (customer.metadata && customer.metadata.userId) {
              debugLog(`Müşteri metadata'sında userId bulundu: ${customer.metadata.userId}`);
              const user = await getClerkUserById(customer.metadata.userId);
              
              if (user) {
                // Kullanıcı metadata üzerinden bulundu, abonelik işlemlerine devam et
                debugLog(`Müşteri metadatasındaki userId ile kullanıcı bulundu: ${user.id}`);
                const updateSuccess = await processSubscriptionForUser(user, subscription);
                debugLog(`Abonelik işleme sonucu: ${updateSuccess ? 'Başarılı' : 'Başarısız'}`);
                return NextResponse.json({ success: updateSuccess });
              } else {
                debugLog("Metadata'daki userId geçerli bir kullanıcıya ait değil, email ile arama yapılacak");
              }
            } else {
              debugLog("Müşteri metadatasında userId bulunamadı, email ile arama yapılacak");
            }
            
            // Customer email'i kullanarak Clerk'te kullanıcıyı bul
            debugLog(`Müşteri emaili ile kullanıcı aranıyor: ${customer.email}`);
            const user = await findUserByEmail(customer.email);
            
            if (user) {
              // Kullanıcı bulundu, abonelik işlemlerine devam et
              debugLog(`Müşteri emaili ile kullanıcı bulundu: ${user.id}`);
              const updateSuccess = await processSubscriptionForUser(user, subscription);
              debugLog(`Abonelik işleme sonucu: ${updateSuccess ? 'Başarılı' : 'Başarısız'}`);
              return NextResponse.json({ success: updateSuccess });
            } else {
              // Kullanıcı bulunamadı
              errorLog(`Kullanıcı bulunamadı: ${customer.email}`);
              return NextResponse.json(
                { error: `User not found for email: ${customer.email}` },
                { status: 404 }
              );
            }
          } catch (customerError: any) {
            errorLog("Müşteri bilgileri alınırken hata:", customerError);
            return NextResponse.json(
              { error: `Error retrieving customer: ${customerError.message}` },
              { status: 500 }
            );
          }
        }
        
        case 'customer.created': {
          // Müşteri oluşturulduğunda gerekirse işlem yap
          const customer = event.data.object as any;
          debugLog(`Müşteri oluşturuldu: ${customer.id}, Email: ${customer.email}`);
          debugLog('Müşteri metadata:', customer.metadata);
          
          // Customer email'i kullanarak Clerk'te kullanıcıyı bul
          const user = await findUserByEmail(customer.email);
          
          if (user) {
            debugLog(`Müşteri ${customer.id} için Clerk kullanıcısı bulundu: ${user.id}`);
          } else {
            debugLog(`Müşteri ${customer.id} için Clerk kullanıcısı bulunamadı, email: ${customer.email}`);
          }
          
          break;
        }
        
        case 'customer.updated': {
          // Müşteri güncellendiğinde gerekirse işlem yap
          const customer = event.data.object as any;
          debugLog(`Müşteri güncellendi: ${customer.id}, Email: ${customer.email}`);
          debugLog('Müşteri metadata:', customer.metadata);
          
          // Customer email'i kullanarak Clerk'te kullanıcıyı bul
          const user = await findUserByEmail(customer.email);
          
          if (user) {
            debugLog(`Müşteri ${customer.id} için Clerk kullanıcısı bulundu: ${user.id}`);
          } else {
            debugLog(`Müşteri ${customer.id} için Clerk kullanıcısı bulunamadı, email: ${customer.email}`);
          }
          
          break;
        }
        
        case 'invoice.payment_succeeded': {
          // Ödeme başarılı olduğunda abonelik kaydını güncelle
          const invoiceObj = event.data.object as any;
          const subscriptionId = invoiceObj.subscription as string;
          const customerId = invoiceObj.customer as string;
          
          debugLog(`Fatura ödemesi başarılı - Abonelik: ${subscriptionId}, Müşteri: ${customerId}`);
          
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
              
              debugLog(`Abonelik ID ${subscriptionId} ile kullanıcı bulundu: ${userId}`);
              
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
                debugLog(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi başarılı oldu`);
              } else {
                debugLog(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi kaydedilemedi`);
              }
            } else {
              // Kullanıcıyı abonelik ID'sine göre bulamadıysak, customer ID'ye göre deneyelim
              debugLog(`Abonelik ID ${subscriptionId} ile kullanıcı bulunamadı, müşteri ID ${customerId} kullanılacak`);
              
              try {
                // Stripe müşterisini al
                const customer = await stripe.customers.retrieve(customerId) as any;
                
                // Customer email'i kullanarak Clerk'te kullanıcıyı bul
                const user = await findUserByEmail(customer.email);
                
                if (user) {
                  const userId = user.id;
                  debugLog(`Müşteri email ${customer.email} ile kullanıcı bulundu: ${userId}`);
                  
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
                    debugLog(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi başarılı oldu (email ile eşleştirilerek)`);
                  } else {
                    debugLog(`${subscriptionId} aboneliği için ${userId} kullanıcısının ödemesi kaydedilemedi (email ile eşleştirilerek)`);
                  }
                } else {
                  debugLog(`${subscriptionId} abonelik ID'sine sahip kullanıcı bulunamadı - email: ${customer.email}`);
                }
              } catch (error) {
                errorLog(`Müşteri bilgileri alınırken hata: ${error}`);
              }
            }
          }
          
          break;
        }
        
        case 'customer.subscription.updated': {
          // Abonelik durumu değişikliklerini yönet
          const subscription = event.data.object as any;
          const subscriptionId = subscription.id;
          
          debugLog(`Abonelik güncellendi - ID: ${subscriptionId}`);
          
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
            
            debugLog(`Abonelik ID ${subscriptionId} için kullanıcı bulundu: ${userId}`);
            
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
              debugLog(`${subscriptionId} aboneliği ${userId} kullanıcısı için güncellendi`);
            } else {
              debugLog(`${subscriptionId} aboneliği ${userId} kullanıcısı için güncellenemedi`);
            }
          } else {
            debugLog(`${subscriptionId} abonelik ID'sine sahip kullanıcı bulunamadı`);
          }
          
          break;
        }
        
        case 'customer.subscription.deleted': {
          // Abonelik iptalini yönet
          const subscription = event.data.object as any;
          const subscriptionId = subscription.id;
          
          debugLog(`Abonelik silindi - ID: ${subscriptionId}`);
          
          // Bu abonelik ID'ye sahip kullanıcıyı bul
          const userList = await getClerkUserList(100);
          
          // Eşleşen kullanıcıları manuel olarak filtrele
          const matchingUsers = userList.data.filter((user: ClerkUser) => {
            const metadata = user.privateMetadata;
            return metadata?.subscription?.id === subscriptionId;
          });
          
          if (matchingUsers.length > 0) {
            const userId = matchingUsers[0].id;
            
            debugLog(`Abonelik ID ${subscriptionId} için kullanıcı bulundu: ${userId}`);
            
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
              debugLog(`${subscriptionId} aboneliği ${userId} kullanıcısı için iptal edildi`);
            } else {
              debugLog(`${subscriptionId} aboneliği ${userId} kullanıcısı için iptal edilemedi`);
            }
          } else {
            debugLog(`${subscriptionId} abonelik ID'sine sahip kullanıcı bulunamadı`);
          }
          
          break;
        }
        
        case 'customer.deleted': {
          // Müşteri silme işlemi
          const customer = event.data.object as any;
          debugLog(`Müşteri silindi - ID: ${customer.id}, Email: ${customer.email}`);
          
          // Email ile kullanıcıyı bul
          const user = await findUserByEmail(customer.email);
          
          if (user) {
            const userId = user.id;
            debugLog(`Silinen müşteri için kullanıcı bulundu: ${userId}`);
            
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
              debugLog(`${userId} kullanıcısının abonelik bilgileri silindi`);
            } else {
              debugLog(`${userId} kullanıcısının abonelik bilgileri silinemedi`);
            }
          } else {
            debugLog(`Silinen müşteri için kullanıcı bulunamadı: ${customer.email}`);
          }
          
          break;
        }
        
        default:
          debugLog(`İşlenmeyen event tipi: ${event.type}`);
      }

      return NextResponse.json({ received: true });
    } catch (error) {
      errorLog('Webhook işleme hatası:', error);
      return NextResponse.json(
        { error: 'Error processing webhook' },
        { status: 500 }
      );
    }
  } catch (outerError) {
    errorLog('Webhook üst seviye hata:', outerError);
    return NextResponse.json(
      { error: 'Webhook processing error' },
      { status: 500 }
    );
  }
}

// Abonelik işleme yardımcı fonksiyonu
async function processSubscriptionForUser(user: ClerkUser, subscription: any): Promise<boolean> {
  try {
    const userId = user.id;
    debugLog(`Email'e göre kullanıcı bulundu - ID: ${userId}`);
    
    // Planı belirle
    const priceId = subscription.items.data[0].price.id;
    let planType = 'premium'; // varsayılan olarak premium
    
    debugLog('Fiyat ID ve plan tipi:', { priceId, defaultType: 'premium' });
    
    // Fiyat ID'ye göre planı belirle - gerekirse ayarla
    const basicMonthlyPriceId = process.env.PRICE_ID_BASIC_MONTHLY;
    const basicYearlyPriceId = process.env.PRICE_ID_BASIC_YEARLY;
    
    debugLog('Fiyat karşılaştırması:', {
      currentPriceId: priceId,
      basicMonthlyPriceId,
      basicYearlyPriceId
    });
    
    if (priceId === basicMonthlyPriceId || priceId === basicYearlyPriceId) {
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
    
    debugLog('Oluşturulan abonelik detayları:', subscriptionDetails);
    
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
      debugLog(`Yeni abonelik ${subscription.id} kullanıcısı ${userId} için oluşturuldu`);
      return true;
    } else {
      errorLog(`Yeni abonelik ${subscription.id} kullanıcı ${userId} için oluşturulamadı`);
      return false;
    }
  } catch (error) {
    errorLog("Abonelik işleme hatası:", error);
    return false;
  }
} 