import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { headers } from 'next/headers';

// API rotasını dinamik olarak işaretliyoruz
export const dynamic = 'force-dynamic';

// Admin e-posta listesi - info.taxenough@gmail.com eklenmiştir
const ADMIN_EMAILS = ['info.taxenough@gmail.com'];

export async function GET(request: NextRequest) {
  console.log('Admin kontrolü API çağrıldı');
  
  try {
    // Token'ı header'dan veya cookie'den al
    const cookieHeader = request.cookies.get('auth-token')?.value;
    const authHeader = request.headers.get('authorization');
    
    console.log('Cookie token:', cookieHeader ? 'var' : 'yok');
    console.log('Auth header:', authHeader ? 'var' : 'yok');
    
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : cookieHeader;
    
    if (!token) {
      console.log('Token bulunamadı, yetkilendirme gerekli hatası döndürülüyor');
      return NextResponse.json({ error: 'Kimlik doğrulama gerekli' }, { status: 401 });
    }
    
    // Token'ı doğrula
    console.log('Token doğrulanıyor...');
    const decodedToken = await verifyAuthToken(token);
    
    if (!decodedToken) {
      console.log('Token geçerli değil, null değer döndü');
      return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
    }
    
    console.log('Token doğrulandı, email:', decodedToken.email || 'Email bilgisi yok');
    
    if (!decodedToken.email) {
      console.log('Token geçerli ancak email bilgisi yok');
      return NextResponse.json({ error: 'Geçersiz token: Email bilgisi yok' }, { status: 401 });
    }
    
    // Admin kontrolü
    const isAdmin = decodedToken.email && ADMIN_EMAILS.includes(decodedToken.email);
    console.log('Admin e-posta kontrolü:', decodedToken.email, isAdmin ? 'ADMIN' : 'ADMIN DEĞİL');
    
    if (!isAdmin) {
      console.log('Admin yetkisi reddedildi:', decodedToken.email);
      return NextResponse.json({ error: 'Admin yetkisi yok', isAdmin: false }, { status: 403 });
    }
    
    console.log('Admin yetkisi onaylandı:', decodedToken.email);
    return NextResponse.json({ success: true, isAdmin: true });
  } catch (error) {
    console.error('Admin kontrolü yapılırken hata:', error);
    return NextResponse.json({ error: 'Admin kontrolü sırasında bir hata oluştu' }, { status: 500 });
  }
} 