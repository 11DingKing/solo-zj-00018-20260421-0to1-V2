import mongoose, { Schema, Document } from '../db';

export interface ILike extends Document {
  userId: mongoose.Types.ObjectId;
  targetId: mongoose.Types.ObjectId;
  targetType: 'post' | 'reply';
  createdAt: Date;
}

const LikeSchema: Schema = new Schema<ILike>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    targetType: {
      type: String,
      enum: ['post', 'reply'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

LikeSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });

export default mongoose.model<ILike>('Like', LikeSchema);
