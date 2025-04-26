import { NextRequest, NextResponse } from 'next/server';
import { getUserData, verifyToken } from '@/lib/auth-firebase';
import { headers } from 'next/headers';

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
      const decodedToken = await verifyToken(token);
      console.log('Token doğrulandı, kullanıcı ID:', decodedToken.uid);
      
      // Kullanıcı ID'si kontrolü
      if (!decodedToken.uid) {
        console.log('Token geçerli ancak kullanıcı ID bulunamadı');
        return NextResponse.json(
          { error: 'Geçersiz token: Kullanıcı ID bulunamadı' },
          { status: 401 }
        );
      }
      
      // Firestore'dan kullanıcı bilgilerini al
      try {
        const userData = await getUserData(decodedToken.uid);
        
        if (userData) {
          console.log('Firestore\'dan kullanıcı bilgileri alındı');
          
          // Cache-Control başlığını ekle (10 saniyelik kısa süre cache'de tut)
          return NextResponse.json(
            {
              id: decodedToken.uid,
              email: decodedToken.email,
              name: userData.name || decodedToken.email?.split('@')[0] || '',
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
      } catch (firestoreError: any) {
        console.error('Kullanıcı bilgileri hatası:', firestoreError);
        
        // Firestore izin hatası durumunda direkt token bilgilerini kullan
        if (firestoreError.code === 'permission-denied') {
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
        
        // Diğer firestore hataları için 500 döndür
        return NextResponse.json(
          { error: 'Kullanıcı bilgileri alınırken hata oluştu' },
          { status: 500 }
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