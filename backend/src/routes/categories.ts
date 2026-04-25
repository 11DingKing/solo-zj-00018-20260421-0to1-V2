import { Hono } from 'hono';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import Category from '../models/Category';
import Post from '../models/Post';

const categories = new Hono();

categories.get('/', async (c) => {
  try {
    const categoryList = await Category.find().sort({ order: 1, createdAt: 1 });
    
    const categoriesWithCount = await Promise.all(
      categoryList.map(async (cat) => {
        const postCount = await Post.countDocuments({ categoryId: cat._id });
        return {
          ...cat.toObject(),
          postCount,
        };
      })
    );
    
    return c.json(categoriesWithCount);
  } catch (error) {
    console.error('Get categories error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

categories.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    
    const category = await Category.findById(id);
    
    if (!category) {
      return c.json({ error: 'Category not found' }, 404);
    }
    
    const postCount = await Post.countDocuments({ categoryId: category._id });
    
    return c.json({
      ...category.toObject(),
      postCount,
    });
  } catch (error) {
    console.error('Get category error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

categories.post('/', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { name, slug, description, icon, order } = await c.req.json();
    
    if (!name || !slug) {
      return c.json({ error: 'Name and slug are required' }, 400);
    }
    
    const existingCategory = await Category.findOne({
      $or: [{ name: name.trim() }, { slug: slug.trim().toLowerCase() }],
    });
    
    if (existingCategory) {
      return c.json({ error: 'Category name or slug already exists' }, 409);
    }
    
    const category = new Category({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description || '',
      icon,
      order: order || 0,
    });
    
    await category.save();
    
    return c.json(category, 201);
  } catch (error) {
    console.error('Create category error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

categories.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    const { name, slug, description, icon, order } = await c.req.json();
    
    const existingCategory = await Category.findById(id);
    
    if (!existingCategory) {
      return c.json({ error: 'Category not found' }, 404);
    }
    
    const duplicateCategory = await Category.findOne({
      _id: { $ne: id },
      $or: [
        { name: name?.trim() },
        { slug: slug?.trim().toLowerCase() },
      ],
    });
    
    if (duplicateCategory) {
      return c.json({ error: 'Category name or slug already exists' }, 409);
    }
    
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (slug !== undefined) updateData.slug = slug.trim().toLowerCase();
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (order !== undefined) updateData.order = order;
    
    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    return c.json(updatedCategory);
  } catch (error) {
    console.error('Update category error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

categories.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  try {
    const { id } = c.req.param();
    
    const postCount = await Post.countDocuments({ categoryId: id });
    
    if (postCount > 0) {
      return c.json({ error: 'Cannot delete category with existing posts' }, 400);
    }
    
    const deletedCategory = await Category.findByIdAndDelete(id);
    
    if (!deletedCategory) {
      return c.json({ error: 'Category not found' }, 404);
    }
    
    return c.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default categories;
