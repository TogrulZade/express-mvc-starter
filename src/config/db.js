import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;

export const connectDB = () => prisma.$connect();
export const disconnectDB = () => prisma.$disconnect();
