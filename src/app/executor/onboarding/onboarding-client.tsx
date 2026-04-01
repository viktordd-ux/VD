"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { PageLoadingSkeleton } from "@/components/page-loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SKILL_CATEGORIES, DEFAULT_SKILLS } from "@/lib/skill-tags";

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
  const [telegramId, setTelegramId] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [primarySkill, setPrimarySkill] = useState("");
  const [customTag, setCustomTag] = useState("");

  const predefinedSet = new Set(DEFAULT_SKILLS);
  const extraSkills = skillOptions.filter((s) => !predefinedSet.has(s));
  const displayCategories = [
    ...SKILL_CATEGORIES,
    ...(extraSkills.length ? [{ label: "Другое", skills: extraSkills }] : []),
  ];

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
      telegramId?: string | null;
      skills?: string[];
      primarySkill?: string;
    };
    if (u.firstName) setFirstName(u.firstName);
    if (u.lastName) setLastName(u.lastName);
    if (u.phone) setPhone(u.phone);
    if (u.telegram) setTelegram(u.telegram);
    if (u.telegramId) setTelegramId(u.telegramId);
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
        telegramId: telegramId.trim() || null,
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
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <PageLoadingSkeleton compact />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-1 sm:px-0">
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

      <Card className="p-4 sm:p-6">
        {step < 5 && (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold leading-snug text-zinc-900">{intro[step].title}</h1>
            <p className="text-base leading-relaxed text-zinc-600">{intro[step].body}</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h1 className="text-xl font-semibold text-zinc-900">Личные данные</h1>
            <p className="text-sm text-zinc-600">Как к вам обращаться в системе и документах.</p>
            <div>
              <label className="text-sm font-medium text-zinc-700">Имя</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2.5 text-base md:min-h-0 md:py-2 md:text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Фамилия</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2.5 text-base md:min-h-0 md:py-2 md:text-sm"
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
              <label className="text-sm font-medium text-zinc-700">Телефон</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 …"
                inputMode="tel"
                autoComplete="tel"
                className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2.5 text-base md:min-h-0 md:py-2 md:text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Telegram</label>
              <input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2.5 text-base md:min-h-0 md:py-2 md:text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">
                Telegram ID для уведомлений (необязательно)
              </label>
              <input
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="Число из @userinfobot"
                inputMode="numeric"
                className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2.5 font-mono text-base md:min-h-0 md:py-2 md:text-sm"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Чтобы бот мог писать вам в личку. Откройте @userinfobot в Telegram и вставьте сюда ваш
                id.
              </p>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">Навыки</h1>
              <p className="mt-1 text-sm text-zinc-600">
                Выберите теги, с которыми вы работаете. Основной навык используется при приоритете
                подбора.
              </p>
            </div>

            <div className="space-y-4">
              {displayCategories.map((cat) => (
                <div key={cat.label}>
                  <p className="mb-2 text-xs font-semibold text-zinc-500">{cat.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {cat.skills.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSkill(s)}
                        className={`min-h-10 rounded-full px-3 py-2 text-xs font-medium transition-colors md:min-h-0 md:py-1 ${
                          skills.includes(s)
                            ? "bg-zinc-900 text-white"
                            : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-zinc-500">Свой навык</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSkill())}
                  placeholder="Введите и нажмите Enter"
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-base md:min-h-0 md:py-2 md:text-sm"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={addCustomSkill}
                >
                  Добавить
                </Button>
              </div>
            </div>

            {skills.length > 0 && (
              <div>
                <label className="text-sm font-medium text-zinc-700">Основной навык</label>
                <select
                  value={primarySkill}
                  onChange={(e) => setPrimarySkill(e.target.value)}
                  className="mt-1 w-full min-h-11 rounded-lg border border-zinc-300 px-3 py-2.5 text-base md:min-h-0 md:py-2 md:text-sm"
                >
                  <option value="">— выберите из выбранных —</option>
                  {skills.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                <dt className="text-xs text-zinc-500">Telegram ID (бот)</dt>
                <dd className="font-mono">{telegramId || "—"}</dd>
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

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="order-2 w-full sm:order-1 sm:w-auto"
            disabled={step === 0}
            onClick={back}
          >
            Назад
          </Button>
          {step < STEPS - 1 ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="order-1 w-full sm:order-2 sm:w-auto"
              onClick={next}
            >
              Далее
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="order-1 w-full sm:order-2 sm:w-auto"
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
