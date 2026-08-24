"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/misc";
import {
  submitCalibrationReport,
  updateSignalProfile,
} from "@/lib/actions/signal";
import { messages } from "@/lib/i18n/en";

const t = messages.signal;

export function SignalProfileControls({
  userId,
  initial,
}: {
  userId: string;
  initial: {
    public: boolean;
    showCountry: boolean;
    showTrajectory: boolean;
    showHistory: boolean;
  };
}) {
  const [state, setState] = React.useState(initial);
  const [pending, start] = React.useTransition();

  const save = (patch: Partial<typeof state>) => {
    const next = { ...state, ...patch };
    setState(next);
    start(async () => {
      const res = await updateSignalProfile({
        public: next.public,
        showCountry: next.showCountry,
        showTrajectory: next.showTrajectory,
        showHistory: next.showHistory,
        subjectIds: [],
      });
      if (res.error) toast.error(res.error);
    });
  };

  const copy = async () => {
    await navigator.clipboard
      .writeText(`${window.location.origin}/signal/p/${userId}`)
      .catch(() => {});
    toast.success(t.linkCopied);
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{t.publicProfile}</h2>
            <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">
              {t.publicHint}
            </p>
          </div>
          <Switch
            checked={state.public}
            onCheckedChange={(v) => save({ public: v })}
            disabled={pending}
          />
        </div>
        {state.public && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <ToggleRow
                label={t.showCountry}
                checked={state.showCountry}
                onChange={(v) => save({ showCountry: v })}
              />
              <ToggleRow
                label={t.showTrajectory}
                checked={state.showTrajectory}
                onChange={(v) => save({ showTrajectory: v })}
              />
              <ToggleRow
                label={t.showHistory}
                checked={state.showHistory}
                onChange={(v) => save({ showHistory: v })}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                <Copy className="mr-2 size-4" /> {t.copyLink}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/signal/p/${userId}`} target="_blank">
                  <ExternalLink className="mr-2 size-4" /> {t.viewPublic}
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function CalibrationForm({
  subjects,
}: {
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? "");
  const [grade, setGrade] = React.useState(6);
  const [session, setSession] = React.useState("");
  const [pending, start] = React.useTransition();

  const submit = () =>
    start(async () => {
      const res = await submitCalibrationReport({
        subjectId,
        officialGrade: grade,
        examSession: session,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t.reported);
      setSession("");
      router.refresh();
    });

  if (subjects.length === 0) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-6">
        <div>
          <h2 className="text-sm font-semibold">{t.calibrationTitle}</h2>
          <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">
            {t.calibrationHint}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Subject</Label>
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t.officialGrade}</Label>
            <Input
              type="number"
              min={1}
              max={7}
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value) || 1)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t.examSession}</Label>
            <Input
              value={session}
              maxLength={20}
              placeholder="M26"
              onChange={(e) => setSession(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="self-start"
          size="sm"
          onClick={submit}
          disabled={pending || session.trim().length < 3}
        >
          {pending ? <Spinner /> : t.report}
        </Button>
      </CardContent>
    </Card>
  );
}
