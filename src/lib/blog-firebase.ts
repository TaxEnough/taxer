import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  DocumentReference,
  DocumentData,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Blog yazı türü
export interface BlogPost {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  slug: string;
  tags?: string[];
  isPublished: boolean;
  imageUrl?: string;
}

// Firebase'den gelen verileri BlogPost tipine dönüştür
const convertBlogPost = (doc: DocumentData): BlogPost => {
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || '',
    summary: data.summary || '',
    content: data.content || '',
    author: data.author || 'Anonim',
    authorId: data.authorId || '',
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
    slug: data.slug || '',
    tags: data.tags || [],
    isPublished: data.isPublished !== undefined ? data.isPublished : true,
    imageUrl: data.imageUrl || undefined
  };
};

// Tüm blog yazılarını getir (yayımlanmış olanlar)
export const getAllBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    console.log('getAllBlogPosts: Firebase sorgusu oluşturuluyor...');
    // Önce tüm blogları al, composite index sorunu olmadan
    const q = query(
      collection(db, 'blogPosts')
    );
    
    console.log('getAllBlogPosts: Sorgu çalıştırılıyor...');
    const querySnapshot = await getDocs(q);
    console.log(`getAllBlogPosts: ${querySnapshot.docs.length} belge alındı`);
    
    // İstemci tarafında filtreleme yap
    const posts = querySnapshot.docs
      .map(convertBlogPost)
      .filter(post => post.isPublished === true);
      
    console.log(`getAllBlogPosts: ${posts.length} yayımlanmış blog yazısı filtrendi`);
    
    // İstemci tarafında sıralama yap
    posts.sort((a, b) => {
      const dateA = a.createdAt instanceof Date 
        ? a.createdAt 
        : (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt)
          ? a.createdAt.toDate()
          : new Date();
      
      const dateB = b.createdAt instanceof Date 
        ? b.createdAt 
        : (b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt)
          ? b.createdAt.toDate()
          : new Date();
      
      return dateB.getTime() - dateA.getTime();
    });
    
    return posts;
  } catch (error) {
    console.error('Blog yazıları getirilirken hata oluştu:', error);
    return [];
  }
};

// Belirli bir etikete sahip blog yazılarını getir
export const getBlogPostsByTag = async (tag: string): Promise<BlogPost[]> => {
  try {
    const q = query(
      collection(db, 'blogPosts'),
      where('isPublished', '==', true),
      where('tags', 'array-contains', tag),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertBlogPost);
  } catch (error) {
    console.error(`"${tag}" etiketine sahip yazılar getirilirken hata oluştu:`, error);
    return [];
  }
};

// ID ile blog yazısı getir
export const getBlogPostById = async (id: string): Promise<BlogPost | null> => {
  try {
    const docRef = doc(db, 'blogPosts', id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return convertBlogPost(docSnap);
    }
    
    return null;
  } catch (error) {
    console.error('Blog yazısı getirilirken hata oluştu:', error);
    return null;
  }
};

// Slug ile blog yazısı getir
export const getBlogPostBySlug = async (slug: string): Promise<BlogPost | null> => {
  try {
    const q = query(
      collection(db, 'blogPosts'),
      where('slug', '==', slug),
      where('isPublished', '==', true),
      limit(1)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return convertBlogPost(querySnapshot.docs[0]);
    }
    
    return null;
  } catch (error) {
    console.error(`"${slug}" slugına sahip yazı getirilirken hata oluştu:`, error);
    return null;
  }
};

// Admin için tüm blog yazılarını getir (yayımlanmamış olanlar dahil)
export const getAllBlogPostsForAdmin = async (): Promise<BlogPost[]> => {
  try {
    const q = query(
      collection(db, 'blogPosts'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(convertBlogPost);
  } catch (error) {
    console.error('Admin için blog yazıları getirilirken hata oluştu:', error);
    return [];
  }
};

// Yeni blog yazısı ekle
export const addBlogPost = async (
  post: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string | null> => {
  try {
    console.log('Blog yazısı eklemeye başlanıyor:', post.title);
    
    // Slug kontrolü yap
    try {
      console.log('Slug kontrolü yapılıyor:', post.slug);
      const slugCheck = query(
        collection(db, 'blogPosts'),
        where('slug', '==', post.slug)
      );
      
      const slugSnapshot = await getDocs(slugCheck);
      
      if (!slugSnapshot.empty) {
        console.error('Slug zaten kullanımda:', post.slug);
        throw new Error('Bu URL (slug) zaten kullanılıyor. Lütfen başka bir URL seçin.');
      }
    } catch (slugError: any) {
      // Eğer izin hatası alırsak slug kontrolünü atlayabiliriz
      if (slugError.code === 'permission-denied') {
        console.warn('Slug kontrolü izin hatası nedeniyle atlandı');
      } else {
        throw slugError;
      }
    }
    
    console.log('Blog yazısı için veriler hazırlanıyor');
    const blogData = {
      ...post,
      isPublished: post.isPublished !== undefined ? post.isPublished : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Firebase izin hatası durumunda, sunucu tarafında verinin yazılması gerekiyor
    // Burada bir alternatif olarak API rotası kullanılabilir
    console.log('Firestore\'a yazılıyor');
    try {
      const docRef = await addDoc(collection(db, 'blogPosts'), blogData);
      console.log('Blog yazısı başarıyla eklendi, ID:', docRef.id);
      return docRef.id;
    } catch (writeError: any) {
      if (writeError.code === 'permission-denied') {
        console.error('Firestore izin hatası, API rotası kullanılmalı');
        throw new Error('Yetki hatası: Blog yazısı eklemek için admin yetkisine ihtiyacınız var. Bu işlemi gerçekleştirmek için lütfen site yöneticisiyle iletişime geçin.');
      }
      throw writeError;
    }
  } catch (error: any) {
    console.error('Blog yazısı eklenirken hata oluştu:', error);
    console.error('Hata kodu:', error.code);
    console.error('Hata mesajı:', error.message);
    
    if (error.code === 'permission-denied') {
      throw new Error('Yetersiz izin: Blog yazısı eklemek için yetkiniz yok. Lütfen site yöneticisiyle iletişime geçin.');
    }
    
    if (error.message && error.message.includes('slug')) {
      throw error; // Slug hatası ise aynı hatayı gönder
    }
    
    throw new Error('Blog yazısı eklenirken bir hata oluştu: ' + error.message);
  }
};

// Blog yazısını güncelle
export const updateBlogPost = async (
  id: string,
  post: Partial<Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> => {
  try {
    // Slug değişti ise kontrolü yap
    if (post.slug) {
      const slugCheck = query(
        collection(db, 'blogPosts'),
        where('slug', '==', post.slug)
      );
      
      const slugSnapshot = await getDocs(slugCheck);
      
      // Eğer aynı slug'a sahip başka bir yazı varsa (kendi ID'si dışında)
      if (!slugSnapshot.empty && slugSnapshot.docs[0].id !== id) {
        throw new Error('Bu URL (slug) zaten kullanılıyor. Lütfen başka bir URL seçin.');
      }
    }
    
    const docRef = doc(db, 'blogPosts', id);
    await updateDoc(docRef, {
      ...post,
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error: any) {
    console.error('Blog yazısı güncellenirken hata oluştu:', error);
    
    if (error.message && error.message.includes('slug')) {
      throw error; // Slug hatası ise aynı hatayı gönder
    }
    
    throw new Error('Blog yazısı güncellenirken bir hata oluştu.');
  }
};

// Blog yazısını sil
export const deleteBlogPost = async (id: string): Promise<boolean> => {
  try {
    const docRef = doc(db, 'blogPosts', id);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Blog yazısı silinirken hata oluştu:', error);
    throw new Error('Blog yazısı silinirken bir hata oluştu.');
  }
};

// Tüm etiketleri getir
export const getAllTags = async (): Promise<string[]> => {
  try {
    const postsSnapshot = await getDocs(
      query(
        collection(db, 'blogPosts'),
        where('isPublished', '==', true)
      )
    );
    
    // Tüm etiketleri topla
    const tagsSet = new Set<string>();
    
    postsSnapshot.docs.forEach(doc => {
      const tags = doc.data().tags || [];
      tags.forEach((tag: string) => tagsSet.add(tag));
    });
    
    return Array.from(tagsSet).sort();
  } catch (error) {
    console.error('Etiketler getirilirken hata oluştu:', error);
    return [];
  }
}; 