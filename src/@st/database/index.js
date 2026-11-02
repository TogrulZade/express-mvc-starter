import mongoose from 'mongoose';
import { onShutdown } from '@st/core';

export async function connectDB() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
}

export const disconnectDB = () => mongoose.disconnect();

onShutdown(disconnectDB);
