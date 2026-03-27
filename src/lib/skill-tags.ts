import prisma from "@/lib/prisma";

export const SKILL_CATEGORIES: { label: string; skills: string[] }[] = [
  {
    label: "🧩 Frontend",
    skills: [
      "HTML",
      "CSS",
      "JavaScript",
      "TypeScript",
      "React",
      "Vue",
      "Next.js",
      "Nuxt.js",
      "Svelte",
      "Адаптивная верстка",
      "Tailwind CSS",
      "SCSS / SASS",
      "UI/UX интеграция",
    ],
  },
  {
    label: "⚙️ Backend",
    skills: ["Node.js", "Express", "NestJS", "REST API", "GraphQL", "PHP", "Laravel"],
  },
  {
    label: "🛠 CMS",
    skills: ["WordPress", "Tilda", "Webflow", "OpenCart", "Shopify"],
  },
  {
    label: "🎨 Дизайн",
    skills: [
      "Figma",
      "UI/UX дизайн",
      "Прототипирование",
      "Дизайн лендингов",
      "Дизайн маркетплейсов",
    ],
  },
  {
    label: "🧠 Дополнительно",
    skills: [
      "Git / GitHub",
      "Работа с API",
      "Интеграции сервисов",
      "SEO базовое",
      "Оптимизация скорости",
      "Анимации (Framer Motion и т.п.)",
    ],
  },
];

export const DEFAULT_SKILLS = SKILL_CATEGORIES.flatMap((c) => c.skills);

/** Уникальные теги навыков из исполнителей и шаблонов — для выбора в формах. */
export async function getSkillTagOptions(): Promise<string[]> {
  const [executors, templates] = await Promise.all([
    prisma.user.findMany({
      where: { role: "executor" },
      select: { skills: true },
    }),
    prisma.orderTemplate.findMany({ select: { tags: true } }),
  ]);
  const set = new Set<string>(DEFAULT_SKILLS);
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
  return [...set];
}
