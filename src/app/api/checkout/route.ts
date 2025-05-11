import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import { auth, currentUser } from '@clerk/nextjs/server';
import { PRICES } from '@/lib/stripe';

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
    const session = auth();
    const user = await currentUser();
    
    if (!session || !session.userId) {
      console.error('Kullanıcı kimliği doğrulanamadı');
      return NextResponse.json(
        { error: 'Lütfen önce giriş yapın' },
        { status: 401, headers: corsHeaders }
      );
    }

    // İstek verilerini al
    const { priceId, successUrl, cancelUrl } = await req.json();
    console.log('Checkout isteği verileri:', { priceId, successUrl, cancelUrl, userId: session.userId });

    // PriceId kontrolü
    if (!priceId) {
      console.error('Eksik priceId');
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
      console.error('Geçersiz fiyat ID:', priceId);
      console.log('Geçerli fiyat ID\'leri:', validPriceIds);
      return NextResponse.json(
        { error: 'Geçersiz fiyat ID' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    // Kullanıcı email'ini Clerk'ten al
    const userEmail = user?.emailAddresses[0]?.emailAddress;
    
    // Email bulunamazsa hata ver
    if (!userEmail) {
      console.error('Kullanıcı emaili bulunamadı');
      return NextResponse.json(
        { error: 'Kullanıcı bilgileri eksik. Lütfen hesap bilgilerinizi güncelleyin.' },
        { status: 400, headers: corsHeaders }
      );
    }
    
    console.log('Ödeme için kullanılacak email:', userEmail);

    try {
      // Stripe ödeme oturumu oluştur
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-03-31.basil'
      });
      
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
        success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/profile?tab=subscription&status=success`,
        cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?status=cancelled`,
        metadata: {
          userId: session.userId,
        },
        customer_creation: 'always',
        subscription_data: {
          metadata: {
            userId: session.userId,
          },
        },
        allow_promotion_codes: true,
      });
      
      console.log('Ödeme oturumu oluşturuldu:', checkoutSession.id);
      console.log('Checkout URL:', checkoutSession.url);

      return NextResponse.json({ 
        url: checkoutSession.url,
        sessionId: checkoutSession.id
      }, { headers: corsHeaders });
    } catch (stripeError: any) {
      console.error('Stripe hatası:', stripeError.message);
      return NextResponse.json(
        { error: `Stripe hatası: ${stripeError.message}` },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error: any) {
    console.error('Ödeme oturumu oluşturma hatası:', error);
    console.error('Hata detayları:', error.message);
    return NextResponse.json(
      { error: `Bir şeyler yanlış gitti: ${error.message}` },
      { status: 500, headers: corsHeaders }
    );
  }
} 