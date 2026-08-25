"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, X, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import {
  updateProfile,
  updatePreferences,
  addExamDate,
  deleteExamDate,
  toggleUserSubject,
} from "@/lib/actions/profile";
import type { PlanIntensity } from "@/lib/types";

type SubjectOption = { id: string; name: string; group_name: string };
type ExamRow = { id: string; subjectName: string; date: string };

export function SettingsView({
  profile,
  preferences,
  subjects,
  userSubjectIds,
  exams,
}: {
  profile: {
    fullName: string;
    displayName: string;
    country: string;
    email: string;
  };
  preferences: {
    intensity: PlanIntensity;
    dailyTarget: number;
    reduceMotion: boolean;
  };
  subjects: SubjectOption[];
  userSubjectIds: string[];
  exams: ExamRow[];
}) {
  return (
    <Tabs defaultValue="profile">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="subjects">Subjects</TabsTrigger>
        <TabsTrigger value="exams">Exam dates</TabsTrigger>
        <TabsTrigger value="prefs">Preferences</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileTab profile={profile} />
      </TabsContent>
      <TabsContent value="subjects">
        <SubjectsTab subjects={subjects} initial={userSubjectIds} />
      </TabsContent>
      <TabsContent value="exams">
        <ExamsTab subjects={subjects} exams={exams} />
      </TabsContent>
      <TabsContent value="prefs">
        <PreferencesTab preferences={preferences} />
      </TabsContent>
    </Tabs>
  );
}

function ProfileTab({
  profile,
}: {
  profile: {
    fullName: string;
    displayName: string;
    country: string;
    email: string;
  };
}) {
  const [name, setName] = React.useState(profile.fullName);
  const [displayName, setDisplayName] = React.useState(profile.displayName);
  const [country, setCountry] = React.useState(profile.country);
  const [pending, start] = React.useTransition();
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="display_name">Display name</Label>
          <Input
            id="display_name"
            value={displayName}
            maxLength={40}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Shown on duels and leaderboards instead of your real name.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country (optional)</Label>
          <Input
            id="country"
            value={country}
            maxLength={2}
            placeholder="ET"
            className="w-24 uppercase"
            onChange={(e) => setCountry(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Two-letter code. Powers country percentiles on World Mock and
            regional teams in School Wars.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile.email} disabled />
        </div>
        <Button
          className="self-start"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await updateProfile({
                fullName: name,
                displayName,
                country,
              });
              if (res?.error) {
                toast.error(res.error);
                return;
              }
              toast.success("Profile updated");
            })
          }
        >
          {pending ? <Spinner /> : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SubjectsTab({
  subjects,
  initial,
}: {
  subjects: SubjectOption[];
  initial: string[];
}) {
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set(initial),
  );
  const [pending, start] = React.useTransition();

  const toggle = (id: string) => {
    const add = !selected.has(id);
    setSelected((prev) => {
      const next = new Set(prev);
      if (add) next.add(id);
      else next.delete(id);
      return next;
    });
    start(async () => {
      await toggleUserSubject(id, add);
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <p className="text-sm text-muted-foreground">
          Choose the subjects you&apos;re revising. These shape your dashboard
          and study plan.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {subjects.map((s) => {
            const isSel = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                disabled={pending}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                  isSel
                    ? "border-accent bg-accent-soft/60"
                    : "border-border hover:bg-surface-2",
                )}
              >
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.group_name}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    isSel
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border",
                  )}
                >
                  {isSel && <Check className="h-3 w-3" />}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ExamsTab({
  subjects,
  exams,
}: {
  subjects: SubjectOption[];
  exams: ExamRow[];
}) {
  const [rows, setRows] = React.useState(exams);
  const [subjectId, setSubjectId] = React.useState(subjects[0]?.id ?? "");
  const [date, setDate] = React.useState("");
  const [pending, start] = React.useTransition();

  const add = () =>
    start(async () => {
      if (!subjectId || !date) return;
      await addExamDate({ subjectId, date });
      const subjectName =
        subjects.find((s) => s.id === subjectId)?.name ?? "Exam";
      setRows((r) =>
        [...r, { id: crypto.randomUUID(), subjectName, date }].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );
      setDate("");
      toast.success("Exam date added");
    });

  const remove = (id: string) =>
    start(async () => {
      setRows((r) => r.filter((x) => x.id !== id));
      await deleteExamDate(id);
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="sm:w-44"
          />
          <Button variant="secondary" onClick={add} disabled={pending || !date}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {rows.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No exam dates yet.
            </p>
          )}
          {rows.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 text-sm"
            >
              <span className="font-medium">{e.subjectName}</span>
              <span className="flex items-center gap-3 text-muted-foreground">
                {new Date(e.date).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                <button
                  onClick={() => remove(e.id)}
                  className="hover:text-danger"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PreferencesTab({
  preferences,
}: {
  preferences: {
    intensity: PlanIntensity;
    dailyTarget: number;
    reduceMotion: boolean;
  };
}) {
  const [intensity, setIntensity] = React.useState(preferences.intensity);
  const [dailyTarget, setDailyTarget] = React.useState(preferences.dailyTarget);
  const [reduceMotion, setReduceMotion] = React.useState(
    preferences.reduceMotion,
  );
  const [pending, start] = React.useTransition();

  const save = (patch: Parameters<typeof updatePreferences>[0]) =>
    start(async () => {
      await updatePreferences(patch);
      toast.success("Preferences saved");
    });

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-6">
        <div>
          <Label>Revision intensity</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["light", "balanced", "intense"] as PlanIntensity[]).map((i) => (
              <button
                key={i}
                onClick={() => {
                  setIntensity(i);
                  save({ intensity: i });
                }}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors",
                  intensity === i
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border hover:bg-surface-2",
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target">Daily question target</Label>
          <Input
            id="target"
            type="number"
            min={5}
            max={100}
            value={dailyTarget}
            onChange={(e) => setDailyTarget(Number(e.target.value))}
            onBlur={() => save({ dailyTarget })}
            className="w-32"
          />
        </div>

        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Reduce motion</p>
            <p className="text-xs text-muted-foreground">
              Minimise animations across the app.
            </p>
          </div>
          <Switch
            checked={reduceMotion}
            onCheckedChange={(v) => {
              setReduceMotion(v);
              save({ reduceMotion: v });
            }}
            disabled={pending}
          />
        </label>
      </CardContent>
    </Card>
  );
}
