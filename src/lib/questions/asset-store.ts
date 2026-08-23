import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type { GraphSpec } from "@/lib/graph";
import {
  decodeDataUrl,
  QUESTION_ASSETS_BUCKET,
  type AssetInput,
  type CanvasData,
  type QuestionAsset,
  type QuestionAssetView,
} from "./assets";

type AdminClient = ReturnType<typeof createAdminClient>;

const COLUMNS =
  "id, question_id, kind, storage_path, caption, alt_text, canvas_data, graph_spec, sort_order";

const SIGNED_URL_SECONDS = 60 * 10;

function asAsset(row: unknown): QuestionAsset {
  return row as QuestionAsset;
}

export async function listQuestionAssets(
  questionId: string,
  client: AdminClient = createAdminClient(),
): Promise<QuestionAsset[]> {
  const { data } = await client
    .from("question_assets")
    .select(COLUMNS)
    .eq("question_id", questionId)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(asAsset);
}

/** Sign every stored file so a private-bucket asset can be rendered. */
export async function toAssetViews(
  assets: QuestionAsset[],
  client: AdminClient = createAdminClient(),
): Promise<QuestionAssetView[]> {
  return Promise.all(
    assets.map(async ({ storage_path, ...asset }) => {
      if (!storage_path) return { ...asset, url: null };
      const { data } = await client.storage
        .from(QUESTION_ASSETS_BUCKET)
        .createSignedUrl(storage_path, SIGNED_URL_SECONDS);
      return { ...asset, url: data?.signedUrl ?? null };
    }),
  );
}

export async function questionAssetViews(
  questionId: string,
  client: AdminClient = createAdminClient(),
): Promise<QuestionAssetView[]> {
  return toAssetViews(await listQuestionAssets(questionId, client), client);
}

export async function createQuestionAsset(
  input: AssetInput,
  client: AdminClient = createAdminClient(),
): Promise<QuestionAsset> {
  let storagePath: string | null = null;

  if (input.file) {
    const decoded = decodeDataUrl(input.file);
    if (!decoded) throw new Error("File must be a base64 data URL.");
    storagePath = `${input.questionId}/${crypto.randomUUID()}.${
      decoded.contentType.split("/")[1] ?? "png"
    }`;
    const { error } = await client.storage
      .from(QUESTION_ASSETS_BUCKET)
      .upload(storagePath, decoded.bytes, {
        contentType: decoded.contentType,
        upsert: false,
      });
    if (error) throw new Error(error.message);
  }

  const { data, error } = await client
    .from("question_assets")
    .insert({
      question_id: input.questionId,
      kind: input.kind,
      storage_path: storagePath,
      caption: input.caption ?? null,
      alt_text: input.altText ?? null,
      canvas_data: (input.canvasData ?? null) as CanvasData as unknown as Json,
      graph_spec: (input.graphSpec ?? null) as GraphSpec as unknown as Json,
      sort_order: input.sortOrder,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return asAsset(data);
}

export async function deleteQuestionAsset(
  id: string,
  client: AdminClient = createAdminClient(),
): Promise<boolean> {
  const { data } = await client
    .from("question_assets")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) return false;

  if (data.storage_path) {
    await client.storage
      .from(QUESTION_ASSETS_BUCKET)
      .remove([data.storage_path]);
  }
  const { error } = await client.from("question_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}
