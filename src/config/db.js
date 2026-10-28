import mongoose from 'mongoose';

export async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  // Ensure the unique email index exists before accepting writes.
  const { default: User } = await import('../models/User.js');
  await User.init();
  await User.createIndexes();
}

export const disconnectDB = () => mongoose.disconnect();
