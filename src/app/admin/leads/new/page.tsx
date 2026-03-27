import Link from "next/link";
import { NewLeadForm } from "./ui";

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/leads" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Назад
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Новый лид</h1>
      <NewLeadForm />
    </div>
  );
}
