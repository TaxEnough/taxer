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
    if (!email) {
      errorLog("❌ Email adresi belirtilmemiş!");
      return null;
    }
    
    debugLog(`🔍 '${email}' email adresi için kullanıcı araması başlatılıyor`);
    
    // 1. ADIM: Doğrudan Clerk API sorgusu ile kullanıcıyı bulmayı dene
    try {
      if (!process.env.CLERK_SECRET_KEY) {
        errorLog('❌ CLERK_SECRET_KEY çevre değişkeni bulunamadı!');
        return null;
      }
      
      // Email adresini URL için kodla
      const encodedEmail = encodeURIComponent(email);
      debugLog(`📬 Clerk API'den doğrudan sorgu: ${encodedEmail}`);
      
      // API çağrısını yap
      const response = await fetch(`https://api.clerk.com/v1/users?email_address=${encodedEmail}`, {
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      // Yanıtı kontrol et
      if (response.ok) {
        const result = await response.json();
        
        if (result.data && result.data.length > 0) {
          const foundUser = result.data[0];
          debugLog(`✅ API sorgusu ile kullanıcı bulundu: ${foundUser.id}`);
          return foundUser;
        }
        
        debugLog("⚠️ API sorgusu ile kullanıcı bulunamadı, alternatif yöntemler deneniyor...");
      } else {
        const errorText = await response.text();
        errorLog(`❌ Clerk API yanıt hatası: ${response.status}`, errorText);
      }
    } catch (apiError) {
      errorLog("❌ Clerk API sorgusu hatası", apiError);
    }
    
    // 2. ADIM: Tüm kullanıcıları getir ve manuel olarak ara
    debugLog("📋 Tüm kullanıcılar listesi alınıyor (manuel arama için)");
    const userList = await getClerkUserList(200); // Daha fazla kullanıcı al
    
    if (!userList.data || userList.data.length === 0) {
      errorLog("❌ Kullanıcı listesi alınamadı veya boş");
      return null;
    }
    
    debugLog(`📊 Manuel arama için ${userList.data.length} kullanıcı alındı`);
    
    // Arama için normalize email
    const normalizedEmail = email.toLowerCase().trim();
    let bestMatch: ClerkUser | null = null;
    
    // Eşleşme skorlarını tutacak dizi oluştur
    const matchScores: {user: ClerkUser, score: number, reason: string}[] = [];
    
    // Her kullanıcıyı kontrol et
    for (const user of userList.data) {
      let score = 0;
      let matchReason = "";
      
      // Primary email tam eşleşme (en yüksek öncelik)
      if (user.primaryEmail?.toLowerCase() === normalizedEmail) {
        score += 100;
        matchReason += "Birincil email tam eşleşme, ";
      }
      
      // Herhangi bir email tam eşleşme
      const userEmails = (user as any).emailAddresses || [];
      for (const emailObj of userEmails) {
        if (emailObj.emailAddress?.toLowerCase() === normalizedEmail) {
          score += 90;
          matchReason += "Email tam eşleşme, ";
          break;
        }
      }
      
      // Username eşleşmesi (email'in @ öncesi kısmı)
      const emailUsername = normalizedEmail.split('@')[0];
      if (user.username?.toLowerCase() === emailUsername) {
        score += 40;
        matchReason += "Username eşleşme, ";
      }
      
      // Kısmi email eşleşmesi
      for (const emailObj of userEmails) {
        if (emailObj.emailAddress?.toLowerCase().includes(emailUsername)) {
          score += 30;
          matchReason += "Kısmi email eşleşme, ";
          break;
        }
      }
      
      // Herhangi bir skor varsa kaydet
      if (score > 0) {
        matchScores.push({user, score, reason: matchReason.trim()});
      }
    }
    
    // Eşleşmeleri skora göre sırala
    matchScores.sort((a, b) => b.score - a.score);
    
    // En iyi eşleşmeyi al
    if (matchScores.length > 0) {
      bestMatch = matchScores[0].user;
      debugLog(`✅ Kullanıcı eşleşmesi bulundu: ${bestMatch.id}`, {
        score: matchScores[0].score,
        reason: matchScores[0].reason
      });
      
      // Birden fazla eşleşme varsa logla
      if (matchScores.length > 1) {
        debugLog(`ℹ️ Birden fazla eşleşme bulundu (${matchScores.length})`, 
          matchScores.slice(0, 3).map(m => ({
            userId: m.user.id, 
            score: m.score, 
            reason: m.reason
          }))
        );
      }
      
      return bestMatch;
    }
    
    // Kullanıcı bulunamadı, mevcut tüm kullanıcıların email bilgilerini logla
    const userEmailData = userList.data.map(u => {
      const emails = (u as any).emailAddresses?.map((e: any) => e.emailAddress) || [];
      return { 
        id: u.id,
        emails,
        primaryEmail: u.primaryEmail,
        username: u.username
      };
    });
    
    debugLog(`⛔ '${email}' için kullanıcı bulunamadı. Mevcut kullanıcılar:`, userEmailData);
    return null;
  } catch (error) {
    errorLog(`❌ findUserByEmail HATA: '${email}' araması başarısız oldu`, error);
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
          
          // Tüm metadata ve bağlantılı bilgileri logla
          debugLog('📦 Checkout Session Metadata:', session.metadata);
          debugLog('👤 Checkout Session Customer:', session.customer);
          debugLog('📧 Checkout Session Customer Email:', session.customer_email);
          debugLog('🔄 Checkout Session Mode:', session.mode);
          
          // Kullanıcı ID'sini metadata'dan al
          const userId = session.metadata?.userId;
          
          // Eğer metadata'da userId yoksa
          if (!userId) {
            errorLog('❌ Checkout session metadata kullanıcı ID içermiyor!', session);
            
            // Customer email ile kullanıcıyı bulmayı dene
            if (session.customer_email) {
              debugLog(`📧 Müşteri email ile kullanıcı aranıyor: ${session.customer_email}`);
              const userFromEmail = await findUserByEmail(session.customer_email);
              
              if (userFromEmail) {
                debugLog(`✅ Email ile kullanıcı bulundu: ${userFromEmail.id}`);
                
                // İşleme devam et
                await processCheckoutSessionWithUser(userFromEmail.id, session);
                break;
              } else {
                errorLog(`❌ Email (${session.customer_email}) ile kullanıcı bulunamadı!`);
              }
            }
            
            // Customer ID ile müşteri bilgilerini alma ve onun emailini kullanmayı dene
            if (session.customer) {
              try {
                debugLog(`🔍 Customer ID'den müşteri bilgileri alınıyor: ${session.customer}`);
                const customer = await stripe.customers.retrieve(session.customer as string) as any;
                
                if (customer.email) {
                  debugLog(`📧 Stripe müşteri emaili ile kullanıcı aranıyor: ${customer.email}`);
                  const userFromCustomer = await findUserByEmail(customer.email);
                  
                  if (userFromCustomer) {
                    debugLog(`✅ Stripe müşteri emaili ile kullanıcı bulundu: ${userFromCustomer.id}`);
                    
                    // İşleme devam et
                    await processCheckoutSessionWithUser(userFromCustomer.id, session);
                    break;
                  } else {
                    errorLog(`❌ Stripe müşteri emaili (${customer.email}) ile kullanıcı bulunamadı!`);
                  }
                } else {
                  errorLog(`❌ Stripe müşteri email bilgisi bulunamadı! Customer ID: ${session.customer}`);
                }
              } catch (customerError: any) {
                errorLog(`❌ Müşteri bilgileri alınamadı: ${session.customer}`, customerError);
              }
            }
            
            // Hiçbir şekilde kullanıcı bulunamadıysa hata ver
            throw new Error('Checkout session için kullanıcı bulunamadı!');
          }
          
          debugLog(`👤 Checkout tamamlandı - userId: ${userId}`);
          
          // Stripe'dan abonelik bilgilerini al
          if (!session.subscription) {
            errorLog('❌ Checkout session abonelik ID içermiyor!', session);
            throw new Error('Missing subscription in session');
          }
          
          await processCheckoutSessionWithUser(userId, session);
          break;
        }
        
        case 'customer.subscription.created': {
          // Yeni abonelik oluşturulduğunda işle
          const subscription = event.data.object as any;
          const subscriptionId = subscription.id;
          const customerId = subscription.customer;
          
          debugLog(`🆕 Yeni abonelik oluşturuldu - ID: ${subscriptionId}, Customer: ${customerId}`);
          debugLog('📝 Abonelik detayları:', {
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          });
          
          try {
            // Stripe'dan müşteri bilgilerini al
            debugLog(`🔍 Müşteri bilgileri alınıyor: ${customerId}`);
            const customer = await stripe.customers.retrieve(customerId) as any;
            debugLog(`📧 Müşteri email: ${customer.email}`);
            debugLog('📦 Müşteri metadata:', customer.metadata);
            
            // Önce metadata'da userId kontrolü yap
            let userId = null;
            if (customer.metadata && customer.metadata.userId) {
              userId = customer.metadata.userId;
              debugLog(`👤 Müşteri metadata'sında userId bulundu: ${userId}`);
              
              // Gerçekten Clerk'te bu ID ile kullanıcı var mı kontrol et
              try {
                const user = await getClerkUserById(userId);
                if (!user) {
                  debugLog(`⚠️ Metadata'daki userId (${userId}) geçerli bir kullanıcıya ait değil!`);
                  userId = null; // Invalid userId, email ile arama yapmaya devam et
                }
              } catch (error) {
                errorLog(`❌ Kullanıcı ID doğrulama hatası (${userId}):`, error);
                userId = null; // Hata durumunda email ile arama yap
              }
            }
            
            // UserId yoksa veya geçersizse email ile aramaya devam et
            if (!userId) {
              // Customer email'i kullanarak Clerk'te kullanıcıyı bul
              if (!customer.email) {
                errorLog(`❌ Müşterinin email bilgisi yok! Customer ID: ${customerId}`);
                return NextResponse.json(
                  { error: `Customer has no email: ${customerId}` },
                  { status: 400 }
                );
              }
              
              debugLog(`🔍 Müşteri emaili ile kullanıcı aranıyor: ${customer.email}`);
              const user = await findUserByEmail(customer.email);
              
              if (user) {
                // Kullanıcı bulundu, userId'yi ayarla
                userId = user.id;
                debugLog(`✅ Email ile kullanıcı bulundu: ${userId}`);
              } else {
                // Kullanıcı bulunamadı
                errorLog(`❌ Kullanıcı bulunamadı: ${customer.email}`);
                return NextResponse.json(
                  { error: `User not found for email: ${customer.email}` },
                  { status: 404 }
                );
              }
            }
            
            // Abonelik işlemlerini yap
            if (userId) {
              const updateSuccess = await processSubscriptionForUser(userId, subscription);
              debugLog(`${updateSuccess ? '✅' : '❌'} Abonelik işleme sonucu: ${updateSuccess ? 'Başarılı' : 'Başarısız'}`);
              return NextResponse.json({ success: updateSuccess });
            }
          } catch (customerError: any) {
            errorLog("❌ Müşteri bilgileri alınırken hata:", customerError);
            return NextResponse.json(
              { error: `Error retrieving customer: ${customerError.message}` },
              { status: 500 }
            );
          }
          break;
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

// Checkout session işleme fonksiyonu
async function processCheckoutSessionWithUser(userId: string, session: Stripe.Checkout.Session) {
  try {
    debugLog(`⚙️ Checkout session işleniyor - userId: ${userId}, sessionId: ${session.id}`);
    
    // Subscription ID'yi al
    const subscriptionId = session.subscription as string;
    
    // Stripe'dan abonelik bilgilerini getir
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
    debugLog('📄 Abonelik bilgileri alındı', { 
      id: subscription.id, 
      status: subscription.status,
      priceId: subscription.items?.data?.[0]?.price?.id 
    });
    
    // Planı belirlemek için price ID'yi al
    const priceId = subscription.items.data[0].price.id;
    
    // Fiyat ID'ye göre plan tipini belirle
    let planType = 'premium'; // varsayılan olarak premium
    
    // Fiyat ID'ye göre planı belirle - gerekirse ayarla
    const basicMonthlyPriceId = process.env.PRICE_ID_BASIC_MONTHLY;
    const basicYearlyPriceId = process.env.PRICE_ID_BASIC_YEARLY;
    
    debugLog('💲 Fiyat karşılaştırması:', {
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
    debugLog(`📝 Kullanıcı ${userId} için abonelik bilgileri güncelleniyor:`, subscriptionDetails);
    
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
      debugLog(`✅ ${subscription.id} aboneliği ${userId} kullanıcısı için başarıyla kaydedildi`);
      return true;
    } else {
      errorLog(`❌ ${subscription.id} aboneliği ${userId} kullanıcısı için kaydedilemedi`);
      throw new Error('Clerk user metadata update failed');
    }
  } catch (error) {
    errorLog(`❌ Checkout session işleme hatası:`, error);
    throw error;
  }
}

// processSubscriptionForUser fonksiyonunu güncelle
async function processSubscriptionForUser(userId: string, subscription: any): Promise<boolean> {
  try {
    debugLog(`⚙️ Kullanıcı için abonelik işleniyor - userId: ${userId}, subscriptionId: ${subscription.id}`);
    
    // Planı belirle
    const priceId = subscription.items.data[0].price.id;
    let planType = 'premium'; // varsayılan olarak premium
    
    debugLog('💲 Fiyat ID ve plan tipi:', { priceId, defaultType: 'premium' });
    
    // Fiyat ID'ye göre planı belirle - gerekirse ayarla
    const basicMonthlyPriceId = process.env.PRICE_ID_BASIC_MONTHLY;
    const basicYearlyPriceId = process.env.PRICE_ID_BASIC_YEARLY;
    
    debugLog('💲 Fiyat karşılaştırması:', {
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
    
    debugLog('📝 Oluşturulan abonelik detayları:', subscriptionDetails);
    
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
      debugLog(`✅ Abonelik ${subscription.id} kullanıcısı ${userId} için kaydedildi`);
      return true;
    } else {
      errorLog(`❌ Abonelik ${subscription.id} kullanıcı ${userId} için kaydedilemedi`);
      return false;
    }
  } catch (error) {
    errorLog("❌ Abonelik işleme hatası:", error);
    return false;
  }
} 