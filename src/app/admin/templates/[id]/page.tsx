import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { TemplateForm } from "../template-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditTemplatePage({ params }: Props) {
  const { id } = await params;
  const template = await prisma.orderTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/templates" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← К шаблонам
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Редактировать: {template.title}</h1>
      <TemplateForm template={template} />
    </div>
  );
}
