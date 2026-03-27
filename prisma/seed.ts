import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await hash("admin123", 10);
  const execHash = await hash("executor123", 10);

  await prisma.user.upsert({
    where: { email: "admin@vd.local" },
    update: {
      passwordHash: adminHash,
      status: "active",
    },
    create: {
      name: "Admin V|D",
      email: "admin@vd.local",
      passwordHash: adminHash,
      role: "admin",
      status: "active",
    },
  });

  const executor = await prisma.user.upsert({
    where: { email: "executor@vd.local" },
    update: {
      passwordHash: execHash,
      skills: ["layout", "react", "figma"],
      primarySkill: "react",
      onboarded: true,
      firstName: "Исполнитель",
      lastName: "Тестовый",
      name: "Исполнитель Тестовый",
      status: "active",
    },
    create: {
      name: "Исполнитель Тестовый",
      firstName: "Исполнитель",
      lastName: "Тестовый",
      email: "executor@vd.local",
      passwordHash: execHash,
      role: "executor",
      status: "active",
      phone: "+79990000000",
      telegram: "@executor_vd",
      skills: ["layout", "react", "figma"],
      primarySkill: "react",
      onboarded: true,
    },
  });

  await prisma.orderTemplate.upsert({
    where: { id: "seed-tpl-landing" },
    update: {},
    create: {
      id: "seed-tpl-landing",
      title: "Лендинг",
      descriptionTemplate:
        "Типовое ТЗ:\n- структура секций\n- адаптив\n- формы и отправка",
      defaultCheckpoints: [
        { title: "Макет главной", due_offset_days: 3 },
        { title: "Верстка и адаптив", due_offset_days: 7 },
      ],
      tags: ["layout", "frontend"],
    },
  });

  const lead = await prisma.lead.upsert({
    where: { id: "seed-lead-1" },
    update: {},
    create: {
      id: "seed-lead-1",
      link: "https://example.com/brief",
      clientName: "Тестовый клиент",
      platform: "Telegram",
      text: "Нужен лендинг и интеграция с формой.",
      notes: "Первый контакт",
      status: "NEW",
    },
  });

  await prisma.order.upsert({
    where: { id: "seed-order-1" },
    update: {},
    create: {
      id: "seed-order-1",
      title: "Лендинг — тест",
      description: "ТЗ: блоки hero, услуги, контакты.",
      clientName: "Тестовый клиент",
      platform: "Web",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      budgetClient: 50000,
      budgetExecutor: 30000,
      profit: 20000,
      status: "IN_PROGRESS",
      executorId: executor.id,
      leadId: lead.id,
    },
  });

  await prisma.checkpoint.deleteMany({ where: { orderId: "seed-order-1" } });
  await prisma.checkpoint.createMany({
    data: [
      {
        orderId: "seed-order-1",
        title: "Макет главной",
        status: "pending",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      {
        orderId: "seed-order-1",
        title: "Верстка",
        status: "pending",
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log("Seed OK. admin@vd.local / admin123, executor@vd.local / executor123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
