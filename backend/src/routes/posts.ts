import { Hono } from 'hono';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import Post from '../models/Post';
import Category from '../models/Category';
import Like from '../models/Like';
import Reply from '../models/Reply';
import { Types } from 'mongoose';

const posts = new Hono();

posts.get('/', async (c) => {
  try {
    const categoryId = c.req.query('categoryId');
    const sort = c.req.query('sort') || 'latest';
    const limit = parseInt(c.req.query('limit') || '20');
    const before = c.req.query('before');
    
    if (limit > 100) {
      return c.json({ error: 'Limit cannot exceed 100' }, 400);
    }
    
    const filter: Record<string, unknown> = {};
    
    if (categoryId) {
      if (!Types.ObjectId.isValid(categoryId)) {
        return c.json({ error: 'Invalid categoryId' }, 400);
      }
      filter.categoryId = new Types.ObjectId(categoryId);
    }
    
    if (before) {
      if (!Types.ObjectId.isValid(before)) {
        return c.json({ error: 'Invalid before cursor' }, 400);
      }
      filter._id = { $lt: new Types.ObjectId(before) };
    }
    
    let sortOptions: Record<string, number>;
    if (sort === 'hot') {
      sortOptions = { isPinned: -1, replyCount: -1, _id: -1 };
    } else {
      sortOptions = { isPinned: -1, _id: -1 };
    }
    
    const postList = await Post.find(filter)
      .sort(sortOptions)
      .limit(limit)
      .populate('userId', 'username')
      .populate('categoryId', 'name slug');
    
    const hasMore = postList.length === limit;
    
    const postsWithLikeStatus = await Promise.all(
      postList.map(async (post) => {
        const postObj = post.toObject();
        return {
          ...postObj,
          category: postObj.categoryId,
          author: postObj.userId,
          isLiked: false,
        };
      })
    );
    
    return c.json({
      data: postsWithLikeStatus,
      hasMore,
      nextCursor: hasMore ? postList[postList.length - 1]._id.toString() : null,
    });
  } catch (error) {
    console.error('Get posts error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

posts.get('/my', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const limit = parseInt(c.req.query('limit') || '20');
    const before = c.req.query('before');
    
    if (limit > 100) {
      return c.json({ error: 'Limit cannot exceed 100' }, 400);
    }
    
    const filter: Record<string, unknown> = { userId };
    
    if (before) {
      if (!Types.ObjectId.isValid(before)) {
        return c.json({ error: 'Invalid before cursor' }, 400);
      }
      filter._id = { $lt: new Types.ObjectId(before) };
    }
    
    const postList = await Post.find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('categoryId', 'name slug');
    
    const hasMore = postList.length === limit;
    
    return c.json({
      data: postList,
      hasMore,
      nextCursor: hasMore ? postList[postList.length - 1]._id.toString() : null,
    });
  } catch (error) {
    console.error('Get my posts error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

posts.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    
    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid post ID' }, 400);
    }
    
    const post = await Post.findById(id)
      .populate('userId', 'username')
      .populate('categoryId', 'name slug');
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    await Post.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
    
    const postObj = post.toObject();
    return c.json({
      ...postObj,
      category: postObj.categoryId,
      author: postObj.userId,
      isLiked: false,
    });
  } catch (error) {
    console.error('Get post error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

posts.post('/', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { title, content, categoryId } = await c.req.json();
    
    if (!title || !title.trim()) {
      return c.json({ error: 'Title is required' }, 400);
    }
    
    if (!content || !content.trim()) {
      return c.json({ error: 'Content is required' }, 400);
    }
    
    if (!categoryId) {
      return c.json({ error: 'Category is required' }, 400);
    }
    
    if (!Types.ObjectId.isValid(categoryId)) {
      return c.json({ error: 'Invalid categoryId' }, 400);
    }
    
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return c.json({ error: 'Category not found' }, 404);
    }
    
    const post = new Post({
      title: title.trim(),
      content: content.trim(),
      categoryId: new Types.ObjectId(categoryId),
      userId,
    });
    
    await post.save();
    
    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'username')
      .populate('categoryId', 'name slug');
    
    return c.json(populatedPost, 201);
  } catch (error) {
    console.error('Create post error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

posts.put('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const userId = c.get('userId');
    const isAdmin = c.get('isAdmin');
    const { title, content, categoryId } = await c.req.json();
    
    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid post ID' }, 400);
    }
    
    const post = await Post.findById(id);
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    if (!post.userId.equals(userId) && !isAdmin) {
      return c.json({ error: 'Not authorized to edit this post' }, 403);
    }
    
    const updateData: Record<string, unknown> = {};
    
    if (title !== undefined && title.trim()) {
      updateData.title = title.trim();
    }
    
    if (content !== undefined && content.trim()) {
      updateData.content = content.trim();
    }
    
    if (categoryId !== undefined) {
      if (!Types.ObjectId.isValid(categoryId)) {
        return c.json({ error: 'Invalid categoryId' }, 400);
      }
      const category = await Category.findById(categoryId);
      if (!category) {
        return c.json({ error: 'Category not found' }, 404);
      }
      updateData.categoryId = new Types.ObjectId(categoryId);
    }
    
    const updatedPost = await Post.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('userId', 'username')
    .populate('categoryId', 'name slug');
    
    return c.json(updatedPost);
  } catch (error) {
    console.error('Update post error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

posts.put('/:id/pin', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { isPinned } = await c.req.json();
    
    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid post ID' }, 400);
    }
    
    const post = await Post.findByIdAndUpdate(
      id,
      { isPinned: !!isPinned },
      { new: true }
    );
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    return c.json(post);
  } catch (error) {
    console.error('Pin post error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

posts.delete('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const userId = c.get('userId');
    const isAdmin = c.get('isAdmin');
    
    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid post ID' }, 400);
    }
    
    const post = await Post.findById(id);
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    if (!post.userId.equals(userId) && !isAdmin) {
      return c.json({ error: 'Not authorized to delete this post' }, 403);
    }
    
    await Like.deleteMany({ targetId: id, targetType: 'post' });
    await Reply.deleteMany({ postId: id });
    await Post.findByIdAndDelete(id);
    
    return c.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

posts.post('/:id/like', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const userId = c.get('userId');
    
    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid post ID' }, 400);
    }
    
    const post = await Post.findById(id);
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    const existingLike = await Like.findOne({
      userId,
      targetId: new Types.ObjectId(id),
      targetType: 'post',
    });
    
    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      await Post.findByIdAndUpdate(id, { $inc: { likeCount: -1 } });
      return c.json({ liked: false, likeCount: post.likeCount - 1 });
    } else {
      await Like.create({
        userId,
        targetId: new Types.ObjectId(id),
        targetType: 'post',
      });
      await Post.findByIdAndUpdate(id, { $inc: { likeCount: 1 } });
      return c.json({ liked: true, likeCount: post.likeCount + 1 });
    }
  } catch (error) {
    console.error('Like post error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default posts;
