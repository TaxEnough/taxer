import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieFromRequest } from '@/lib/auth-server';
import { verifyToken, hashPassword } from '@/lib/auth';
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// Şifre değiştirme API'si
export async function POST(request: NextRequest) {
  console.log('Password change API called');
  
  try {
    // Token kontrolü
    const token = getAuthCookieFromRequest(request);
    
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
      
      // Not: Firebase Auth şifre değiştirme işlemleri sunucu tarafında Firebase Admin SDK gerektirir
      // Server-side işlem yapamıyoruz, client tarafında işlem yapılmasını sağlayalım
      return NextResponse.json({
        message: 'Client-side authentication required for password change',
        shouldUseClientSide: true,
        userId: userId
      }, { status: 202 }); // 202 Accepted, client'ın işlemi devam ettirmesi gerektiğini belirtir
      
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