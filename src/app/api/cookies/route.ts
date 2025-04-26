import { NextRequest, NextResponse } from 'next/server';
 
export async function GET(request: NextRequest) {
  // Doğrudan /cookies sayfasına yönlendir
  return NextResponse.redirect(new URL('/cookies', request.url));
} 