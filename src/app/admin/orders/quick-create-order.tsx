"use client";

import { useState } from "react";
import { QuickCreateOrderModal } from "@/components/quick-create-order-modal";
import { useQuickCreate } from "@/context/quick-create-context";

type TemplateOpt = { id: string; title: string };

/**
 * Кнопка быстрого создания. В админке с {@link AdminWorkspaceProvider} открывает общий модал (клавиша C).
 * Без провайдера — локальный модал (шаблоны подгружаются из API).
 */
export function QuickCreateOrderButton({
  templates: _templates,
  label = "Быстро создать заказ",
  onCreated,
}: {
  templates?: TemplateOpt[];
  label?: string;
  onCreated?: () => void;
}) {
  const ctx = useQuickCreate();
  const [localOpen, setLocalOpen] = useState(false);

  if (ctx) {
    return (
      <button
        type="button"
        onClick={ctx.open}
        className="min-h-11 w-full cursor-pointer rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-zinc-800 active:scale-[0.98] sm:w-auto sm:py-2"
      >
        {label}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setLocalOpen(true)}
        className="min-h-11 w-full cursor-pointer rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 ease-out hover:scale-[1.01] hover:bg-zinc-800 active:scale-[0.98] sm:w-auto sm:py-2"
      >
        {label}
      </button>
      <QuickCreateOrderModal
        open={localOpen}
        onClose={() => setLocalOpen(false)}
        onCreated={onCreated}
      />
    </>
  );
}
