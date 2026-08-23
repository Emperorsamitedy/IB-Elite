"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { toast } from "sonner";
import { ImageUp, PencilRuler, LineChart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { GraphFigure } from "@/components/question/graph-figure";
import { GraphBuilder } from "@/components/admin/graph-builder";
import { DEFAULT_GRAPH_SPEC, type GraphSpec } from "@/lib/graph";
import {
  ASSET_CONTENT_TYPES,
  MAX_ASSET_BYTES,
  type QuestionAssetView,
} from "@/lib/questions/assets";
import type { CanvasData } from "@/lib/whiteboard/types";

const WhiteboardCanvas = dynamic(
  () => import("@/components/whiteboard/whiteboard-canvas"),
  { ssr: false, loading: () => <Spinner /> },
);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/**
 * The three ways an admin attaches a figure to a question: upload a
 * screenshot, draw a diagram, or plot a graph from a spec.
 */
export function QuestionFigures({ questionId }: { questionId: string }) {
  const [assets, setAssets] = React.useState<QuestionAssetView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [caption, setCaption] = React.useState("");
  const [altText, setAltText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [spec, setSpec] = React.useState<GraphSpec>(DEFAULT_GRAPH_SPEC);

  const load = React.useCallback(async () => {
    const res = await fetch(
      `/api/admin/questions/assets?questionId=${questionId}`,
    );
    if (res.ok) {
      const body: { assets: QuestionAssetView[] } = await res.json();
      setAssets(body.assets);
    }
    setLoading(false);
  }, [questionId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = React.useCallback(
    async (payload: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await fetch("/api/admin/questions/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId,
            caption: caption || null,
            altText: altText || null,
            sortOrder: assets.length,
            ...payload,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error ?? "Could not save that figure.");
          return false;
        }
        toast.success("Figure added");
        setCaption("");
        setAltText("");
        setFile(null);
        await load();
        return true;
      } finally {
        setSaving(false);
      }
    },
    [altText, assets.length, caption, load, questionId],
  );

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/questions/assets/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove that figure.");
      return;
    }
    setAssets((current) => current.filter((a) => a.id !== id));
  };

  const details = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label>Caption (optional)</Label>
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Figure 1 — forces on the block"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Alt text (optional)</Label>
        <Input
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="Described for screen readers"
        />
      </div>
    </div>
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <Label>Figures</Label>
          {loading && <Spinner />}
        </div>

        {assets.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{asset.kind}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove figure"
                    onClick={() => void remove(asset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {asset.kind === "graph" && asset.graph_spec ? (
                  <GraphFigure spec={asset.graph_spec} />
                ) : asset.url ? (
                  <Image
                    src={asset.url}
                    alt={asset.alt_text ?? asset.caption ?? "Question figure"}
                    width={480}
                    height={320}
                    unoptimized
                    className="h-auto w-full rounded-md border border-border"
                  />
                ) : null}
                {asset.caption && (
                  <p className="text-xs text-muted-foreground">
                    {asset.caption}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload">
              <ImageUp className="mr-1.5 h-3.5 w-3.5" /> Screenshot
            </TabsTrigger>
            <TabsTrigger value="diagram">
              <PencilRuler className="mr-1.5 h-3.5 w-3.5" /> Diagram
            </TabsTrigger>
            <TabsTrigger value="graph">
              <LineChart className="mr-1.5 h-3.5 w-3.5" /> Graph
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="flex flex-col gap-3">
            <FileDropzone
              id="question-asset-upload"
              file={file}
              onFile={setFile}
              accept={ASSET_CONTENT_TYPES}
              maxBytes={MAX_ASSET_BYTES}
              hint="PNG, JPG or WebP up to 2 MB"
            />
            {details}
            <Button
              className="self-start"
              disabled={!file || saving}
              onClick={async () => {
                if (!file) return;
                await create({ kind: "image", file: await readAsDataUrl(file) });
              }}
            >
              {saving ? <Spinner /> : "Attach screenshot"}
            </Button>
          </TabsContent>

          <TabsContent value="diagram" className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Draw the figure, then Save — the drawing is stored as an image and
              as editable canvas data.
            </p>
            {details}
            <WhiteboardCanvas
              autosave={false}
              height={360}
              onSave={async (canvasData: CanvasData, png: string) => {
                await create({ kind: "diagram", file: png, canvasData });
              }}
            />
          </TabsContent>

          <TabsContent value="graph" className="flex flex-col gap-3">
            <GraphBuilder spec={spec} onChange={setSpec} />
            {details}
            <Button
              className="self-start"
              disabled={saving}
              onClick={async () => {
                const ok = await create({ kind: "graph", graphSpec: spec });
                if (ok) setSpec(DEFAULT_GRAPH_SPEC);
              }}
            >
              {saving ? <Spinner /> : "Attach graph"}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
