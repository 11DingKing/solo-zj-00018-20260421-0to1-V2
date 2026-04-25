import mongoose, { Schema, Document, Types } from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/forum";

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected successfully");

    await createIndexes();
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  const db = mongoose.connection.db;

  await db.collection("users").createIndex({ username: 1 }, { unique: true });

  await db.collection("categories").createIndex({ name: 1 }, { unique: true });
  await db.collection("categories").createIndex({ slug: 1 }, { unique: true });

  await db.collection("posts").createIndex({ categoryId: 1, createdAt: -1 });
  await db
    .collection("posts")
    .createIndex({ categoryId: 1, replyCount: -1, createdAt: -1 });
  await db.collection("posts").createIndex({ isPinned: -1, createdAt: -1 });
  await db
    .collection("posts")
    .createIndex({ categoryId: 1, isPinned: -1, createdAt: -1 });
  await db.collection("posts").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("posts").createIndex({ _id: 1, categoryId: 1 });

  await db.collection("replies").createIndex({ postId: 1, createdAt: 1 });
  await db.collection("replies").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("replies").createIndex({ parentId: 1, createdAt: 1 });

  await db
    .collection("likes")
    .createIndex({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
  await db.collection("likes").createIndex({ targetId: 1, targetType: 1 });

  console.log("Database indexes created successfully");
};

export { Schema, Document, Types };
export default mongoose;
