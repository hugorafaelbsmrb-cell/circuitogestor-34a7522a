import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY_API = 'external_api_key';
const STORAGE_KEY_URL = 'external_api_base_url';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export function useExternalApi() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const getConfig = () => {
    const apiKey = localStorage.getItem(STORAGE_KEY_API) || '';
    const baseUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
    return { apiKey, baseUrl };
  };

  const request = async <T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: Record<string, unknown>;
      params?: Record<string, string>;
    } = {}
  ): Promise<ApiResponse<T>> => {
    const { apiKey, baseUrl } = getConfig();
    
    if (!apiKey || !baseUrl) {
      toast({
        title: 'API não configurada',
        description: 'Configure a chave de API primeiro',
        variant: 'destructive',
      });
      return { error: 'API not configured' };
    }

    setIsLoading(true);

    try {
      const url = new URL(`${baseUrl}/${endpoint}`);
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return { data: data.data || data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro na requisição',
        description: message,
        variant: 'destructive',
      });
      return { error: message };
    } finally {
      setIsLoading(false);
    }
  };

  // Products API
  const getProducts = () => request<Product[]>('api-products');
  const getProduct = (id: string) => request<Product>('api-products', { params: { id } });
  const createProduct = (product: Partial<Product>) => 
    request<Product>('api-products', { method: 'POST', body: product });
  const updateProduct = (id: string, product: Partial<Product>) => 
    request<Product>('api-products', { method: 'PUT', params: { id }, body: product });
  const deleteProduct = (id: string) => 
    request('api-products', { method: 'DELETE', params: { id } });

  // Categories API
  const getCategories = () => request<Category[]>('api-categories');
  const getCategory = (id: string) => request<Category>('api-categories', { params: { id } });
  const createCategory = (category: Partial<Category>) => 
    request<Category>('api-categories', { method: 'POST', body: category });
  const updateCategory = (id: string, category: Partial<Category>) => 
    request<Category>('api-categories', { method: 'PUT', params: { id }, body: category });
  const deleteCategory = (id: string) => 
    request('api-categories', { method: 'DELETE', params: { id } });

  // Orders API
  const getOrders = (status?: string) => 
    request<Order[]>('api-orders', { params: status ? { status } : undefined });
  const getOrder = (id: string) => request<Order>('api-orders', { params: { id } });
  const updateOrder = (id: string, order: Partial<Order>) => 
    request<Order>('api-orders', { method: 'PUT', params: { id }, body: order });
  const deleteOrder = (id: string) => 
    request('api-orders', { method: 'DELETE', params: { id } });

  // Users API
  const getUsers = () => request<User[]>('api-users');
  const getUser = (id: string) => request<User>('api-users', { params: { id } });
  const updateUser = (id: string, user: Partial<User>) => 
    request<User>('api-users', { method: 'PUT', params: { id }, body: user });
  const addUserRole = (userId: string, role: string) => 
    request('api-users', { method: 'POST', body: { user_id: userId, role } });
  const removeUserRole = (userId: string, role: string) => 
    request('api-users', { method: 'DELETE', params: { id: userId, role } });

  // Site Content API
  const getSiteContent = () => request<SiteContent[]>('api-site-content');
  const getSiteSection = (sectionKey: string) => 
    request<SiteContent>('api-site-content', { params: { section_key: sectionKey } });
  const createSiteContent = (content: Partial<SiteContent>) => 
    request<SiteContent>('api-site-content', { method: 'POST', body: content });
  const updateSiteContent = (sectionKey: string, content: Record<string, unknown>) => 
    request<SiteContent>('api-site-content', { method: 'PUT', params: { section_key: sectionKey }, body: { content } });
  const deleteSiteContent = (sectionKey: string) => 
    request('api-site-content', { method: 'DELETE', params: { section_key: sectionKey } });

  // Images API
  const getImages = (folder?: string, bucket?: string) => {
    const params: Record<string, string> = {};
    if (folder) params.folder = folder;
    if (bucket) params.bucket = bucket;
    return request<ImageFile[]>('api-images', { params: Object.keys(params).length ? params : undefined });
  };
  const uploadImage = (fileName: string, base64Data: string, contentType: string, folder?: string) => 
    request<{ path: string; publicUrl: string }>('api-images', { 
      method: 'POST', 
      body: { fileName, base64Data, contentType, folder } 
    });
  const deleteImage = (path: string) => 
    request('api-images', { method: 'DELETE', params: { path } });

  return {
    isLoading,
    // Products
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    // Categories
    getCategories,
    getCategory,
    createCategory,
    updateCategory,
    deleteCategory,
    // Orders
    getOrders,
    getOrder,
    updateOrder,
    deleteOrder,
    // Users
    getUsers,
    getUser,
    updateUser,
    addUserRole,
    removeUserRole,
    // Site Content
    getSiteContent,
    getSiteSection,
    createSiteContent,
    updateSiteContent,
    deleteSiteContent,
    // Images
    getImages,
    uploadImage,
    deleteImage,
  };
}

// Types
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category_id?: string;
  image_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  created_at?: string;
}

export interface Order {
  id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
  profile?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  product?: Product;
}

export interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  roles?: string[];
  created_at?: string;
}

export interface SiteContent {
  id: string;
  section_key: string;
  content: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ImageFile {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}
