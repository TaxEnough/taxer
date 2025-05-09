import { compare, hash } from 'bcryptjs';
import { sign, verify } from 'jsonwebtoken';
import { NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
export const COOKIE_NAME = 'auth-token';

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

interface TokenPayload {
  userId: string;
  email?: string;
  name?: string;
  accountStatus?: 'free' | 'basic' | 'premium';
}

interface UserData {
  uid: string;
  email?: string | null;
  name?: string | null;
  accountStatus?: 'free' | 'basic' | 'premium';
}

// Function to generate token - includes user information and subscription status
export function generateToken(userIdOrData: string | UserData, email?: string, name?: string, accountStatus?: 'free' | 'basic' | 'premium'): string {
  let payload: TokenPayload;
  
  // If the first parameter is an object, get data from it
  if (typeof userIdOrData === 'object') {
    payload = {
      userId: userIdOrData.uid,
      email: userIdOrData.email || undefined,
      name: userIdOrData.name || undefined,
      accountStatus: userIdOrData.accountStatus || 'free'
    };
    console.log('Creating token (object):', { 
      userId: userIdOrData.uid, 
      accountStatus: payload.accountStatus 
    });
  } else {
    // When given a string ID
    payload = { userId: userIdOrData };
    if (email) payload.email = email;
    if (name) payload.name = name;
    payload.accountStatus = accountStatus || 'free';
    console.log('Creating token (string):', { 
      userId: userIdOrData, 
      accountStatus: payload.accountStatus 
    });
  }
  
  // Create and return token
  const token = sign(payload, JWT_SECRET, { expiresIn: '7d' });
  return token;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET) as TokenPayload;
    console.log('Token verified:', {
      userId: decoded.userId,
      accountStatus: decoded.accountStatus || 'free'
    });
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Function to set cookie
export function setAuthCookie(token: string, response: NextResponse): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: false, // Accessible from client side
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    priority: 'high'
  });
  
  // Additional headers for cache control
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

// Use auth-client.ts file for client-side operations
// Use auth-server.ts file for server-side operations 