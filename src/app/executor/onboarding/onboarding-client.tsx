"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STEPS = 9;

const intro = [
  {
    title: "Добро пожаловать в V|D",
    body: "Вы в команде исполнителей студии. Этот короткий тур поможет разобраться, как устроена работа и что нужно заполнить в профиле.",
  },
  {
    title: "Правила платформы",
    body: "Соблюдайте сроки, отвечайте в согласованных каналах связи, храните материалы заказов конфиденциальными. Нарушение правил может привести к блокировке.",
  },
  {
    title: "Как устроены заказы",
    body: "Заказ проходит этапы: от назначения до сдачи на проверку и завершения. Этапы и файлы видны в карточке заказа. Статус «На проверке» означает, что работа передана администратору.",
  },
  {
    title: "Рейтинговая система",
    body: "Рейтинг учитывает просрочки, скорость завершения и прибыль по вашим заказам. Чем стабильнее результат, тем выше доверие при автоназначении.",
  },
  {
    title: "Риски и ответственность",
    body: "За просрочки и долгое отсутствие ответа по заказу начисляются риски. Следите за дедлайнами этапов и держите связь с администратором.",
  },
];

type Props = { skillOptions: string[] };

export function OnboardingClient({ skillOptions }: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [primarySkill, setPrimarySkill] = useState("");
  const [customTag, setCustomTag] = useState("");

  const options = skillOptions.length ? skillOptions : ["layout", "react", "figma", "design"];

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users/me");
    setLoading(false);
    if (!res.ok) return;
    const u = (await res.json()) as {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      telegram?: string | null;
      skills?: string[];
      primarySkill?: string;
    };
    if (u.firstName) setFirstName(u.firstName);
    if (u.lastName) setLastName(u.lastName);
    if (u.phone) setPhone(u.phone);
    if (u.telegram) setTelegram(u.telegram);
    if (u.skills?.length) setSkills(u.skills);
    if (u.primarySkill) setPrimarySkill(u.primarySkill);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = ((step + 1) / STEPS) * 100;

  function toggleSkill(s: string) {
    setSkills((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
        if (primarySkill === s) setPrimarySkill("");
      } else {
        next.add(s);
      }
      return [...next];
    });
  }

  function addCustomSkill() {
    const t = customTag.trim();
    if (!t || skills.includes(t)) return;
    setSkills((prev) => [...prev, t]);
    setCustomTag("");
  }

  function canGoNext(): boolean {
    if (step === 5) return Boolean(firstName.trim() && lastName.trim());
    if (step === 6) return Boolean(phone.trim() || telegram.trim());
    if (step === 7) {
      return skills.length >= 1 && Boolean(primarySkill) && skills.includes(primarySkill);
    }
    return true;
  }

  function next() {
    setError(null);
    if (!canGoNext()) {
      setError("Заполните обязательные поля на этом шаге");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function finish() {
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        telegram: telegram.trim() || null,
        skills,
        primarySkill: primarySkill.trim(),
        onboarded: true,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Не удалось сохранить");
      return;
    }
    await update({ onboarded: true });
    router.push("/executor");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Шаг {step + 1} из {STEPS}
        </p>
      </div>

      <Card className="p-6">
        {step < 5 && (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold text-zinc-900">{intro[step].title}</h1>
            <p className="text-sm leading-relaxed text-zinc-600">{intro[step].body}</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-zinc-900">Личные данные</h1>
            <p className="text-sm text-zinc-600">Как к вам обращаться в системе и документах.</p>
            <div>
              <label className="text-xs font-medium text-zinc-600">Имя</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600">Фамилия</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-zinc-900">Контакты</h1>
            <p className="text-sm text-zinc-600">
              Укажите телефон и/или Telegram — с вами смогут связаться вне системы.
            </p>
            <div>
              <label className="text-xs font-medium text-zinc-600">Телефон</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 …"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600">Telegram</label>
              <input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-zinc-900">Навыки</h1>
            <p className="text-sm text-zinc-600">
              Выберите теги, с которыми вы работаете. Основной навык используется при приоритете
              подбора.
            </p>
            <div className="flex flex-wrap gap-2">
              {options.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSkill(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    skills.includes(s)
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-300 bg-white text-zinc-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSkill())}
                placeholder="Свой тег и Enter"
                className="min-w-[160px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <Button type="button" variant="secondary" size="sm" onClick={addCustomSkill}>
                Добавить
              </Button>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600">Основной навык</label>
              <select
                value={primarySkill}
                onChange={(e) => setPrimarySkill(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">— выберите из выбранных —</option>
                {skills.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-zinc-900">Готово</h1>
            <p className="text-sm text-zinc-600">Проверьте данные перед завершением.</p>
            <dl className="space-y-2 rounded-xl bg-zinc-50 p-4 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">ФИО</dt>
                <dd className="font-medium">
                  {firstName} {lastName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Телефон</dt>
                <dd>{phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Telegram</dt>
                <dd>{telegram || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Навыки</dt>
                <dd>{skills.join(", ") || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Основной навык</dt>
                <dd className="font-semibold text-blue-800">{primarySkill || "—"}</dd>
              </div>
            </dl>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <Button type="button" variant="secondary" size="md" disabled={step === 0} onClick={back}>
            Назад
          </Button>
          {step < STEPS - 1 ? (
            <Button type="button" variant="primary" size="md" onClick={next}>
              Далее
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={submitting || !canGoNext()}
              onClick={() => void finish()}
            >
              {submitting ? "…" : "Завершить"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
