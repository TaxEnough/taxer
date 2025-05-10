import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieFromRequest, verifyTokenServer } from '@/lib/auth-server';

// GET method for token verification (used by client-side)
export async function GET(request: NextRequest) {
  try {
    // Get token from either Authorization header or cookies
    const authHeader = request.headers.get('Authorization');
    let token = '';
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = await getAuthCookieFromRequest(request) || '';
    }
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        message: 'Authentication token not found' 
      }, { status: 401 });
    }
    
    // Verify token with Firebase Admin SDK
    const decodedToken = await verifyTokenServer(token);
    
    if (!decodedToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid or expired token' 
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || decodedToken.email?.split('@')[0] || '',
        accountStatus: decodedToken.accountStatus || 'free',
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Authentication verification failed' 
    }, { status: 500 });
  }
}

// POST method (for backward compatibility)
export async function POST(request: NextRequest) {
  try {
    const token = await getAuthCookieFromRequest(request) || '';
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        message: 'Authentication token not found' 
      }, { status: 401 });
    }
    
    // Server-side verification with Firebase Admin SDK
    const decodedToken = await verifyTokenServer(token);
    
    if (!decodedToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid or expired token' 
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: decodedToken.uid,
        email: decodedToken.email || '',
        name: decodedToken.name || decodedToken.email?.split('@')[0] || '',
        accountStatus: decodedToken.accountStatus || 'free',
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Authentication verification failed' 
    }, { status: 500 });
  }
} 