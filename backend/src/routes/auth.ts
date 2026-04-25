import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import User from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

const auth = new Hono();

auth.post('/register', async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    if (!username || username.length < 2 || username.length > 20) {
      return c.json({ error: 'Username must be between 2-20 characters' }, 400);
    }
    
    if (!password || password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400);
    }
    
    const existingUser = await User.findOne({ username: username.trim().toLowerCase() });
    
    if (existingUser) {
      return c.json({ error: 'Username already exists' }, 409);
    }
    
    const hashedPassword = await hashPassword(password);
    
    const isFirstUser = (await User.countDocuments()) === 0;
    
    const user = new User({
      username: username.trim(),
      password: hashedPassword,
      isAdmin: isFirstUser,
    });
    
    await user.save();
    
    const token = generateToken(user._id, user.username, user.isAdmin);
    
    return c.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
      },
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

auth.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    if (!username || !password) {
      return c.json({ error: 'Username and password are required' }, 400);
    }
    
    const user = await User.findOne({ username: username.trim() });
    
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    const isPasswordValid = await comparePassword(password, user.password);
    
    if (!isPasswordValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    const token = generateToken(user._id, user.username, user.isAdmin);
    
    return c.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

auth.get('/me', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    
    const user = await User.findById(userId).select('-password');
    
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

export default auth;
