import { NextRequest, NextResponse } from 'next/server';
 
export async function GET(request: NextRequest) {
  // Doğrudan /terms sayfasına yönlendir
  return NextResponse.redirect(new URL('/terms', request.url));
} 