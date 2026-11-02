import { PrismaClient } from '@prisma/client';
import { onShutdown } from '@st/core';

const prisma = new PrismaClient();

export default prisma;

export const connectDB = () => prisma.$connect();
export const disconnectDB = () => prisma.$disconnect();

onShutdown(disconnectDB);
