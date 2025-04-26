import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth-firebase';
import { headers } from 'next/headers';
import { 
  getAllBlogPostsForAdmin,
  updateBlogPost
} from '@/lib/blog-firebase';

// Admin e-posta listesi
const ADMIN_EMAILS = ['info.taxenough@gmail.com'];

// Token doğrulama ve admin kontrolü için yardımcı fonksiyon
async function verifyAdminToken(request: NextRequest) {
  const cookieHeader = request.cookies.get('auth-token')?.value;
  const authHeader = headers().get('authorization');
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : cookieHeader;
  
  if (!token) {
    return { error: 'Kimlik doğrulama gerekli', status: 401 };
  }
  
  try {
    const decodedToken = await verifyToken(token);
    
    if (!decodedToken || !decodedToken.email) {
      return { error: 'Geçersiz token', status: 401 };
    }
    
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

// Blog yazılarını düzeltme (GET)
export async function GET(request: NextRequest) {
  try {
    // Admin token kontrolü
    const tokenResult = await verifyAdminToken(request);
    if ('error' in tokenResult) {
      return NextResponse.json(
        { error: tokenResult.error },
        { status: tokenResult.status }
      );
    }
    
    // Tüm blog yazılarını al
    const posts = await getAllBlogPostsForAdmin();
    let updatedCount = 0;
    
    // Her yazıyı kontrol et ve gerekirse güncelle
    for (const post of posts) {
      if (post.isPublished === undefined) {
        await updateBlogPost(post.id, { isPublished: true });
        updatedCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: `${updatedCount} blog yazısı güncellendi`
    });
  } catch (error) {
    console.error('Blog yazıları düzeltilirken hata oluştu:', error);
    return NextResponse.json(
      { error: 'Blog yazıları düzeltilirken bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Blog yazılarını düzeltme (POST)
export async function POST(request: NextRequest) {
  try {
    // Admin token kontrolü
    const tokenResult = await verifyAdminToken(request);
    if ('error' in tokenResult) {
      return NextResponse.json(
        { error: tokenResult.error },
        { status: tokenResult.status }
      );
    }
    
    // Tüm blog yazılarını al
    const posts = await getAllBlogPostsForAdmin();
    let updatedCount = 0;
    
    // Her yazıyı kontrol et ve gerekirse güncelle
    for (const post of posts) {
      if (post.isPublished === undefined) {
        await updateBlogPost(post.id, { isPublished: true });
        updatedCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: `${updatedCount} blog yazısı güncellendi`
    });
  } catch (error) {
    console.error('Blog yazıları düzeltilirken hata oluştu:', error);
    return NextResponse.json(
      { error: 'Blog yazıları düzeltilirken bir hata oluştu' },
      { status: 500 }
    );
  }
} 