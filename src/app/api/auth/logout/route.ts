import { NextResponse } from 'next/server';
import { removeAuthCookieOnServer } from '@/lib/auth-server';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  console.log('POST /api/auth/logout endpoint çağrıldı');
  
  try {
    // Server tarafında çerezi temizle
    removeAuthCookieOnServer();
    
    // Başarılı yanıt döndür
    const response = NextResponse.json({ success: true });
    
    // Cookie'yi açık bir şekilde temizle
    response.cookies.set({
      name: COOKIE_NAME,
      value: '',
      expires: new Date(0), // Geçmişte bir tarih
      path: '/',
      maxAge: 0,
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    
    // Cache başlıklarını temizle
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    console.log('Çıkış başarılı, çerez temizlendi');
    
    return response;
  } catch (error) {
    console.error('Çıkış yaparken hata oluştu:', error);
    return NextResponse.json(
      { error: 'Çıkış yapılırken bir hata oluştu' },
      { status: 500 }
    );
  }
} 