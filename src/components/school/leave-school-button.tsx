"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { leaveSchool } from "@/lib/actions/school";
import { messages } from "@/lib/i18n/en";

export function LeaveSchoolButton() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await leaveSchool();
          router.refresh();
        })
      }
    >
      {messages.school.leave}
    </Button>
  );
}
