import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth-firebase';
import { generateToken, setAuthCookieOnServer } from '@/lib/auth-server';

// E-posta formatı doğrulama
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export async function POST(request: NextRequest) {
  console.log('Login API called - Endpoint başlangıcı');
  
  try {
    const data = await request.json();
    const { email: emailInput, password } = data;
    
    // Email değerini düzelt
    let email = emailInput;

    if (!email || !password) {
      console.log('Login API - Email veya şifre eksik');
      return NextResponse.json({
        success: false,
        message: 'E-posta ve şifre gereklidir',
      }, { status: 400 });
    }

    // Check email format
    if (!validateEmail(email)) {
      console.log('Login API - Geçersiz email formatı');
      return NextResponse.json(
        { error: 'Invalid email format. Please enter a valid email address.' },
        { status: 400 }
      );
    }
    
    // Clean email spaces
    if (email.includes(' ')) {
      email = email.trim();
      console.log('Email spaces cleaned:', email);
    }
    
    try {
      // User login
      console.log('Logging in user:', email);
      const userCredential = await loginUser(email, password);
      
      if (!userCredential) {
        console.log('Login API - Kullanıcı girişi başarısız');
        return NextResponse.json({
          success: false,
          message: 'Kullanıcı girişi başarısız oldu',
        }, { status: 401 });
      }

      // Generate token
      console.log('Login API - Token oluşturuluyor');
      const token = await generateToken(userCredential.uid);
      
      // Kullanıcı bilgilerini hazırla
      const userData = {
        uid: userCredential.uid,
        email: userCredential.email,
        displayName: userCredential.displayName,
        photoURL: userCredential.photoURL,
        emailVerified: userCredential.emailVerified,
      };
      
      console.log('Login API - Kullanıcı bilgileri hazır:', {
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName
      });
      
      // Response'ı hazırla
      const responseBody = {
        success: true,
        user: userData,
        token: token,
        redirectUrl: '/dashboard'
      };
      
      // Create response
      console.log('Login API - Yanıt oluşturuluyor');
      const response = NextResponse.json(responseBody);
      
      // Set cookie directly
      console.log('Login API - Cookie ayarlanıyor');
      response.cookies.set({
        name: 'auth-token',
        value: token,
        httpOnly: false,      // Client erişimi için false
        path: '/',
        sameSite: 'lax',      // Vercel uyumluluğu için standart değer
        secure: false,        // HTTP için de çalışsın
        maxAge: 60 * 60 * 24 * 7 // 7 gün
      });
      
      // Manual header token
      response.headers.set('X-Auth-Token', token);
      
      // Cache kontrolü
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      console.log('Login API - İşlem başarılı, yanıt dönülüyor');
      return response;
    } catch (loginError: any) {
      console.error('Firebase login error:', loginError);
      const errorMessage = loginError.message || 'Login failed';
      const statusCode = loginError.code?.includes('auth/') ? 401 : 500;
      
      console.log(`Login API - Firebase hatası: ${errorMessage}, kod: ${statusCode}`);
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error: any) {
    console.error('General login error:', error);
    
    // Firebase auth hatalarını değerlendir
    let errorMessage = 'Giriş işlemi başarısız oldu';
    let statusCode = 500;
    
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      errorMessage = 'E-posta veya şifre hatalı';
      statusCode = 401;
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin';
      statusCode = 429;
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'Bu hesap devre dışı bırakılmıştır';
      statusCode = 403;
    }
    
    console.log(`Login API - Genel hata: ${errorMessage}, kod: ${statusCode}`);
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: statusCode });
  }
} 