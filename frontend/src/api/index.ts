import axios from 'axios';
import type { User, Category, Post, Reply, PaginatedResponse } from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (username: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/register', { username, password }),
  
  login: (username: string, password: string) =>
    api.post<{ token: string; user: User }>('/auth/login', { username, password }),
  
  getMe: () =>
    api.get<User>('/auth/me'),
};

export const categoryAPI = {
  getAll: () => api.get<Category[]>('/categories'),
  
  getById: (id: string) => api.get<Category>(`/categories/${id}`),
  
  create: (data: Partial<Category>) =>
    api.post<Category>('/categories', data),
  
  update: (id: string, data: Partial<Category>) =>
    api.put<Category>(`/categories/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/categories/${id}`),
};

export const postAPI = {
  getAll: (params?: {
    categoryId?: string;
    sort?: 'latest' | 'hot';
    limit?: number;
    before?: string;
  }) =>
    api.get<PaginatedResponse<Post>>('/posts', { params }),
  
  getMy: (params?: { limit?: number; before?: string }) =>
    api.get<PaginatedResponse<Post>>('/posts/my', { params }),
  
  getById: (id: string) =>
    api.get<Post>(`/posts/${id}`),
  
  create: (data: { title: string; content: string; categoryId: string }) =>
    api.post<Post>('/posts', data),
  
  update: (id: string, data: Partial<{ title: string; content: string; categoryId: string }>) =>
    api.put<Post>(`/posts/${id}`, data),
  
  pin: (id: string, isPinned: boolean) =>
    api.put<Post>(`/posts/${id}/pin`, { isPinned }),
  
  delete: (id: string) =>
    api.delete(`/posts/${id}`),
  
  like: (id: string) =>
    api.post<{ liked: boolean; likeCount: number }>(`/posts/${id}/like`),
};

export const replyAPI = {
  getByPost: (postId: string) =>
    api.get<Reply[]>('/replies', { params: { postId } }),
  
  getMy: (params?: { limit?: number; before?: string }) =>
    api.get<PaginatedResponse<Reply>>('/replies/my', { params }),
  
  create: (data: {
    postId: string;
    content: string;
    parentId?: string;
    replyToUserId?: string;
  }) =>
    api.post<Reply>('/replies', data),
  
  update: (id: string, content: string) =>
    api.put<Reply>(`/replies/${id}`, { content }),
  
  delete: (id: string) =>
    api.delete(`/replies/${id}`),
  
  like: (id: string) =>
    api.post<{ liked: boolean; likeCount: number }>(`/replies/${id}/like`),
};

export default api;
