import { cookies } from 'next/headers';

/**
 * Kullanıcının abonelik durumunu kontrol eder
 * 
 * @param userId İsteğe bağlı, belirli bir kullanıcı ID'si için kontrol yapar
 * @returns Aktif abonelik durumu
 */
export async function getUserSubscriptionStatus(userId?: string): Promise<{
  isSubscribed: boolean;
  plan?: string;
  periodEnd?: Date | null;
}> {
  try {
    // Çerezlerden kontrol et
    const cookieStore = cookies();
    const subscriptionStatus = cookieStore.get('subscription_status')?.value;
    const premiumFlag = cookieStore.get('isPremium')?.value;
    
    // Eğer çerezler aktif abonelik gösteriyorsa
    if (subscriptionStatus === 'active' || premiumFlag === 'true') {
      return {
        isSubscribed: true,
        plan: cookieStore.get('subscription_plan')?.value || 'premium',
        periodEnd: null // Şu aşamada ihtiyaç olmadığı için null bırakıyoruz
      };
    }
    
    // Çerezlerde yoksa API'dan kontrol edebiliriz (gelecek entegrasyon için)
    // Bu noktada Stripe veya veritabanı kontrolü yapılabilir
    
    // Şimdilik basit olarak false döndürelim
    return { isSubscribed: false };
  } catch (error) {
    console.error("Abonelik durumu kontrol edilirken hata:", error);
    return { isSubscribed: false };
  }
}

/**
 * Çerezleri kontrol ederek premium erişimi olup olmadığını kontrol eder
 * 
 * @param cookieString Çerez string değeri
 * @returns Kullanıcının premium erişimi var mı
 */
export function hasPremiumAccess(cookieString: string): boolean {
  // Çerezlerde abonelik durumunu kontrol et
  const hasSubscriptionCookie = 
    cookieString.includes('subscription_status=active') ||
    cookieString.includes('isPremium=true') ||
    cookieString.includes('premium=true') ||
    cookieString.includes('isSubscribed=true');
    
  // Geliştirme ortamında otomatik erişim verme - kullanıcının gerçekten premium olmasını kontrol et
  // if (process.env.NODE_ENV === 'development') {
  //   return true;
  // }
  
  return hasSubscriptionCookie;
}

/**
 * Başarılı ödeme sonrasında kullanıcı için premium erişim çerezlerini ayarlar
 * 
 * @param userId Kullanıcı ID'si
 * @param plan Abonelik planı
 * @param response NextResponse nesnesi
 */
export function setPremiumCookies(
  userId: string, 
  plan: string = 'premium',
  response: Response
): Response {
  // Yeni Response nesnesi oluştur
  const headers = new Headers(response.headers);
  
  // Çerezleri ayarla (6 aylık süreyle)
  const maxAge = 60 * 60 * 24 * 180; // 180 gün
  
  // Abonelik durum çerezleri
  headers.append('Set-Cookie', `subscription_status=active; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`);
  headers.append('Set-Cookie', `isPremium=true; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`);
  headers.append('Set-Cookie', `subscription_plan=${plan}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`);
  
  // Yeni response döndür
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
} 