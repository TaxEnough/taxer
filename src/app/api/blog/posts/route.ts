import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { headers } from 'next/headers';
import { 
  getAllBlogPosts, 
  getAllBlogPostsForAdmin,
  addBlogPost,
  BlogPost
} from '@/lib/blog-firebase';

// Timestamp veya string veya Date'i JavaScript Date'e dönüştür
const toJsDate = (dateValue: any): Date => {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
    // Firebase Timestamp
    return dateValue.toDate();
  }
  
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  
  return new Date(); // Varsayılan şimdiki zaman
};

// Blog yazılarını getirme (GET)
export async function GET(request: NextRequest) {
  try {
    let firebasePosts: BlogPost[] = [];
    
    // Firebase'den blog yazılarını al
    try {
      firebasePosts = await getAllBlogPosts();
      console.log(`Blog API: ${firebasePosts.length} blog yazısı alındı`);
    } catch (error) {
      console.error('Blog yazıları getirilirken hata oluştu:', error);
    }
    
    // Tarihe göre sırala (en yeni en üstte)
    firebasePosts.sort((a, b) => {
      const dateA = toJsDate(a.createdAt);
      const dateB = toJsDate(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    
    return NextResponse.json(firebasePosts);
  } catch (error) {
    console.error('Blog yazıları API hatası:', error);
    return NextResponse.json([], { status: 500 });
  }
}

// Yeni blog yazısı ekleme (POST)
export async function POST(request: NextRequest) {
  try {
    // Token kontrolü
    const cookieHeader = request.cookies.get('auth-token')?.value;
    const authHeader = headers().get('authorization');
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : cookieHeader;
    
    if (!token) {
      return NextResponse.json({ error: 'Kimlik doğrulama gerekli' }, { status: 401 });
    }
    
    try {
      // Token'ı doğrula
      const decodedToken = await verifyAuthToken(token);
      
      if (!decodedToken) {
        console.log('Token geçerli değil, null değer döndü');
        return NextResponse.json({ error: 'Geçersiz token' }, { status: 401 });
      }
      
      if (!decodedToken.email) {
        console.log('Token geçerli ancak email bilgisi yok');
        return NextResponse.json({ error: 'Geçersiz token: Email bilgisi yok' }, { status: 401 });
      }
      
      // Admin kontrolü
      const ADMIN_EMAILS = ['info.taxenough@gmail.com']; // Admin e-posta listesi
      const isAdmin = decodedToken.email && ADMIN_EMAILS.includes(decodedToken.email);
      
      if (!isAdmin) {
        return NextResponse.json({ error: 'Bu işlem için admin yetkisi gereklidir' }, { status: 403 });
      }
      
      // İstek gövdesini al
      const body = await request.json();
      
      // Zorunlu alanları kontrol et
      if (!body.title || !body.summary || !body.content || !body.slug) {
        return NextResponse.json({ 
          error: 'Başlık, özet, içerik ve URL (slug) alanları zorunludur' 
        }, { status: 400 });
      }
      
      // Yeni yazı ekle
      const postData = {
        title: body.title,
        summary: body.summary,
        content: body.content,
        slug: body.slug,
        author: body.author || decodedToken.name || 'Anonim',
        authorId: decodedToken.uid || '',
        tags: body.tags || [],
        isPublished: body.isPublished !== undefined ? body.isPublished : true,
        imageUrl: body.imageUrl || undefined
      };
      
      const postId = await addBlogPost(postData);
      
      if (!postId) {
        return NextResponse.json({ error: 'Blog yazısı eklenirken bir hata oluştu' }, { status: 500 });
      }
      
      return NextResponse.json({ 
        success: true,
        id: postId,
        message: 'Blog yazısı başarıyla eklendi'
      }, { status: 201 });
    } catch (error: any) {
      console.error('Blog yazısı eklenirken hata oluştu:', error);
      
      // Özel hata mesajlarını kontrol et
      if (error.message && error.message.includes('slug')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      
      return NextResponse.json({ error: 'Blog yazısı eklenirken bir hata oluştu' }, { status: 500 });
    }
  } catch (error) {
    console.error('Blog yazısı eklenirken hata oluştu:', error);
    return NextResponse.json({ error: 'Blog yazısı eklenirken bir hata oluştu' }, { status: 500 });
  }
} 