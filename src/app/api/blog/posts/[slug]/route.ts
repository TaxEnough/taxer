import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth';
import { headers } from 'next/headers';
import { 
  getBlogPostBySlug, 
  getBlogPostById,
  updateBlogPost,
  deleteBlogPost
} from '@/lib/blog-firebase';

// Admin e-posta listesi
const ADMIN_EMAILS = ['info.taxenough@gmail.com'];

// Token doğrulama ve admin kontrolü için yardımcı fonksiyon
async function verifyAdminToken(request: NextRequest) {
  // Token'ı header'dan veya cookie'den al
  const cookieHeader = request.cookies.get('auth-token')?.value;
  const authHeader = headers().get('authorization');
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : cookieHeader;
  
  if (!token) {
    return { error: 'Kimlik doğrulama gerekli', status: 401 };
  }
  
  try {
    // Token'ı doğrula
    const decodedToken = await verifyAuthToken(token);
    
    if (!decodedToken || !decodedToken.email) {
      return { error: 'Geçersiz token', status: 401 };
    }
    
    // Admin kontrolü
    const isAdmin = decodedToken.email && ADMIN_EMAILS.includes(decodedToken.email);
    
    if (!isAdmin) {
      return { error: 'Bu işlem için admin yetkisi gereklidir', status: 403 };
    }
    
    return { decodedToken };
  } catch (error) {
    console.error('Token doğrulama hatası:', error);
    return { error: 'Geçersiz token', status: 401 };
  }
}

// Belirli bir blog yazısını getir (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    
    // ID ile mi yoksa slug ile mi sorgu yapıldığını kontrol et
    let post;
    if (slug.match(/^[a-zA-Z0-9]{20,}$/)) {
      // ID formatına benziyorsa (20+ alfanumerik karakter) ID ile sorgula
      post = await getBlogPostById(slug);
    } else {
      // Değilse slug ile sorgula
      post = await getBlogPostBySlug(slug);
    }
    
    if (!post) {
      return NextResponse.json(
        { error: 'Blog yazısı bulunamadı' },
        { status: 404 }
      );
    }
    
    // Cache-Control başlığını ekle
    const response = NextResponse.json(post);
    response.headers.set('Cache-Control', 'public, max-age=3600'); // 1 saat cache
    
    return response;
  } catch (error) {
    console.error('Blog yazısı getirilirken hata oluştu:', error);
    return NextResponse.json(
      { error: 'Blog yazısı getirilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Blog yazısını güncelle (PUT)
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const id = params.slug;
    
    // Admin token kontrolü
    const tokenResult = await verifyAdminToken(request);
    if ('error' in tokenResult) {
      return NextResponse.json(
        { error: tokenResult.error },
        { status: tokenResult.status }
      );
    }
    
    // İstek gövdesini al
    const body = await request.json();
    
    // Güncellenecek yazıyı kontrol et
    const existingPost = await getBlogPostById(id);
    if (!existingPost) {
      return NextResponse.json(
        { error: 'Güncellenecek blog yazısı bulunamadı' },
        { status: 404 }
      );
    }
    
    // Güncellenecek alanları hazırla
    const updateData: any = {};
    
    if (body.title !== undefined) updateData.title = body.title;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    
    // Eğer hiçbir alan güncellenmiyorsa hata döndür
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Güncelleme için en az bir alan gereklidir' },
        { status: 400 }
      );
    }
    
    // Blog yazısını güncelle
    const updated = await updateBlogPost(id, updateData);
    
    if (!updated) {
      return NextResponse.json(
        { error: 'Blog yazısı güncellenirken bir hata oluştu' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      id,
      message: 'Blog yazısı başarıyla güncellendi' 
    });
  } catch (error: any) {
    console.error('Blog yazısı güncellenirken hata oluştu:', error);
    
    // Özel hata mesajlarını kontrol et
    if (error.message && error.message.includes('slug')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Blog yazısı güncellenirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Blog yazısını sil (DELETE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const id = params.slug;
    
    // Admin token kontrolü
    const tokenResult = await verifyAdminToken(request);
    if ('error' in tokenResult) {
      return NextResponse.json(
        { error: tokenResult.error },
        { status: tokenResult.status }
      );
    }
    
    // Silinecek yazıyı kontrol et
    const existingPost = await getBlogPostById(id);
    if (!existingPost) {
      return NextResponse.json(
        { error: 'Silinecek blog yazısı bulunamadı' },
        { status: 404 }
      );
    }
    
    // Blog yazısını sil
    const deleted = await deleteBlogPost(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Blog yazısı silinirken bir hata oluştu' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Blog yazısı başarıyla silindi' 
    });
  } catch (error) {
    console.error('Blog yazısı silinirken hata oluştu:', error);
    return NextResponse.json(
      { error: 'Blog yazısı silinirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 