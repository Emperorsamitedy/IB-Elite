import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFlag } from "@/lib/flags";
import { MockError } from "@/lib/mock/service";

export async function requireMockUser() {
  if (!(await getFlag("world_mock"))) {
    return {
      error: NextResponse.json({ error: "Not available" }, { status: 404 }),
    } as const;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    } as const;
  }
  return { user } as const;
}

export function mockErrorResponse(error: unknown) {
  if (error instanceof MockError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Something went wrong";
  return NextResponse.json({ error: message }, { status: 500 });
}
