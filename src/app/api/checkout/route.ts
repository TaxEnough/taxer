import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, currentUser } from '@clerk/nextjs/server';
import { PRICES } from '@/lib/stripe';

// Debug loglama fonksiyonu
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] CHECKOUT DEBUG: ${message}`);
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
  console.error(`[${timestamp}] CHECKOUT ERROR: ${message}`);
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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Content-Type': 'application/json'
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new Response(null, { 
    status: 204, // No content
    headers: corsHeaders
  });
}

// GET method to also handle browser navigation
export async function GET() {
  return new Response(
    JSON.stringify({ error: 'Please use POST method to create checkout session' }),
    { status: 405, headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  try {
    debugLog('POST isteği alındı', { url: req.url });
    
    // Get authenticated user from Clerk
    const session = await auth();
    const user = await currentUser();
    
    // İstek verilerini al
    let requestData;
    try {
      requestData = await req.json();
      debugLog('İstek verileri başarıyla alındı', requestData);
    } catch (parseError) {
      errorLog('İstek verisi JSON olarak çözümlenemedi', parseError);
      return new Response(
        JSON.stringify({ error: 'Geçersiz istek verisi' }),
        { status: 400, headers: corsHeaders }
      );
    }
    
    const { priceId, successUrl, cancelUrl, email: requestEmail } = requestData;
    
    // Kullanıcı ID'sini önce session'dan, sonra manuel olarak alma
    let userId = session?.userId;
    let userEmail = '';

    if (!userId) {
      debugLog('Clerk session üzerinden kullanıcı ID bulunamadı, alternatif yöntemler deneniyor');
      
      // Kullanıcı email'ini Clerk'ten almayı dene
      if (user) {
        const primaryEmailAddress = user.emailAddresses?.find(email => email.id === user.primaryEmailAddressId);
        userEmail = primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || '';
        
        if (userEmail) {
          debugLog(`Email bulundu: ${userEmail}, ödeme sayfası oluşturuluyor`);
        } else {
          debugLog('Kullanıcı email bilgisi bulunamadı');
        }
      }
      
      // Gelen istekten email alma
      if (!userEmail) {
        userEmail = requestEmail || '';
        if (userEmail) {
          debugLog(`Request body'den email bulundu: ${userEmail}`);
        }
      }

      // Hala email bulunamadıysa ve kimlik doğrulaması yapılamadıysa hata ver
      if (!userEmail) {
        errorLog('Kullanıcı kimliği veya email bulunamadı', { session });
        return new Response(
          JSON.stringify({ error: 'Lütfen giriş yapın veya email adresinizi girin' }),
          { status: 401, headers: corsHeaders }
        );
      }
    } else {
      // Kullanıcı bilgisini alıp email'i çıkar
      const primaryEmailAddress = user?.emailAddresses?.find(email => email.id === user.primaryEmailAddressId);
      userEmail = primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || '';
    }

    debugLog('İşlemde kullanılacak bilgiler:', {
      userId: userId || 'N/A',
      email: userEmail,
      username: user?.username || 'N/A',
      fullName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'N/A'
    });
    
    debugLog('Checkout isteği verileri:', { priceId, successUrl, cancelUrl, userId, userEmail });

    // PriceId kontrolü
    if (!priceId) {
      errorLog('Eksik priceId');
      return new Response(
        JSON.stringify({ error: 'Fiyat ID gerekli' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Geçerli fiyat ID'lerini kontrol et
    const validPriceIds = [
      PRICES.BASIC.MONTHLY.id,
      PRICES.BASIC.YEARLY.id,
      PRICES.PREMIUM.MONTHLY.id,
      PRICES.PREMIUM.YEARLY.id
    ];

    if (!validPriceIds.includes(priceId)) {
      errorLog('Geçersiz fiyat ID:', { priceId, validPriceIds });
      return new Response(
        JSON.stringify({ error: 'Geçersiz fiyat ID' }),
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      // Stripe ödeme oturumu oluştur
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-03-31.basil'
      });
      
      // Kullanıcı bilgilerini metadata olarak hazırla
      const userMetadata = {
        userId: userId || '',
        email: userEmail,
        username: user?.username || '',
        name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : ''
      };
      
      debugLog('Stripe için hazırlanan kullanıcı metadata:', userMetadata);
      
      // Checkout session oluştur
      const checkoutSession = await stripe.checkout.sessions.create({
        customer_email: userEmail,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/profile?tab=subscription&status=success&userId=${userId || ''}&email=${encodeURIComponent(userEmail)}`,
        cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?status=cancelled`,
        metadata: userMetadata,
        subscription_data: {
          metadata: userMetadata,
        },
        allow_promotion_codes: true,
      });
      
      debugLog('Ödeme oturumu oluşturuldu:', { 
        sessionId: checkoutSession.id,
        url: checkoutSession.url,
        metadata: checkoutSession.metadata
      });

      return new Response(
        JSON.stringify({ 
          url: checkoutSession.url,
          sessionId: checkoutSession.id,
          email: userEmail,
          success: true,
          message: "Ödeme sayfası oluşturuldu. Başarılı ödeme sonrası 7 günlük deneme süresi başlayacak."
        }), 
        { status: 200, headers: corsHeaders }
      );
    } catch (stripeError: any) {
      errorLog('Stripe hatası:', stripeError);
      return new Response(
        JSON.stringify({ error: `Stripe hatası: ${stripeError.message}` }),
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error: any) {
    errorLog('Ödeme oturumu oluşturma hatası:', error);
    return new Response(
      JSON.stringify({ error: `Bir şeyler yanlış gitti: ${error.message}` }),
      { status: 500, headers: corsHeaders }
    );
  }
} 