import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';

// Bu endpoint'in dinamik olduğunu belirt - statik oluşturma denemesi yapılmasın
export const dynamic = 'force-dynamic';

/**
 * Premium abonelik durumunu kontrol eder
 */
export async function GET(req: NextRequest) {
  try {
    // Auth header'dan token bilgilerini al
    const authHeader = req.headers.get('authorization');
    let userId = null;
    
    // Auth header varsa parse et
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        // Token doğrulama işlemi buraya eklenebilir
        // Bu örnek için basit bir yaklaşım kullanıyoruz
        const tokenData = JSON.parse(atob(token.split('.')[1]));
        userId = tokenData.sub || null;
      } catch (tokenError) {
        console.error('Token parsing error:', tokenError);
      }
    }
    
    // Oturum açmış kullanıcıyı kontrol et
    const user = await currentUser();
    
    // Kullanıcı kimliğini belirle
    userId = user?.id || userId;
    
    // Kullanıcı oturum açmamışsa premium değil
    if (!userId) {
      return NextResponse.json({ isPremium: false });
    }
    
    // Kullanıcının meta verilerinde premium kontrolü
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
    } else if (userId) {
      // Eğer currentUser çalışmadıysa, Clerk API ile kullanıcıyı al
      try {
        const clerk = await clerkClient();
        const userDetails = await clerk.users.getUser(userId);
        
        if (
          userDetails.publicMetadata?.subscriptionStatus === 'active' ||
          userDetails.publicMetadata?.isPremium === true
        ) {
          // Premium durumu çerezlere kaydet
          console.log('Premium durum çerezlere kaydediliyor...');
          await setPremiumCookies();
          
          return NextResponse.json({ isPremium: true });
        }
      } catch (clerkError) {
        console.error('Clerk API error:', clerkError);
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