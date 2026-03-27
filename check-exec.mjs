import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const execs = await p.user.findMany({
  where: { role: 'executor', status: 'active' },
  select: { id: true, email: true, name: true, onboarded: true }
});
console.log('Executors:', JSON.stringify(execs, null, 2));

const orders = await p.order.findMany({
  where: { deletedAt: null, executorId: { not: null } },
  select: { id: true, title: true, executorId: true, status: true },
  take: 5
});
console.log('Orders with executor:', JSON.stringify(orders, null, 2));

await p.$disconnect();
