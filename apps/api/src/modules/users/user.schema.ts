import { Schema, type HydratedDocument } from 'mongoose';

export interface User {
  name: string; email: string; passwordHash: string; role: 'admin'; active: boolean;
  sessionVersion: number; createdAt: Date; updatedAt: Date;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = new Schema<User>({
  name: { type: String, required: true },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin'], required: true },
  active: { type: Boolean, default: true, required: true },
  sessionVersion: { type: Number, default: 0, required: true },
}, { timestamps: true, collection: 'users' });
UserSchema.index({ email: 1 }, { unique: true });
