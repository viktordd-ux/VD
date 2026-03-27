import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

async function main() {
  const passwordHash = await hash("admin123", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@vd.local" },
    update: { passwordHash, status: "active" },
    create: {
      name: "Admin V|D",
      email: "admin@vd.local",
      passwordHash,
      role: "admin",
      status: "active",
    },
  });
  console.log("Admin created/updated:", user.email, "/ password: admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
