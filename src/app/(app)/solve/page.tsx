import { requireUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/subscription";
import { FREE_SOLVES_PER_DAY } from "@/lib/curriculumsolve/usage";
import { SolvePanel } from "./solve-panel";

export const metadata = { title: "Solve & Grade" };

export default async function SolvePage() {
  const user = await requireUser();
  const entitlement = await getEntitlement(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Solve &amp; Grade</h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          Photograph a problem · graded against the real IB syllabus
        </p>
      </div>
      <SolvePanel
        isPro={entitlement.isPro}
        freeLimit={FREE_SOLVES_PER_DAY}
      />
    </div>
  );
}
