import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';

/**
 * Premium abonelik durumunu kontrol eder
 */
export async function GET(req: NextRequest) {
  try {
    // Clerk ile oturum bilgilerini al
    const auth = getAuth(req);
    const userId = auth.userId;
    
    // Kullanıcı oturum açmamışsa premium değil
    if (!userId) {
      return NextResponse.json({ isPremium: false });
    }
    
    // Kullanıcı meta verilerini kontrol et
    const user = await currentUser();
    
    if (user) {
      // Kullanıcının meta verilerinde premium kontrolü
      if (
        user.publicMetadata?.subscriptionStatus === 'active' ||
        user.publicMetadata?.isPremium === true
      ) {
        // Premium durumu çerezlere kaydet
        console.log('Premium durum çerezlere kaydediliyor...');
        await setPremiumCookies();
        
        return NextResponse.json({ isPremium: true });
      }
    }
    
    // Çerez kontrolü
    const cookieStore = cookies();
    const subscriptionStatus = cookieStore.get('subscription_status')?.value;
    const premiumFlag = cookieStore.get('isPremium')?.value;
    
    if (subscriptionStatus === 'active' || premiumFlag === 'true') {
      return NextResponse.json({ isPremium: true });
    }
    
    // Hiçbir koşul sağlanmadıysa premium değil
    return NextResponse.json({ isPremium: false });
  } catch (error) {
    console.error('Premium kontrol hatası:', error);
    return NextResponse.json({ isPremium: false, error: 'Kontrol sırasında hata oluştu' });
  }
}

/**
 * Premium durumu kaydeden çerezleri ayarlar
 */
async function setPremiumCookies() {
  const cookieStore = cookies();
  
  // 30 günlük süre - 2592000000 milisaniye
  const expires = new Date(Date.now() + 2592000000);
  
  // HttpOnly olmayan çerezler ayarla - client tarafından da erişilebilir
  cookieStore.set('isPremium', 'true', { 
    expires,
    path: '/',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  
  cookieStore.set('subscription_status', 'active', { 
    expires,
    path: '/',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
} 