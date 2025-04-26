'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getAllBlogPostsForAdmin, 
  addBlogPost, 
  updateBlogPost, 
  deleteBlogPost,
  BlogPost
} from '@/lib/blog-firebase';
import { Timestamp } from 'firebase/firestore';

// İçerik düzenleme için basit editor
export default function AdminBlogPage() {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAdminChecking, setIsAdminChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showNewPostForm, setShowNewPostForm] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const router = useRouter();
  
  // Admin kontrolü yapılır
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        console.log('Check admin status');
        
        // Hem localStorage hem de cookie kontrolü yap
        let token = localStorage.getItem('userToken');
        
        // Cookie kontrolü - document.cookie'den auth-token değerini al
        const cookies = document.cookie.split(';');
        const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth-token='));
        const cookieToken = authCookie ? authCookie.split('=')[1] : null;
        
        console.log('Bulunan token tipleri:', {
          localStorageToken: token ? 'var' : 'yok',
          cookieToken: cookieToken ? 'var' : 'yok'
        });
        
        // Cookie token varsa onu kullan (öncelikli)
        if (cookieToken) {
          token = cookieToken;
        }
        
        if (!token) {
          console.error('Token not found, redirecting to login page');
          router.push('/login?returnUrl=/admin/blog');
          return;
        }
        
        // Backend'den admin olup olmadığını kontrol et
        console.log('Checking admin status with API');
        const response = await fetch('/api/auth/check-admin', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          cache: 'no-store'  // Önbelleğe almayı engelle
        });
        
        const responseData = await response.json();
        console.log('Admin kontrolü cevabı:', responseData);
        
        if (!response.ok) {
          console.error('Admin kontrolü başarısız:', responseData);
          router.push('/dashboard');
          return;
        }
        
        if (!responseData.isAdmin) {
          console.error('Kullanıcı admin değil:', responseData);
          router.push('/dashboard');
          return;
        }
        
        console.log('Admin yetkisi doğrulandı');
        setIsAdmin(true);
      } catch (error) {
        console.error('Admin kontrolü yapılırken hata:', error);
        router.push('/login?returnUrl=/admin/blog');
      } finally {
        setIsAdminChecking(false);
      }
    };
    
    checkAdminStatus();
  }, [router]);
  
  // Blog yazılarını getir
  useEffect(() => {
    const fetchPosts = async () => {
      if (!isAdmin || isAdminChecking) return;
      
      setLoading(true);
      try {
        // Firestore'dan blog yazılarını getir
        const firebasePosts = await getAllBlogPostsForAdmin();
        
        // Yerel dosyadan blog yazılarını da getir
        try {
          const response = await fetch('/api/blog/local-posts');
          if (response.ok) {
            const localPosts = await response.json();
            console.log('Yerel blog yazıları:', localPosts.length);
            
            // Tüm yazıları birleştir (Firebase ve yerel)
            const allPosts = [...firebasePosts, ...localPosts];
            
            // Tarihe göre sırala (en yeni en üstte)
            allPosts.sort((a, b) => {
              const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
              const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
              return dateB.getTime() - dateA.getTime();
            });
            
            setPosts(allPosts);
          } else {
            // Yerel postlar alınamazsa sadece Firebase postları kullan
            setPosts(firebasePosts);
          }
        } catch (localError) {
          console.error('Yerel blog yazıları alınırken hata:', localError);
          // Yerel postlar alınamazsa sadece Firebase postları kullan
          setPosts(firebasePosts);
        }
        
        setError(null);
      } catch (err: any) {
        console.error('Blog yazıları getirilirken hata:', err);
        setError(err.message || 'Blog yazıları getirilirken bir hata oluştu');
        
        // Firebase hatası durumunda sadece yerel yazıları getirmeyi dene
        try {
          const response = await fetch('/api/blog/local-posts');
          if (response.ok) {
            const localPosts = await response.json();
            setPosts(localPosts);
            if (localPosts.length > 0) {
              setError('Firebase veritabanı erişilemedi, sadece yerel yazılar gösteriliyor.');
            }
          }
        } catch (localError) {
          console.error('Yerel blog yazıları alınırken hata:', localError);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchPosts();
  }, [isAdmin, isAdminChecking]);
  
  // Yeni yazı formu
  const [newPost, setNewPost] = useState({
    title: '',
    summary: '',
    content: '',
    slug: '',
    tags: '',
    imageUrl: '',
    author: '',
  });
  
  // Yeni yazı için girişleri güncelle
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    // Başlık giriş kontrolü
    console.log(`Input değişti: ${name}, değer: ${value}`);
    
    if (editingPost) {
      setEditingPost((prev) => ({
        ...prev!,
        [name]: value
      }));
    } else {
      setNewPost((prev) => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Slug otomatik oluşturma (sadece başlık için)
    if (name === 'title' && !editingPost) {
      // Daha iyi slug oluşturma: türkçe karakterleri dönüştür ve URL dostu hale getir
      const slugValue = value
        .toLowerCase()
        .trim()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        // Alfanümerik olmayan karakterleri tire ile değiştir
        .replace(/[^a-z0-9]+/g, '-')
        // Ardışık tireleri tekli tire yap
        .replace(/-+/g, '-')
        // Başlangıç ve bitişteki tireleri kaldır
        .replace(/^-+|-+$/g, '');
      
      setNewPost((prev) => ({
        ...prev,
        slug: slugValue
      }));
    }
  };
  
  // Yeni yazı ekle
  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validasyonu - boş başlık kontrolü
    if (!newPost.title.trim()) {
      setError('Başlık alanı boş olamaz.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null); // Hata mesajını temizle
      
      console.log('Blog yazısı ekleme işlemi başlatılıyor');
      
      // Tagleri düzenle
      const tagsArray = newPost.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);
      
      // Veriyi hazırla
      const newPostData = {
        title: newPost.title,
        summary: newPost.summary,
        content: newPost.content,
        slug: newPost.slug,
        tags: tagsArray,
        author: newPost.author || 'TaxEnough Admin',
        authorId: 'admin', // Admin sayfasından eklendiği için varsayılan olarak admin ID'si
        imageUrl: newPost.imageUrl || '',
        isPublished: true
      };
      
      console.log('Blog verisi hazırlandı:', {...newPostData, content: newPostData.content.substring(0, 50) + '...'});
      
      try {
        // Direkt Firestore'a yazmak yerine API kullan
        console.log('API üzerinden blog yazısı ekleme isteği gönderiliyor');
        
        // Token alınıyor
        const token = localStorage.getItem('userToken');
        
        // Cookie'den auth-token almak için
        const cookies = document.cookie.split(';');
        const authCookie = cookies.find(cookie => cookie.trim().startsWith('auth-token='));
        const cookieToken = authCookie ? authCookie.split('=')[1] : null;
        
        // Öncelikle cookie token kullanılacak
        const authToken = cookieToken || token;
        
        if (!authToken) {
          throw new Error('Oturum bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
        }
        
        // API isteği
        const response = await fetch('/api/blog/post', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(newPostData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error('API yanıt hatası:', result);
          throw new Error(result.error || 'Blog yazısı eklenirken bir hata oluştu');
        }
        
        console.log('Blog yazısı başarıyla eklendi:', result);
        
        // UI'ı güncelle
        const refreshedPosts = await getAllBlogPostsForAdmin();
        setPosts(refreshedPosts);
        
        // Formu sıfırla
        setNewPost({
          title: '',
          summary: '',
          content: '',
          slug: '',
          tags: '',
          imageUrl: '',
          author: ''
        });
        
        setShowNewPostForm(false);
        setError(null);
        
        // Başarı mesajı göster (opsiyonel)
        console.log('Blog yazısı başarıyla eklendi');
      } catch (addError: any) {
        console.error('Blog yazısı ekleme hatası:', addError);
        setError(addError.message || 'Blog yazısı eklenirken bir hata oluştu');
      }
    } catch (err: any) {
      console.error('Blog yazısı eklenirken hata:', err);
      setError(err.message || 'Blog yazısı eklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };
  
  // Yazı güncelleme
  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingPost) return;
    
    try {
      setLoading(true);
      
      // Tagleri düzenle
      const tagsArray = typeof editingPost.tags === 'string'
        ? (editingPost.tags as string)
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag)
        : editingPost.tags;
      
      // Firebase'e güncellenecek veriyi hazırla
      const updateData = {
        ...editingPost,
        tags: tagsArray,
        updatedAt: Timestamp.now()
      };
      
      await updateBlogPost(editingPost.id, updateData);
      
      // UI'ı güncelle
      const refreshedPosts = await getAllBlogPostsForAdmin();
      setPosts(refreshedPosts);
      
      // Düzenleme modunu kapat
      setEditingPost(null);
      setError(null);
    } catch (err: any) {
      console.error('Blog yazısı güncellenirken hata:', err);
      setError(err.message || 'Blog yazısı güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };
  
  // Yazı silme
  const handleDeletePost = async (postId: string) => {
    if (deleteConfirmation !== postId) {
      setDeleteConfirmation(postId);
      return;
    }
    
    try {
      setLoading(true);
      
      await deleteBlogPost(postId);
      
      // UI'ı güncelle
      setPosts(posts.filter(post => post.id !== postId));
      setDeleteConfirmation(null);
      setError(null);
    } catch (err: any) {
      console.error('Blog yazısı silinirken hata:', err);
      setError(err.message || 'Blog yazısı silinirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };
  
  // Timestamp veya string'i tarih olarak formatlar
  const formatDate = (dateValue: string | Timestamp | Date) => {
    if (typeof dateValue === 'string') {
      return new Date(dateValue).toLocaleDateString('tr-TR');
    } else if (dateValue instanceof Timestamp) {
      return dateValue.toDate().toLocaleDateString('tr-TR');
    } else if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('tr-TR');
    }
    return 'Tarih yok';
  };
  
  // Admin kontrol edilirken yükleniyor ekranı
  if (isAdminChecking) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center h-[50vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Yetki kontrol ediliyor...</span>
        </div>
      </div>
    );
  }
  
  // Post gelirken yükleniyor göster
  if (loading && !error && posts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">Blog Yönetimi</h1>
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="animate-pulse p-6">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2.5"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2.5"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-6"></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">Blog Yönetimi</h1>
        <button
          onClick={() => {
            setShowNewPostForm(true);
            setEditingPost(null);
          }}
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
        >
          Yeni Yazı Ekle
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Yeni yazı formu */}
      {showNewPostForm && (
        <div className="bg-white shadow overflow-hidden rounded-lg mb-8">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Yeni Blog Yazısı</h2>
            <form onSubmit={handleAddPost} id="newPostForm">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">Başlık</label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    required
                    autoComplete="off"
                    maxLength={100}
                    value={newPost.title}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div className="sm:col-span-3">
                  <label htmlFor="slug" className="block text-sm font-medium text-gray-700">Slug</label>
                  <input
                    type="text"
                    name="slug"
                    id="slug"
                    required
                    autoComplete="off"
                    value={newPost.slug}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div className="sm:col-span-6">
                  <label htmlFor="summary" className="block text-sm font-medium text-gray-700">Özet</label>
                  <input
                    type="text"
                    name="summary"
                    id="summary"
                    required
                    autoComplete="off"
                    value={newPost.summary}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div className="sm:col-span-6">
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700">İçerik</label>
                  <textarea
                    name="content"
                    id="content"
                    rows={10}
                    required
                    value={newPost.content}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Markdown formatında içerik yazabilirsiniz. Başlıklar için # ve ## kullanın."
                  ></textarea>
                </div>
                
                <div className="sm:col-span-3">
                  <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Etiketler (virgülle ayırın)</label>
                  <input
                    type="text"
                    name="tags"
                    id="tags"
                    value={newPost.tags}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="vergi, finans, yatırım"
                  />
                </div>
                
                <div className="sm:col-span-3">
                  <label htmlFor="author" className="block text-sm font-medium text-gray-700">Yazar</label>
                  <input
                    type="text"
                    name="author"
                    id="author"
                    value={newPost.author}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="TaxEnough Admin"
                  />
                </div>
                
                <div className="sm:col-span-6">
                  <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700">Görsel URL (opsiyonel)</label>
                  <input
                    type="text"
                    name="imageUrl"
                    id="imageUrl"
                    value={newPost.imageUrl}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              </div>
              
              {error && (
                <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewPostForm(false);
                    // Formu sıfırla
                    setNewPost({
                      title: '',
                      summary: '',
                      content: '',
                      slug: '',
                      tags: '',
                      imageUrl: '',
                      author: ''
                    });
                    setError(null);
                  }}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Yükleniyor...' : 'Yayınla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Yazı düzenleme formu */}
      {editingPost && (
        <div className="bg-white shadow overflow-hidden rounded-lg mb-8">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Blog Yazısını Düzenle</h2>
            <form onSubmit={handleUpdatePost}>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">Başlık</label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    required
                    value={editingPost.title}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div className="sm:col-span-3">
                  <label htmlFor="slug" className="block text-sm font-medium text-gray-700">Slug</label>
                  <input
                    type="text"
                    name="slug"
                    id="slug"
                    required
                    value={editingPost.slug}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div className="sm:col-span-6">
                  <label htmlFor="summary" className="block text-sm font-medium text-gray-700">Özet</label>
                  <input
                    type="text"
                    name="summary"
                    id="summary"
                    required
                    value={editingPost.summary}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div className="sm:col-span-6">
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700">İçerik</label>
                  <textarea
                    name="content"
                    id="content"
                    rows={10}
                    required
                    value={editingPost.content}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Markdown formatında içerik yazabilirsiniz. Başlıklar için # ve ## kullanın."
                  ></textarea>
                </div>
                
                <div className="sm:col-span-3">
                  <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Etiketler (virgülle ayırın)</label>
                  <input
                    type="text"
                    name="tags"
                    id="tags"
                    value={typeof editingPost.tags === 'string' ? editingPost.tags : editingPost.tags?.join(', ')}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="vergi, finans, yatırım"
                  />
                </div>
                
                <div className="sm:col-span-3">
                  <label htmlFor="author" className="block text-sm font-medium text-gray-700">Yazar</label>
                  <input
                    type="text"
                    name="author"
                    id="author"
                    value={editingPost.author}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div className="sm:col-span-6">
                  <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700">Görsel URL (opsiyonel)</label>
                  <input
                    type="text"
                    name="imageUrl"
                    id="imageUrl"
                    value={editingPost.imageUrl || ''}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                
                <div className="sm:col-span-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="isPublished"
                      id="isPublished"
                      checked={editingPost.isPublished}
                      onChange={(e) => setEditingPost({...editingPost, isPublished: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isPublished" className="ml-2 block text-sm text-gray-700">
                      Yayınlanmış
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Yükleniyor...' : 'Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Blog yazıları listesi */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">Blog Posts</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">You can edit all your blog posts here.</p>
        </div>
        <div className="border-t border-gray-200">
          {posts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-gray-500">Henüz blog yazısı bulunmamaktadır.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {posts.map((post) => (
                <li key={post.id} className="px-4 py-4 sm:px-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate group-hover:text-gray-600">
                        {post.title}
                        {!post.isPublished && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Taslak
                          </span>
                        )}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 truncate">{post.summary}</p>
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <span>{post.author}</span>
                        <span className="mx-1">•</span>
                        <span>{formatDate(post.createdAt)}</span>
                        {post.tags && post.tags.length > 0 && (
                          <>
                            <span className="mx-1">•</span>
                            <div className="flex flex-wrap gap-1">
                              {post.tags.slice(0, 3).map((tag, index) => (
                                <span key={index} className="text-blue-600">#{tag}</span>
                              ))}
                              {post.tags.length > 3 && (
                                <span className="text-gray-500">+{post.tags.length - 3}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 md:mt-0 flex flex-shrink-0 ml-4 space-x-2">
                      <button
                        onClick={() => setEditingPost(post)}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className={`inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                          deleteConfirmation === post.id
                            ? 'text-white bg-red-600 hover:bg-red-700'
                            : 'text-red-700 bg-red-100 hover:bg-red-200'
                        }`}
                      >
                        {deleteConfirmation === post.id ? 'Emin misiniz?' : 'Sil'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
} 