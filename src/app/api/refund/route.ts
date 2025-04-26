import { NextRequest, NextResponse } from 'next/server';
 
export async function GET(request: NextRequest) {
  // Doğrudan /refund sayfasına yönlendir
  return NextResponse.redirect(new URL('/refund', request.url));
} 