import { getSkillTagOptions } from "@/lib/skill-tags";
import { OnboardingClient } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function ExecutorOnboardingPage() {
  const skillOptions = await getSkillTagOptions();
  return (
    <div className="py-8">
      <OnboardingClient skillOptions={skillOptions} />
    </div>
  );
}
