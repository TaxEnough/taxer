import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { PRICES } from '@/lib/stripe';

// Debug loglama fonksiyonu
function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] PAYMENT DEBUG: ${message}`);
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
  console.error(`[${timestamp}] PAYMENT ERROR: ${message}`);
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new Response(null, { 
    status: 204, // No content
    headers: corsHeaders
  });
}

export async function POST(req: NextRequest) {
  try {
    debugLog('POST isteği alındı', { url: req.url });
    
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
    
    const { priceId, successUrl, cancelUrl, email: requestEmail, userId: requestUserId } = requestData;
    
    // Email bilgisini hazırla
    let userEmail = requestEmail || '';
    let userId = requestUserId || '';

    // Email kontrolü
    if (!userEmail) {
      errorLog('Kullanıcı email adresi bulunamadı');
      return new Response(
        JSON.stringify({ error: 'Ödeme için email adresi gerekli' }),
        { status: 400, headers: corsHeaders }
      );
    }

    debugLog('İşlemde kullanılacak bilgiler:', {
      userId: userId || 'Belirtilmedi',
      email: userEmail
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
        email: userEmail
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