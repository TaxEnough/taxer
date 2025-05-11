import { NextResponse, NextRequest } from 'next/server';
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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS request (preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user from Clerk
    const session = await auth();
    const user = await currentUser();
    
    if (!session || !session.userId) {
      errorLog('Kullanıcı kimliği doğrulanamadı', { session });
      return NextResponse.json(
        { error: 'Lütfen önce giriş yapın' },
        { status: 401, headers: corsHeaders }
      );
    }

    debugLog('Clerk kullanıcı bilgileri:', {
      userId: session.userId,
      emailAddresses: user?.emailAddresses,
      username: user?.username,
      firstName: user?.firstName,
      lastName: user?.lastName
    });

    // İstek verilerini al
    const { priceId, successUrl, cancelUrl } = await req.json();
    debugLog('Checkout isteği verileri:', { priceId, successUrl, cancelUrl, userId: session.userId });

    // PriceId kontrolü
    if (!priceId) {
      errorLog('Eksik priceId');
      return NextResponse.json(
        { error: 'Fiyat ID gerekli' },
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
      return NextResponse.json(
        { error: 'Geçersiz fiyat ID' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Kullanıcı email'ini Clerk'ten al
    const primaryEmailAddress = user?.emailAddresses?.find(email => email.id === user.primaryEmailAddressId);
    const userEmail = primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
    
    // Email bulunamazsa hata ver
    if (!userEmail) {
      errorLog('Kullanıcı emaili bulunamadı', { user });
      return NextResponse.json(
        { error: 'Kullanıcı bilgileri eksik. Lütfen hesap bilgilerinizi güncelleyin.' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    debugLog('Ödeme için kullanılacak bilgiler:', { 
      email: userEmail, 
      userId: session.userId,
      username: user?.username,
      fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
    });

    try {
      // Stripe ödeme oturumu oluştur
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-03-31.basil'
      });
      
      // Kullanıcı bilgilerini metadata olarak hazırla
      const userMetadata = {
        userId: session.userId,
        email: userEmail,
        username: user?.username || '',
        name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
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
        success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/profile?tab=subscription&status=success&userId=${session.userId}`,
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

      return NextResponse.json({ 
        url: checkoutSession.url,
        sessionId: checkoutSession.id
      }, { headers: corsHeaders });
    } catch (stripeError: any) {
      errorLog('Stripe hatası:', stripeError);
      return NextResponse.json(
        { error: `Stripe hatası: ${stripeError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error: any) {
    errorLog('Ödeme oturumu oluşturma hatası:', error);
    return NextResponse.json(
      { error: `Bir şeyler yanlış gitti: ${error.message}` },
      { status: 500, headers: corsHeaders }
    );
  }
} 