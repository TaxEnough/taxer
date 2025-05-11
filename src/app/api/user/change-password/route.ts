import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieFromRequest } from '@/lib/auth-server';
import { verifyToken } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';

// Şifre değiştirme API'si
export async function POST(request: NextRequest) {
  console.log('Change password API called');
  
  try {
    // Şifre değiştirme API güvenlik katmanı
    
    // Token kontrolü
    const token = await getAuthCookieFromRequest(request);
    
    if (!token) {
      console.log('Token not found');
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }
    
    // Token doğrulama
    try {
      const decoded = verifyToken(token);
      
      if (!decoded || !decoded.userId) {
        console.log('Invalid token');
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      
      const userId = decoded.userId;
      console.log('User ID verified:', userId);
      
      // İstek gövdesini al
      const body = await request.json();
      const { oldPassword, newPassword } = body;
      
      if (!oldPassword || !newPassword) {
        return NextResponse.json({ error: 'Old and new passwords are required' }, { status: 400 });
      }
      
      // Şifre doğrulama
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 });
      }
      
      // Clerk API ile şifre değiştirme işlemleri doğrudan sunucudan yapılamaz
      // Kullanıcıyı Clerk'in şifre değiştirme sayfasına yönlendiriyoruz
      
      try {
        // Kullanıcıyı doğrula
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        
        // Kullanıcı bulundu, client tarafında işlem yapılmasını sağlayalım
        return NextResponse.json({
          message: 'Please use the Clerk account settings to change your password',
          shouldUseClientSide: true,
          userId: userId,
          redirectUrl: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || '/sign-in'
        }, { status: 202 }); // 202 Accepted, client'ın işlemi devam ettirmesi gerektiğini belirtir
      } catch (clerkError) {
        console.error('Clerk API error:', clerkError);
        return NextResponse.json({ error: 'Unable to verify user account' }, { status: 500 });
      }
      
    } catch (tokenError) {
      console.error('Token decryption error:', tokenError);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
  } catch (error: any) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while changing password' },
      { status: 500 }
    );
  }
} 