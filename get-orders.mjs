import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const orders = await prisma.order.findMany({ take: 3, where: { deletedAt: null }, select: { id: true, title: true, status: true } });
console.log(JSON.stringify(orders, null, 2));
await prisma.$disconnect();
