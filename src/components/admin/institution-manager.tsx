"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { createInstitution } from "@/lib/actions/scout";

export function InstitutionManager({
  institutions,
}: {
  institutions: {
    id: string;
    name: string;
    kind: string;
    approved: boolean;
    members: number;
    auditEntries: number;
  }[];
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<"scholarship" | "university" | "other">(
    "scholarship",
  );
  const [email, setEmail] = React.useState("");
  const [pending, start] = React.useTransition();

  const create = () =>
    start(async () => {
      const res = await createInstitution({ name, kind, memberEmail: email });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setName("");
      setEmail("");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Institutions</h1>
      <Card>
        <CardContent className="grid gap-3 p-5 sm:grid-cols-4">
          <Input
            placeholder="Institution name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="scholarship">Scholarship program</option>
            <option value="university">University</option>
            <option value="other">Other</option>
          </select>
          <Input
            placeholder="First scout's account email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={create} disabled={pending || !name || !email}>
            {pending ? <Spinner /> : <Plus className="mr-2 size-4" />}
            Create
          </Button>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-2">
        {institutions.map((i) => (
          <Card key={i.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{i.name}</p>
                <p className="text-xs text-muted-foreground">
                  {i.kind} · {i.members} scouts · {i.auditEntries} audit entries
                </p>
              </div>
              <Badge variant={i.approved ? "success" : "outline"}>
                {i.approved ? "approved" : "pending"}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
