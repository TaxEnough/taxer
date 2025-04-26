import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieFromRequest } from '@/lib/auth-server';
import { verifyToken } from '@/lib/auth';

// Hesap silme API'si
export async function DELETE(request: NextRequest) {
  console.log('Hesap silme API çağrıldı');
  
  try {
    // Token kontrolü
    const token = await getAuthCookieFromRequest(request);
    
    if (!token) {
      console.log('Token bulunamadı');
      return NextResponse.json({ error: 'Yetkilendirme gerekli' }, { status: 401 });
    }
    
    // Token doğrulama
    try {
      const decoded = verifyToken(token);
      
      if (!decoded || !decoded.userId) {
        console.log('Token geçersiz');
        return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
      }
      
      const userId = decoded.userId;
      console.log('Kullanıcı kimliği doğrulandı:', userId);
      
      // Not: Hesap silme işlemi Firebase Authentication gerektirir
      // Client tarafında işlem yapılmasını sağlayalım
      return NextResponse.json({
        message: 'Hesap silme işlemi için client-side authentication gerekli',
        shouldUseClientSide: true,
        userId: userId
      }, { status: 202 }); // 202 Accepted, client'ın işlemi devam ettirmesi gerektiğini belirtir
      
    } catch (tokenError) {
      console.error('Token çözme hatası:', tokenError);
      return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
    }
  } catch (error: any) {
    console.error('Hesap silme hatası:', error);
    return NextResponse.json(
      { error: error.message || 'Hesap silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 