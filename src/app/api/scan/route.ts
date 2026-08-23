import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recogniseText, ScanError } from "@/lib/ocr";

/** ~2.8M base64 characters ≈ 2 MB of image — the client compresses below this. */
const MAX_IMAGE_CHARS = 2_800_000;

const bodySchema = z.object({
  image: z.string().min(32).max(MAX_IMAGE_CHARS),
  source: z.enum(["photo", "board"]).default("photo"),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That image couldn't be read — try a smaller photo." },
      { status: 400 },
    );
  }

  try {
    const { text, provider } = await recogniseText(parsed.data.image);
    if (!text) {
      return NextResponse.json({
        text: "",
        provider,
        message:
          parsed.data.source === "board"
            ? "No writing was recognised on the board. Try writing a little larger."
            : "No text was recognised. Try a sharper, better-lit photo taken straight on.",
      });
    }
    return NextResponse.json({ text, provider });
  } catch (error) {
    if (error instanceof ScanError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Scanning failed. Please try again." },
      { status: 502 },
    );
  }
}
