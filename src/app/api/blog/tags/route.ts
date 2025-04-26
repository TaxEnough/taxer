import { NextRequest, NextResponse } from 'next/server';
import { getAllTags } from '@/lib/blog-firebase';

// Tüm etiketleri getir (GET)
export async function GET(request: NextRequest) {
  try {
    // Etiketleri Firebase'den getir
    const tags = await getAllTags();
    
    // Cache-Control başlığını ekle
    const response = NextResponse.json(tags);
    response.headers.set('Cache-Control', 'public, max-age=300'); // 5 dakika cache
    
    return response;
  } catch (error) {
    console.error('Etiketler getirilirken hata oluştu:', error);
    return NextResponse.json(
      { error: 'Etiketler getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 