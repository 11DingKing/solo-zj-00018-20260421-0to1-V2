export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  order: number;
  postCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Author {
  _id: string;
  username: string;
}

export interface Post {
  _id: string;
  title: string;
  content: string;
  categoryId: string;
  userId: string;
  isPinned: boolean;
  replyCount: number;
  likeCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  category?: { _id: string; name: string; slug: string };
  author?: Author;
  isLiked?: boolean;
}

export interface Reply {
  _id: string;
  postId: string;
  userId: Author;
  parentId?: string;
  replyToUserId?: Author;
  content: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  children?: Reply[];
}

export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
}
