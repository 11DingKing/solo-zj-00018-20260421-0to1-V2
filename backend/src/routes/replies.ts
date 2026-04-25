import { Hono } from 'hono';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import Reply from '../models/Reply';
import Post from '../models/Post';
import Like from '../models/Like';
import { Types } from 'mongoose';

const replies = new Hono();

replies.get('/my', authMiddleware, async (c) => {
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
    
    const replyList = await Reply.find(filter)
      .sort({ _id: -1 })
      .limit(limit)
      .populate('postId', 'title')
      .populate('userId', 'username');
    
    const hasMore = replyList.length === limit;
    
    return c.json({
      data: replyList,
      hasMore,
      nextCursor: hasMore ? replyList[replyList.length - 1]._id.toString() : null,
    });
  } catch (error) {
    console.error('Get my replies error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

replies.get('/', async (c) => {
  try {
    const postId = c.req.query('postId');
    
    if (!postId) {
      return c.json({ error: 'postId is required' }, 400);
    }
    
    if (!Types.ObjectId.isValid(postId)) {
      return c.json({ error: 'Invalid postId' }, 400);
    }
    
    const repliesList = await Reply.find({ postId: new Types.ObjectId(postId), parentId: { $exists: false } })
      .sort({ createdAt: 1 })
      .populate('userId', 'username');
    
    const nestedReplies = await Promise.all(
      repliesList.map(async (reply) => {
        const children = await Reply.find({ parentId: reply._id })
          .sort({ createdAt: 1 })
          .populate('userId', 'username')
          .populate('replyToUserId', 'username');
        
        return {
          ...reply.toObject(),
          children,
        };
      })
    );
    
    return c.json(nestedReplies);
  } catch (error) {
    console.error('Get replies error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

replies.post('/', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { postId, content, parentId, replyToUserId } = await c.req.json();
    
    if (!postId) {
      return c.json({ error: 'postId is required' }, 400);
    }
    
    if (!Types.ObjectId.isValid(postId)) {
      return c.json({ error: 'Invalid postId' }, 400);
    }
    
    if (!content || !content.trim()) {
      return c.json({ error: 'Content is required' }, 400);
    }
    
    const post = await Post.findById(postId);
    
    if (!post) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    let parentReply: Awaited<ReturnType<typeof Reply.findById>> | null = null;
    if (parentId) {
      if (!Types.ObjectId.isValid(parentId)) {
        return c.json({ error: 'Invalid parentId' }, 400);
      }
      parentReply = await Reply.findById(parentId);
      if (!parentReply) {
        return c.json({ error: 'Parent reply not found' }, 404);
      }
    }
    
    const reply = new Reply({
      postId: new Types.ObjectId(postId),
      userId,
      content: content.trim(),
      ...(parentId ? { 
        parentId: new Types.ObjectId(parentId),
        ...(replyToUserId ? { replyToUserId: new Types.ObjectId(replyToUserId) } : {})
      } : {}),
    });
    
    await reply.save();
    
    await Post.findByIdAndUpdate(postId, { $inc: { replyCount: 1 } });
    
    const populatedReply = await Reply.findById(reply._id)
      .populate('userId', 'username')
      .populate('replyToUserId', 'username');
    
    return c.json(populatedReply, 201);
  } catch (error) {
    console.error('Create reply error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

replies.put('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const userId = c.get('userId');
    const isAdmin = c.get('isAdmin');
    const { content } = await c.req.json();
    
    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid reply ID' }, 400);
    }
    
    if (!content || !content.trim()) {
      return c.json({ error: 'Content is required' }, 400);
    }
    
    const reply = await Reply.findById(id);
    
    if (!reply) {
      return c.json({ error: 'Reply not found' }, 404);
    }
    
    if (!reply.userId.equals(userId) && !isAdmin) {
      return c.json({ error: 'Not authorized to edit this reply' }, 403);
    }
    
    const updatedReply = await Reply.findByIdAndUpdate(
      id,
      { content: content.trim() },
      { new: true }
    ).populate('userId', 'username');
    
    return c.json(updatedReply);
  } catch (error) {
    console.error('Update reply error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

replies.delete('/:id', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const userId = c.get('userId');
    const isAdmin = c.get('isAdmin');
    
    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid reply ID' }, 400);
    }
    
    const reply = await Reply.findById(id);
    
    if (!reply) {
      return c.json({ error: 'Reply not found' }, 404);
    }
    
    if (!reply.userId.equals(userId) && !isAdmin) {
      return c.json({ error: 'Not authorized to delete this reply' }, 403);
    }
    
    const childReplies = await Reply.find({ parentId: id });
    const totalRepliesToDelete = 1 + childReplies.length;
    
    const allReplyIds = [id, ...childReplies.map(r => r._id.toString())];
    
    await Like.deleteMany({ targetId: { $in: allReplyIds }, targetType: 'reply' });
    await Reply.deleteMany({ _id: { $in: allReplyIds } });
    await Post.findByIdAndUpdate(reply.postId, { $inc: { replyCount: -totalRepliesToDelete } });
    
    return c.json({ message: 'Reply deleted successfully' });
  } catch (error) {
    console.error('Delete reply error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

replies.post('/:id/like', authMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const userId = c.get('userId');
    
    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid reply ID' }, 400);
    }
    
    const reply = await Reply.findById(id);
    
    if (!reply) {
      return c.json({ error: 'Reply not found' }, 404);
    }
    
    const existingLike = await Like.findOne({
      userId,
      targetId: new Types.ObjectId(id),
      targetType: 'reply',
    });
    
    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      await Reply.findByIdAndUpdate(id, { $inc: { likeCount: -1 } });
      return c.json({ liked: false, likeCount: reply.likeCount - 1 });
    } else {
      await Like.create({
        userId,
        targetId: new Types.ObjectId(id),
        targetType: 'reply',
      });
      await Reply.findByIdAndUpdate(id, { $inc: { likeCount: 1 } });
      return c.json({ liked: true, likeCount: reply.likeCount + 1 });
    }
  } catch (error) {
    console.error('Like reply error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default replies;
