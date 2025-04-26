import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase';
import { getUserData, updateUserProfile } from '@/lib/auth-firebase';
import { getAuthCookieFromRequest } from '@/lib/auth-server';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  console.log('Profil güncelleme API çağrıldı');
  
  try {
    // Token doğrulama
    const token = getAuthCookieFromRequest(request);
    
    if (!token) {
      console.log('Token bulunamadı');
      return NextResponse.json({ error: 'Yetkilendirme gerekli' }, { status: 401 });
    }
    
    // Token doğrulama
    try {
      // Firebase Admin SDK olmadığı için client tarafında token doğrulama
      // Bu fonksiyon, API rotalarında kullanılacak basit bir doğrulama sağlar
      const decoded = verifyToken(token);
      
      if (!decoded || !decoded.userId) {
        console.log('Token geçersiz');
        return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
      }
      
      const userId = decoded.userId;
      console.log('Kullanıcı kimliği doğrulandı:', userId);
      
      // İstek gövdesini al
      const body = await request.json();
      const { name } = body;
      
      if (!name) {
        return NextResponse.json({ error: 'İsim alanı gerekli' }, { status: 400 });
      }
      
      try {
        // Kullanıcı profilini güncelle
        const updateResult = await updateUserProfile(userId, { name });
        
        if (updateResult === null) {
          // Firestore yetki hatası - client tarafında işlem yap
          return NextResponse.json({
            error: 'Sunucu tarafında güncelleme yapılamadı',
            shouldUseClientSide: true,
            userId: userId,
            name: name
          }, { status: 202 });
        }
        
        console.log('Profil güncellendi:', userId);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Profil başarıyla güncellendi' 
        });
      } catch (dbError) {
        console.error('Veritabanı hatası:', dbError);
        // Firestore yetki hatası - client tarafında işlem yap
        return NextResponse.json({
          error: 'Sunucu tarafında güncelleme yapılamadı',
          shouldUseClientSide: true,
          userId: userId,
          name: name
        }, { status: 202 });
      }
    } catch (tokenError) {
      console.error('Token çözme hatası:', tokenError);
      return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
    }
    
  } catch (error: any) {
    console.error('Profil güncelleme hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Profil güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 