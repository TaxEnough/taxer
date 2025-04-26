import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth-firebase';
import { generateToken, setAuthCookieOnServer } from '@/lib/auth-server';

// E-posta formatı doğrulama
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export async function POST(request: NextRequest) {
  console.log('Login API called');
  
  try {
    const data = await request.json();
    const { email: emailInput, password } = data;
    
    // Email değerini düzelt
    let email = emailInput;

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        message: 'E-posta ve şifre gereklidir',
      }, { status: 400 });
    }

    // Check email format
    if (!validateEmail(email)) {
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
        return NextResponse.json({
          success: false,
          message: 'Kullanıcı girişi başarısız oldu',
        }, { status: 401 });
      }

      // Generate token
      console.log('Generating token');
      const token = generateToken(userCredential.uid);
      
      // Create response
      const response = NextResponse.json({
        success: true,
        user: {
          uid: userCredential.uid,
          email: userCredential.email,
          displayName: userCredential.displayName,
          photoURL: userCredential.photoURL,
          emailVerified: userCredential.emailVerified,
        },
        token: token, // Send token to client side too
        redirectUrl: '/dashboard'
      });
      
      // Set cookie - Use response.cookies directly
      console.log('Setting cookie');
      
      // Cookie settings
      await setAuthCookieOnServer(token, response);
      
      // Set response headers
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      console.log('Returning successful response, user:', {
        id: userCredential.uid,
        email: userCredential.email,
        name: userCredential.displayName
      });
      
      return response;
    } catch (loginError: any) {
      console.error('Firebase login error:', loginError);
      return NextResponse.json(
        { error: loginError.message || 'Login failed' },
        { status: 401 }
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
    
    return NextResponse.json({
      success: false,
      message: errorMessage,
    }, { status: statusCode });
  }
} 