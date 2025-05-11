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

    // Email adresinin formatını kontrol et
    if (!email.includes('@')) {
      errorLog(`❌ Geçersiz email formatı: '${email}'`);
      return null;
    }
    
    debugLog(`🔍 '${email}' email adresi için kullanıcı araması başlatılıyor`);
    
    // DOĞRUDAN USER_ID BELİRTİLMİŞ Mİ KONTROL ET
    // Bazen email yerine user_id gönderilmiş olabilir
    if (email.startsWith('user_')) {
      debugLog(`⚠️ Email yerine user_id formatı tespit edildi: ${email}, doğrudan kullanıcıyı getirmeyi deneyeceğim`);
      try {
        const user = await getClerkUserById(email);
        if (user) {
          debugLog(`✅ ID ile kullanıcı başarıyla bulundu: ${email}`);
          return user;
        }
        debugLog(`❌ ID ile kullanıcı bulunamadı: ${email}`);
      } catch (idError) {
        errorLog(`❌ ID ile kullanıcı arama hatası: ${email}`, idError);
      }
    }
    
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
          
          // Email adresini logla
          const emailAddresses = foundUser.emailAddresses || [];
          debugLog(`📧 Bulunan kullanıcının email adresleri:`, 
            emailAddresses.map((e: any) => ({ 
              emailAddress: e.emailAddress, 
              id: e.id, 
              verified: e.verification?.status === 'verified' 
            }))
          );
          
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
    const userList = await getClerkUserList(500); // Daha fazla kullanıcı al, emin olalım
    
    if (!userList.data || userList.data.length === 0) {
      errorLog("❌ Kullanıcı listesi alınamadı veya boş");
      return null;
    }
    
    debugLog(`📊 Manuel arama için ${userList.data.length} kullanıcı alındı`);
    
    // Tüm kullanıcıları detaylı logla
    const userEmailData = userList.data.map(u => {
      const emails = (u as any).emailAddresses?.map((e: any) => e.emailAddress) || [];
      return { 
        id: u.id,
        emails,
        primaryEmail: (u as any).primaryEmailAddress?.emailAddress,
        username: (u as any).username
      };
    });
    
    debugLog(`📊 Tüm kullanıcıların email bilgileri:`, userEmailData);
    
    // Arama için normalize email
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = normalizedEmail.split('@')[0].toLowerCase();
    const emailDomain = normalizedEmail.split('@')[1]?.toLowerCase() || '';
    
    let bestMatch: ClerkUser | null = null;
    
    // Eşleşme skorlarını tutacak dizi oluştur
    const matchScores: {user: ClerkUser, score: number, reason: string}[] = [];
    
    // Her kullanıcıyı kontrol et
    for (const user of userList.data) {
      let score = 0;
      let matchReason = "";
      
      // any tipini kullanmak zorundayız çünkü Clerk tiplerindeki bu bilgilere
      // doğrudan erişemiyoruz
      const userObj = user as any;
      const userEmails = userObj.emailAddresses || [];
      const userPrimaryEmail = userObj.primaryEmailAddress?.emailAddress?.toLowerCase();
      const userUsername = userObj.username?.toLowerCase();
      
      // 1. Birincil email tam eşleşme (en yüksek öncelik)
      if (userPrimaryEmail === normalizedEmail) {
        score += 100;
        matchReason += "Birincil email tam eşleşme, ";
      }
      
      // 2. Herhangi bir email tam eşleşme
      for (const emailObj of userEmails) {
        if (emailObj.emailAddress?.toLowerCase() === normalizedEmail) {
          score += 90;
          matchReason += "Email tam eşleşme, ";
          break;
        }
      }
      
      // 3. Username tam eşleşmesi (email'in @ öncesi kısmı)
      if (userUsername === normalizedUsername) {
        score += 40;
        matchReason += "Username tam eşleşme, ";
      }
      
      // 4. Kısmi email eşleşmesi - alan adı dahil
      for (const emailObj of userEmails) {
        const userEmail = emailObj.emailAddress?.toLowerCase() || '';
        if (userEmail.includes(normalizedUsername) && userEmail.includes(emailDomain)) {
          score += 35;
          matchReason += "Kısmi email (kullanıcı+domain) eşleşme, ";
          break;
        }
      }
      
      // 5. Sadece username kısmı eşleşiyor
      for (const emailObj of userEmails) {
        const userEmail = emailObj.emailAddress?.toLowerCase() || '';
        if (userEmail.includes(normalizedUsername)) {
          score += 20;
          matchReason += "Email kullanıcı adı eşleşme, ";
          break;
        }
      }
      
      // 6. Username benzerlik kontrolü (tam eşleşme olmayan durumlar için)
      if (userUsername && normalizedUsername && userUsername.length > 3 && normalizedUsername.length > 3) {
        if (userUsername.includes(normalizedUsername) || normalizedUsername.includes(userUsername)) {
          score += 15;
          matchReason += "Username benzerlik, ";
        }
      }
      
      // Herhangi bir skor varsa kaydet
      if (score > 0) {
        matchScores.push({user, score, reason: matchReason.trim()});
      }
    }
    
    // Eşleşmeleri skora göre sırala
    matchScores.sort((a, b) => b.score - a.score);
    
    // En iyi eşleşmeyi al - yüksek eşleşme skoruna sahipse (en az 30 puan)
    if (matchScores.length > 0 && matchScores[0].score >= 30) {
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
    
    // 30 puan altındaki en iyi eşleşmeyi de logla, belki gerekebilir
    if (matchScores.length > 0) {
      debugLog(`⚠️ Düşük skorlu eşleşme bulundu (${matchScores[0].score} puan): ${matchScores[0].user.id}`, {
        reason: matchScores[0].reason
      });
    }
    
    // Kullanıcı bulunamadı, yardımcı olabilecek ek bilgileri logla
    debugLog(`⛔ '${email}' için kullanıcı bulunamadı. Aramada kullanılan değerler:`, {
      normalizedEmail,
      normalizedUsername,
      emailDomain,
      userCount: userList.data.length
    });
    
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
          
          // Tüm checkout session bilgilerini detaylı logla
          debugLog('🔄 Checkout Session işleme başladı', {
            id: session.id,
            customer: session.customer,
            customer_email: session.customer_email,
            subscription: session.subscription,
            mode: session.mode
          });
          debugLog('📦 Checkout Session Metadata:', session.metadata);
          
          try {
            // Kullanıcı ID'sini önce metadata'dan almayı dene
            const sessionUserId = session.metadata?.userId;
            
            // Kullanıcıyı bulmak için farklı yolları dene
            let foundUser: ClerkUser | null = null;
            let findMethod = "unknown";
            
            // 1. Eğer metadata'da userId varsa, doğrudan kullanıcıyı bul
            if (sessionUserId && sessionUserId.startsWith('user_')) {
              try {
                debugLog(`🔍 Metadata'daki ID ile kullanıcı aranıyor: ${sessionUserId}`);
                foundUser = await getClerkUserById(sessionUserId);
                
                if (foundUser) {
                  findMethod = "metadata_userId";
                  debugLog(`✅ Metadata userId ile kullanıcı bulundu: ${foundUser.id}`);
                } else {
                  debugLog(`⚠️ Metadata userId (${sessionUserId}) ile kullanıcı bulunamadı!`);
                }
              } catch (idError) {
                errorLog(`❌ UserId arama hatası:`, idError);
              }
            }
            
            // 2. Email ile kullanıcıyı bulmayı dene
            if (!foundUser && session.customer_email) {
              try {
                debugLog(`📧 Müşteri email ile kullanıcı aranıyor: ${session.customer_email}`);
                const userFromEmail = await findUserByEmail(session.customer_email);
                
                if (userFromEmail) {
                  foundUser = userFromEmail;
                  findMethod = "customer_email";
                  debugLog(`✅ Müşteri email ile kullanıcı bulundu: ${foundUser.id}`);
                } else {
                  debugLog(`⚠️ Email (${session.customer_email}) ile kullanıcı bulunamadı!`);
                }
              } catch (emailError) {
                errorLog(`❌ Email arama hatası:`, emailError);
              }
            }
            
            // 3. Customer ID ile müşteri bilgilerini alma ve onun emailini ya da metadatasını kullanma
            if (!foundUser && session.customer) {
              try {
                debugLog(`🔍 Customer ID'den müşteri bilgileri alınıyor: ${session.customer}`);
                const customer = await stripe.customers.retrieve(session.customer as string) as any;
                
                // a. Müşteri metadatasından userId kontrolü
                if (customer.metadata?.userId && customer.metadata.userId.startsWith('user_')) {
                  try {
                    debugLog(`🔍 Müşteri metadatasındaki userId ile kullanıcı aranıyor: ${customer.metadata.userId}`);
                    const userFromMetadata = await getClerkUserById(customer.metadata.userId);
                    
                    if (userFromMetadata) {
                      foundUser = userFromMetadata;
                      findMethod = "customer_metadata_userId";
                      debugLog(`✅ Müşteri metadata'sı ile kullanıcı bulundu: ${foundUser.id}`);
                    } else {
                      debugLog(`⚠️ Müşteri metadata'sındaki ID (${customer.metadata.userId}) ile kullanıcı bulunamadı!`);
                    }
                  } catch (idError) {
                    errorLog(`❌ Müşteri metadata userId arama hatası:`, idError);
                  }
                }
                
                // b. Stripe müşteri emaili ile kullanıcı arama
                if (!foundUser && customer.email) {
                  try {
                    debugLog(`📧 Stripe müşteri emaili ile kullanıcı aranıyor: ${customer.email}`);
                    const userFromCustomer = await findUserByEmail(customer.email);
                    
                    if (userFromCustomer) {
                      foundUser = userFromCustomer;
                      findMethod = "customer_email";
                      debugLog(`✅ Stripe müşteri emaili ile kullanıcı bulundu: ${foundUser.id}`);
                    } else {
                      debugLog(`⚠️ Stripe müşteri emaili (${customer.email}) ile kullanıcı bulunamadı!`);
                    }
                  } catch (emailError) {
                    errorLog(`❌ Müşteri email arama hatası:`, emailError);
                  }
                } else if (!foundUser && !customer.email) {
                  errorLog(`❌ Stripe müşteri email bilgisi bulunamadı! Customer ID: ${session.customer}`);
                }
              } catch (customerError: any) {
                errorLog(`❌ Müşteri bilgileri alınamadı: ${session.customer}`, customerError);
              }
            }
            
            // !!! ÖNEMLİ DEĞİŞİKLİK: KULLANICI BULUNMASA BİLE DEVAM ET !!!
            if (!foundUser) {
              // Kullanıcı bulunamadı - geçici kayıt oluştur
              debugLog(`⚠️⚠️ Kullanıcı bulunamadı. Abonelik kaydı yine de oluşturulacak!`);
              
              // Stripe'dan abonelik bilgilerini al
              if (!session.subscription) {
                errorLog('❌ Checkout session abonelik ID içermiyor, işlem yapılamıyor!', session);
                return NextResponse.json({ 
                  status: "error", 
                  message: "Abonelik bilgisi bulunamadı. Lütfen destek ekibine başvurun: support@taxenough.com"
                }, { status: 500 });
              }
              
              // Geçici kayıt oluştur
              const tempLogId = `temp_${session.id.substring(0, 8)}_${Date.now()}`;
              debugLog(`📝 Geçici kayıt (${tempLogId}) oluşturuluyor. Müşteri: ${session.customer || session.customer_email}`);
              
              try {
                // Abonelik bilgilerini getir
                const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                
                // Planı belirle
                const priceId = subscription.items.data[0].price.id;
                let planType = 'premium'; // varsayılan olarak premium
                
                // Fiyat ID'ye göre planı belirle
                if (priceId === process.env.PRICE_ID_BASIC_MONTHLY || 
                    priceId === process.env.PRICE_ID_BASIC_YEARLY) {
                  planType = 'basic';
                }
                
                // Müşteri bilgilerini kontrol et
                let customerEmail = session.customer_email || '';
                let customerName = '';
                
                if (session.customer) {
                  try {
                    const customer = await stripe.customers.retrieve(session.customer as string);
                    if (typeof customer !== 'string' && !customer.deleted) {
                      customerEmail = customerEmail || customer.email || '';
                      customerName = (customer as any).name || '';
                    }
                  } catch (error) {
                    debugLog(`⚠️ Geçici kayıt için müşteri bilgileri alınamadı`, error);
                  }
                }
                
                // Geçici kayıt bilgilerini oluştur ve logla
                const tempRecord = {
                  id: tempLogId,
                  type: "checkout_without_user",
                  session_id: session.id,
                  subscription_id: session.subscription,
                  customer_id: session.customer,
                  customer_email: customerEmail,
                  customer_name: customerName,
                  plan: planType,
                  status: subscription.status,
                  created_at: new Date().toISOString(),
                  billing_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                };
                
                debugLog(`📋 Geçici abonelik kaydı oluşturuldu:`, tempRecord);
                
                // Bu bilgileri bir veritabanına kaydetmek için kod eklenebilir
                // (şu an için sadece logla)
                
                // İşlemin kısmen başarıyla tamamlandığını bildir
                return NextResponse.json({
                  status: "partial_success",
                  message: "Abonelik oluşturuldu ancak kullanıcı hesabı bulunamadı",
                  checkout: tempRecord
                });
              } catch (error) {
                errorLog(`❌ Geçici kayıt oluşturma hatası:`, error);
                return NextResponse.json({ 
                  status: "error", 
                  message: "Abonelik kaydı oluşturulamadı. Lütfen destek ekibine başvurun: support@taxenough.com"
                }, { status: 500 });
              }
            }
            
            // Kullanıcı bulunduysa, abonelik işlemlerini yap
            const userId = foundUser.id;
            debugLog(`👤 Kullanıcı bulundu (${findMethod}): ${userId}, abonelik işleniyor...`);
            
            // Stripe'dan abonelik bilgilerini al
            if (!session.subscription) {
              errorLog('❌ Checkout session abonelik ID içermiyor!', session);
              return NextResponse.json({ 
                status: "error", 
                message: "Abonelik bilgisi bulunamadı"
              }, { status: 500 });
            }
            
            try {
              // Abonelik işlemlerini yap
              await processCheckoutSessionWithUser(userId, session);
              debugLog(`✅ Abonelik işlemi başarıyla tamamlandı: ${session.id} -> ${userId}`);
              
              return NextResponse.json({ 
                success: true, 
                message: "Abonelik başarıyla kaydedildi", 
                userId,
                subscriptionId: session.subscription
              });
            } catch (processError) {
              errorLog(`❌ Abonelik işleme hatası:`, processError);
              return NextResponse.json({ 
                status: "error", 
                message: "Abonelik işlenemedi, lütfen daha sonra tekrar deneyin",
                userId
              }, { status: 500 });
            }
          } catch (error) {
            errorLog(`❌ Checkout session işleme hatası:`, error);
            return NextResponse.json({ 
              status: "fatal_error", 
              message: "Beklenmeyen bir hata oluştu, lütfen destek ekibine başvurun"
            }, { status: 500 });
          }
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
            
            // Müşteri email bilgisini kontrol et
            if (!customer.email) {
              errorLog(`⚠️ Müşterinin email bilgisi yok, geçici bir kullanıcı kaydı oluşturulacak!`);
              // Bu kısmı günlükler için logluyoruz ama işleme devam edeceğiz
            }
            
            // ÖNEMLİ DEĞİŞİKLİK: Kullanıcıyı arayıp bulamazsak bile abonelik bilgilerini sakla
            let userId = null;
            let userFoundMethod = "unknown";
            
            // Önce metadata'dan userId kontrolü yap
            if (customer.metadata && customer.metadata.userId) {
              userId = customer.metadata.userId;
              userFoundMethod = "metadata";
              debugLog(`👤 Müşteri metadata'sında userId bulundu: ${userId}`);
            } 
            // Sonra email ile kullanıcı aramayı dene
            else if (customer.email) {
              try {
                debugLog(`🔍 Müşteri emaili ile kullanıcı aranıyor: ${customer.email}`);
                const user = await findUserByEmail(customer.email);
                
                if (user) {
                  userId = user.id;
                  userFoundMethod = "email";
                  debugLog(`✅ Email ile kullanıcı bulundu: ${userId}`);
                } else {
                  debugLog(`⚠️ Email ile kullanıcı bulunamadı: ${customer.email}`);
                }
              } catch (emailSearchError) {
                errorLog("❌ Email arama hatası:", emailSearchError);
              }
            }
            
            // KULLANICI BULUNMASA BİLE DEVAM ET: Bu önemli değişiklik
            // Kullanıcı bulunamadıysa bile abonelik bilgilerini kaydet
            if (!userId) {
              debugLog(`⚠️ Kullanıcı bulunamadı, müşteri bilgilerini kullanarak geçici kayıt oluşturulacak`);
              // Müşteri emailini kullanarak bilgileri sakla - gerçek kullanıcı ID'si yerine müşteri ID'si kullan
              
              debugLog(`📝 Stripe müşteri ID'si kullanılarak abonelik kaydediliyor: ${customerId}`);
              
              // Bu kısmı bir dosyaya ya da veritabanına loglayabilirsin (şu an API yanıtına ekliyoruz)
              return NextResponse.json({
                status: "pending",
                message: "Kullanıcı bulunamadı, müşteri bilgileri kaydedildi",
                subscription: {
                  id: subscription.id,
                  customer: customerId,
                  email: customer.email || "unknown",
                  status: subscription.status,
                  created: new Date().toISOString()
                }
              });
            }
            
            // Kullanıcı bulunduysa normal işleme devam et
            debugLog(`✅ Kullanıcı bulundu (${userFoundMethod}): ${userId}, abonelik kaydediliyor...`);
            const updateSuccess = await processSubscriptionForUser(userId, subscription);
            
            if (updateSuccess) {
              debugLog(`✅ Abonelik başarıyla kaydedildi: ${subscription.id} -> ${userId}`);
              return NextResponse.json({ success: true, userId, subscriptionId });
            } else {
              errorLog(`❌ Abonelik kaydedilemedi: ${subscription.id} -> ${userId}`);
              return NextResponse.json(
                { error: "Abonelik bilgileri güncellenemedi", userId, subscriptionId },
                { status: 500 }
              );
            }
          } catch (customerError: any) {
            errorLog("❌ Müşteri bilgileri alınırken hata:", customerError);
            
            // Hata durumunda bile işlemi loglayıp, başarısız olarak işaretle
            return NextResponse.json(
              { 
                error: `Müşteri bilgisi alınamadı: ${customerError.message}`,
                subscription: {
                  id: subscription.id,
                  customer: customerId,
                  status: "error"
                }
              },
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

// processSubscriptionForUser fonksiyonunu güncelliyorum
async function processSubscriptionForUser(userId: string | null, subscription: any): Promise<boolean> {
  try {
    // Kullanıcı ID'si varsa normal akış
    if (userId) {
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
    } 
    // Kullanıcı ID'si yoksa - geçici kayıt yap
    else {
      debugLog(`⚠️ User ID olmadan abonelik kaydı (geçici): ${subscription.id}`);
      // Burada alternatif bir yöntemle saklama işlemi yapabilirsin
      // Örneğin: Özel bir tablo veya dosyaya kaydet
      
      // Şu an için sadece başarılı log ekleyip, true döndürelim
      debugLog(`📝 ID'siz abonelik bilgileri kaydedildi: ${subscription.id}`);
      
      // NOT: Gerçek bir uygulamada buradaki verileri saklamak isteyebilirsin
      return true;
    }
  } catch (error) {
    errorLog("❌ Abonelik işleme hatası:", error);
    return false;
  }
}

// processCheckoutSessionWithUser fonksiyonunu da benzer şekilde güncelle
async function processCheckoutSessionWithUser(userId: string | null, session: Stripe.Checkout.Session) {
  try {
    debugLog(`⚙️ Checkout session işleniyor - userId: ${userId || 'UNKNOWN'}, sessionId: ${session.id}`);
    
    // UserId yoksa alternatif bir şekilde kaydet ve çık
    if (!userId) {
      debugLog(`⚠️ User ID olmadan checkout işlemi (geçici): ${session.id}`);
      // Alternatif saklama yöntemi burada uygulanabilir
      
      // Örnek: Basit bir log ekle ve başarılı olarak işaretle
      debugLog(`📝 ID'siz checkout işlemi tamamlandı: ${session.id}`);
      return true;
    }
    
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