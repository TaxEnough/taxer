import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Yerel blog dosyasının yolu
const localBlogsFilePath = path.join(process.cwd(), 'local-blogs.json');

// Yerel depodan blog verilerini oku
function readLocalBlogs() {
  try {
    if (fs.existsSync(localBlogsFilePath)) {
      const data = fs.readFileSync(localBlogsFilePath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Yerel blog dosyası okuma hatası:', error);
    return [];
  }
}

// Yerel blog yazılarını getiren API
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    
    if (!slug) {
      return new NextResponse(JSON.stringify({ error: 'Blog slug parametresi gereklidir' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Yerel depodan blog yazılarını getir
    const localBlogs = readLocalBlogs();
    
    // Slug'a göre blog yazısını bul
    const blogPost = localBlogs.find((blog: any) => blog.slug === slug);
    
    if (!blogPost) {
      return new NextResponse(JSON.stringify({ error: 'Blog yazısı bulunamadı' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new NextResponse(JSON.stringify(blogPost), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Blog yazısı alınırken hata:', error);
    return new NextResponse(JSON.stringify({ error: 'Blog yazısı işlenirken bir hata oluştu' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 