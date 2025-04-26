import { NextRequest, NextResponse } from 'next/server';
 
export async function GET(request: NextRequest) {
  // Doğrudan /privacy sayfasına yönlendir
  return NextResponse.redirect(new URL('/privacy', request.url));
} 