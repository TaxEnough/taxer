import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieFromRequest, verifyTokenServer } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthCookieFromRequest(request) || '';
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        message: 'Kimlik doğrulama token\'ı bulunamadı' 
      }, { status: 401 });
    }
    
    // Server tarafında Firebase Admin SDK ile token doğrulama
    const decodedToken = await verifyTokenServer(token);
    
    if (!decodedToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'Geçersiz veya süresi dolmuş token' 
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      success: true, 
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
      }
    });
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Kimlik doğrulama işlemi başarısız oldu' 
    }, { status: 500 });
  }
} 