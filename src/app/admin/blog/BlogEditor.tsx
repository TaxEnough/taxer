'use client';

import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { BlogPost, updateBlogPost, getAllBlogPostsForAdmin } from '@/lib/blog-firebase';

interface BlogEditorProps {
  post: BlogPost;
  onUpdate: (posts: BlogPost[]) => void;
  onCancel: () => void;
}

export default function BlogEditor({ post, onUpdate, onCancel }: BlogEditorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost>(post);

  // Input değişikliklerini işle
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingPost(prev => ({ ...prev, [name]: value }));
  };

  // Yazı güncelleme
  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      
      // Ana bileşene güncelleme bildir
      onUpdate(refreshedPosts);
      
      // Başarı mesajı göster
      alert('Blog yazısı başarıyla güncellendi');
    } catch (err: any) {
      console.error('Blog yazısı güncellenirken hata:', err);
      setError(err.message || 'Blog yazısı güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden rounded-lg mb-8">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Blog Yazısını Düzenle</h2>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}
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
              <textarea
                name="summary"
                id="summary"
                required
                rows={3}
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
            
            <div className="sm:col-span-6">
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700">Etiketler</label>
              <input
                type="text"
                name="tags"
                id="tags"
                value={Array.isArray(editingPost.tags) ? editingPost.tags.join(', ') : (editingPost.tags || '')}
                onChange={handleInputChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Virgülle ayırarak birden fazla etiket girebilirsiniz"
              />
            </div>
            
            <div className="sm:col-span-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isPublished"
                  name="isPublished"
                  checked={editingPost.isPublished}
                  onChange={(e) => setEditingPost({...editingPost, isPublished: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPublished" className="ml-2 block text-sm text-gray-700">
                  Yayımla
                </label>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 