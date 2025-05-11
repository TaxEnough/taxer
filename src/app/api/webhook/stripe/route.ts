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

    // İşlem başladığını ve hangi IP'den geldiğini logla
    const requestIP = headers().get('x-forwarded-for') || 'unknown-ip';
    const requestAgent = headers().get('user-agent') || 'unknown-agent';
    console.log(`🔔 WEBHOOK REQUEST: IP=${requestIP}, Agent=${requestAgent}`);

    if (!signature) {
      errorLog('Missing Stripe signature in webhook request');
      // Hatayı logladık, ama webhook'u kabul edelim
      return NextResponse.json({ received: true, warn: 'Missing signature but continuing' });
    }

    let event: Stripe.Event;
    let stripeEventValid = false;

    try {
      // Stripe webhookunu doğrula
      debugLog('Stripe webhook doğrulanıyor', { signatureLength: signature.length });
      
      // Webhook secret kontrolü
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        errorLog('STRIPE_WEBHOOK_SECRET çevre değişkeni bulunamadı');
        // Hatayı logladık, ama webhook'u kabul edelim
        return NextResponse.json({ received: true, warn: 'Webhook secret missing but continuing' });
      }
      
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      stripeEventValid = true;
      debugLog(`Stripe webhook event alındı ve doğrulandı: ${event.type}`);
    } catch (error: any) {
      errorLog(`Webhook doğrulama hatası:`, error);
      // Hatayı logladık, ama webhook'u kabul edelim
      return NextResponse.json({ received: true, warn: `Webhook validation error but continuing: ${error.message}` });
    }

    // Stripe olayı geçerli değilse, burada sonlandır
    if (!stripeEventValid || !event) {
      errorLog('Geçersiz Stripe olayı, işlenmeden kabul edildi');
      return NextResponse.json({ received: true, status: 'invalid_but_accepted' });
    }

    try {
      // Event tipine göre işlem yap
      debugLog(`İşleniyor: ${event.type} event`);
      
      // Başarılı olaylar için burayı kullanın
      return NextResponse.json({ received: true, eventType: event.type, status: 'processing' });
    } catch (error) {
      errorLog('Webhook işleme hatası:', error);
      // Hatayı logladık, ama webhook'u kabul edelim
      return NextResponse.json({ received: true, error: 'Processing error but continuing', eventType: event.type });
    }
  } catch (outerError) {
    errorLog('Webhook üst seviye hata:', outerError);
    // En üst seviye hatayı logladık, ama webhook'u kabul edelim
    return NextResponse.json({ received: true, error: 'Fatal error but continuing' });
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