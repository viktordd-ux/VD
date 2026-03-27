import Link from "next/link";
import { TemplateForm } from "../template-form";

export default function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <Link href="/admin/templates" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← К шаблонам
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Новый шаблон</h1>
      <TemplateForm />
    </div>
  );
}
