import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieFromRequest } from '@/lib/auth-server';
import { verifyToken } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';

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
      
      try {
        // Clerk API üzerinden kullanıcıyı al
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        
        if (!user) {
          return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 });
        }
        
        // Clerk API'den kullanıcı silme işlemi
        try {
          await clerk.users.deleteUser(userId);
          console.log('Kullanıcı Clerk\'ten başarıyla silindi');
          
          return NextResponse.json({
            success: true,
            message: 'Hesabınız başarıyla silindi'
          });
        } catch (clerkDeleteError) {
          console.error('Clerk hesap silme hatası:', clerkDeleteError);
          
          // Clerk API'de bir sorun oluştuğunda client tarafında devam et
          return NextResponse.json({
            message: 'Hesap silme işlemi için client-side authentication gerekli',
            shouldUseClientSide: true,
            userId: userId
          }, { status: 202 }); // 202 Accepted, client'ın işlemi devam ettirmesi gerektiğini belirtir
        }
      } catch (clerkError) {
        console.error('Clerk API hatası:', clerkError);
        return NextResponse.json({
          message: 'Hesap silme işlemi için client-side authentication gerekli',
          shouldUseClientSide: true,
          userId: userId
        }, { status: 202 });
      }
      
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