import { Hono } from 'hono';
import User from '../models/User';
import { Types } from 'mongoose';

const users = new Hono();

users.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    if (!Types.ObjectId.isValid(id)) {
      return c.json({ error: 'Invalid user ID' }, 400);
    }

    const user = await User.findById(id).select('-password');

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      id: user._id,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default users;
