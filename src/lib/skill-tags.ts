import prisma from "@/lib/prisma";

/** Уникальные теги навыков из исполнителей и шаблонов — для выбора в формах. */
export async function getSkillTagOptions(): Promise<string[]> {
  const [executors, templates] = await Promise.all([
    prisma.user.findMany({
      where: { role: "executor" },
      select: { skills: true },
    }),
    prisma.orderTemplate.findMany({ select: { tags: true } }),
  ]);
  const set = new Set<string>();
  for (const u of executors) {
    for (const s of u.skills) {
      const t = s.trim();
      if (t) set.add(t);
    }
  }
  for (const tpl of templates) {
    for (const s of tpl.tags) {
      const t = s.trim();
      if (t) set.add(t);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ru"));
}
