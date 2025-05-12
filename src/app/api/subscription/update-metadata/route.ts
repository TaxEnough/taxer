import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getAuth } from '@clerk/nextjs/server';

/**
 * Kullanıcı meta verilerini günceller
 * Yalnızca oturum açmış kullanıcının kendi bilgilerini güncellemesine izin verir
 */
export async function POST(req: NextRequest) {
  try {
    // İsteği al
    const { userId, metadata } = await req.json();
    
    // Oturum bilgilerini kontrol et
    const auth = getAuth(req);
    const sessionUserId = auth.userId;
    
    // Oturum açmamış kullanıcılar erişemez
    if (!sessionUserId) {
      return NextResponse.json(
        { error: 'Oturum açmanız gerekiyor' },
        { status: 401 }
      );
    }
    
    // Yalnızca kendi bilgilerini güncelleyebilir
    if (sessionUserId !== userId) {
      return NextResponse.json(
        { error: 'Yalnızca kendi bilgilerinizi güncelleyebilirsiniz' },
        { status: 403 }
      );
    }
    
    // Meta verileri güncelle - clerkClient bir fonksiyon olduğu için önce çağırılmalı
    const clerk = await clerkClient();
    await clerk.users.updateUser(userId, {
      publicMetadata: metadata,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Kullanıcı meta verileri güncellendi'
    });
  } catch (error) {
    console.error('Meta veri güncelleme hatası:', error);
    return NextResponse.json(
      { error: 'Meta veriler güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 