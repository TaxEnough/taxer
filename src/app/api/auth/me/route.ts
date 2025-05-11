import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { headers } from 'next/headers';
import { clerkClient } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic'; // Endpointin statik olarak optimize edilmesini engelle

export async function GET(request: NextRequest) {
  console.log('GET /api/auth/me endpoint çağrıldı');
  
  try {
    // HTTP başlıklarını al
    const headersList = headers();
    const authHeader = headersList.get('authorization');
    console.log('Authorization header\'dan token alındı');
    
    // Token yoksa hata döndür
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Token bulunamadı');
      return NextResponse.json({ error: 'Kimlik doğrulama token\'ı bulunamadı' }, { status: 401 });
    }
    
    // Token'ı ayıkla
    const token = authHeader.substring(7);
    console.log('Token bulundu, doğrulanıyor');
    
    try {
      // Token'ı doğrula
      const decodedToken = await verifyAuthToken(token);
      
      // Kullanıcı ID'si kontrolü
      if (!decodedToken || !decodedToken.uid) {
        console.log('Token geçerli ancak kullanıcı ID bulunamadı');
        // Token yapısını log'a yazdır (hassas bilgileri kırparak)
        console.log('Token içeriği:', JSON.stringify({
          ...decodedToken,
          email: decodedToken?.email ? '[GİZLİ]' : undefined,
          sub: decodedToken?.sub ? '[VAR]' : undefined,
          user_id: decodedToken?.user_id ? '[VAR]' : undefined,
          userId: decodedToken?.userId ? '[VAR]' : undefined
        }));
        
        return NextResponse.json(
          { error: 'Geçersiz token: Kullanıcı ID bulunamadı' },
          { status: 401 }
        );
      }
      
      console.log('Token doğrulandı, kullanıcı ID:', decodedToken.uid);
      
      // Clerk'den kullanıcı bilgilerini al
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(decodedToken.uid);
        
        if (user) {
          console.log('Clerk\'den kullanıcı bilgileri alındı');
          
          // Cache-Control başlığını ekle (10 saniyelik kısa süre cache'de tut)
          return NextResponse.json(
            {
              id: decodedToken.uid,
              email: user.emailAddresses[0]?.emailAddress || decodedToken.email,
              name: user.firstName || decodedToken.email?.split('@')[0] || '',
            },
            {
              status: 200,
              headers: {
                'Cache-Control': 'private, max-age=10', // 10 saniye client tarafında cache'lenebilir
              },
            }
          );
        } else {
          console.log('Kullanıcı verileri bulunamadı, token bilgileriyle devam ediliyor');
          
          // Kullacını bilgileri yoksa token bilgilerini kullan
          return NextResponse.json(
            {
              id: decodedToken.uid,
              email: decodedToken.email,
              name: decodedToken.email?.split('@')[0] || '',
            },
            {
              status: 200,
              headers: {
                'Cache-Control': 'private, max-age=10', // 10 saniye client tarafında cache'lenebilir
              },
            }
          );
        }
      } catch (clerkError: any) {
        console.error('Kullanıcı bilgileri hatası:', clerkError);
        
        // Clerk izin hatası durumunda direkt token bilgilerini kullan
        console.log('Kullanıcı verileri bulunamadı, token bilgileriyle devam ediliyor');
        
        // Kullacını bilgileri yoksa token bilgilerini kullan
        return NextResponse.json(
          {
            id: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name || decodedToken.email?.split('@')[0] || '',
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'private, max-age=10', // 10 saniye client tarafında cache'lenebilir
            },
          }
        );
      }
    } catch (tokenError) {
      console.error('Token doğrulama hatası:', tokenError);
      return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
    }
  } catch (error) {
    console.error('/api/auth/me endpoint hatası:', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
} 