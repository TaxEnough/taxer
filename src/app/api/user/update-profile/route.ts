import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getAuthCookieFromRequest } from '@/lib/auth-server';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  console.log('Profil güncelleme API çağrıldı');
  
  try {
    // Token doğrulama
    const token = await getAuthCookieFromRequest(request);
    
    if (!token) {
      console.log('Token bulunamadı');
      return NextResponse.json({ error: 'Yetkilendirme gerekli' }, { status: 401 });
    }
    
    // Token doğrulama
    try {
      // Token doğrulama
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
        // Clerk ile kullanıcı profilini güncelle
        const names = name.split(' ');
        const firstName = names[0] || '';
        const lastName = names.length > 1 ? names.slice(1).join(' ') : '';
        
        const clerk = await clerkClient();
        await clerk.users.updateUser(userId, {
          firstName: firstName,
          lastName: lastName
        });
        
        console.log('Profil güncellendi:', userId);
        
        return NextResponse.json({ 
          success: true, 
          message: 'Profil başarıyla güncellendi' 
        });
      } catch (clerkError) {
        console.error('Clerk API hatası:', clerkError);
        return NextResponse.json({
          error: 'Profil güncellenirken bir hata oluştu',
          shouldUseClientSide: true,
          userId: userId,
          name: name
        }, { status: 500 });
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