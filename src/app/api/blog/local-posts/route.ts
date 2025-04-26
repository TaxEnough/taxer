import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Geçici olarak blog verilerini depolamak için yerel dosya
const LOCAL_BLOG_FILE = path.join(process.cwd(), 'local-blogs.json');

// Yerel blog verilerini oku
const readLocalBlogs = () => {
  try {
    if (fs.existsSync(LOCAL_BLOG_FILE)) {
      const data = fs.readFileSync(LOCAL_BLOG_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Yerel blog verileri okunamadı:', error);
    return [];
  }
};

export async function GET() {
  try {
    const localBlogs = readLocalBlogs();
    console.log('Yerel blog yazıları döndürülüyor:', localBlogs.length);
    
    return NextResponse.json(localBlogs);
  } catch (error) {
    console.error('Yerel blog yazıları alınırken hata:', error);
    return NextResponse.json([], { status: 500 });
  }
} 