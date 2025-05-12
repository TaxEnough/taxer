import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { hasPremiumAccess } from '@/lib/subscription-utils';

/**
 * Kullanıcıya premium erişim çerezleri ayarlayan API endpoint'i
 * Bu endpoint Stripe başarılı ödeme sonrası veya manuel ödeme aktivasyonu için kullanılabilir
 */
export async function POST(req: NextRequest) {
  try {
    const headersList = headers();
    const origin = headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || '';
    const cookieHeader = headersList.get('cookie') || '';
    
    // Log işlemi
    console.log(`[Subscription API] Activation request received`);
    
    // İstek verisini al
    const requestData = await req.json();
    const { userId, email, plan = 'premium', source = 'api' } = requestData;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'UserId gerekli' },
        { status: 400 }
      );
    }
    
    console.log(`[Subscription API] Activating premium for user: ${userId}, plan: ${plan}, source: ${source}`);
    
    // 6 aylık (180 gün) süre için çerezleri hazırla
    const maxAge = 60 * 60 * 24 * 180; // 180 gün
    const expiryDate = new Date(Date.now() + maxAge * 1000).toUTCString();
    
    // Yanıt oluştur
    const response = NextResponse.json({
      success: true,
      message: 'Premium erişim aktifleştirildi',
      userId,
      plan,
      expires: new Date(Date.now() + maxAge * 1000).toISOString()
    });
    
    // Abonelik durum çerezlerini ekle
    response.headers.append('Set-Cookie', `subscription_status=active; Path=/; Max-Age=${maxAge}; Expires=${expiryDate}; SameSite=Lax; Secure`);
    response.headers.append('Set-Cookie', `isPremium=true; Path=/; Max-Age=${maxAge}; Expires=${expiryDate}; SameSite=Lax; Secure`);
    response.headers.append('Set-Cookie', `subscription_plan=${plan}; Path=/; Max-Age=${maxAge}; Expires=${expiryDate}; SameSite=Lax; Secure`);
    
    // İsteğe bağlı olarak kullanıcı bilgisi çerezi
    if (email) {
      response.headers.append('Set-Cookie', `user_email=${email}; Path=/; Max-Age=${maxAge}; Expires=${expiryDate}; SameSite=Lax; Secure`);
    }
    
    return response;
  } catch (error: any) {
    console.error('[Subscription API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}

/**
 * Premium erişim durumunu kontrol eden endpoint
 */
export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const isPremium = hasPremiumAccess(cookieHeader);
    
    return NextResponse.json({
      isPremium,
      status: isPremium ? 'active' : 'inactive'
    });
  } catch (error: any) {
    console.error('[Subscription API] Status check error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Bir hata oluştu' },
      { status: 500 }
    );
  }
} 