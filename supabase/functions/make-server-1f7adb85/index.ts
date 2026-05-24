import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.ts";

const app = new Hono();

app.use('*', logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600,
}));

const BUCKET = "make-1f7adb85-rive";

const adminClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function ensureBucket() {
  const supabase = adminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET);
  }
}

function genId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

// Health
app.get("/make-server-1f7adb85/health", (c) => c.json({ status: "ok" }));

// POST /sessions — upload .riv and create a collaboration session
app.post("/make-server-1f7adb85/sessions", async (c) => {
  try {
    await ensureBucket();
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file provided" }, 400);

    const sessionId = genId();
    const storageKey = `${sessionId}/${file.name}`;
    const buf = await file.arrayBuffer();

    const supabase = adminClient();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, buf, { contentType: "application/octet-stream" });

    if (uploadError) {
      console.log("Storage upload error:", uploadError);
      return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
    }

    const session = {
      id: sessionId,
      fileName: file.name,
      fileSize: file.size,
      storageKey,
      createdAt: Date.now(),
    };
    await kv.set(`session:${sessionId}`, session);
    await kv.set(`session:${sessionId}:discussions`, []);

    return c.json({ sessionId });
  } catch (e) {
    console.log("Create session error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// GET /sessions/:id — fetch session metadata + signed file URL + discussions
app.get("/make-server-1f7adb85/sessions/:id", async (c) => {
  try {
    const sessionId = c.req.param("id");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const supabase = adminClient();
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(session.storageKey, 7200); // 2 hour validity

    if (signedError) {
      console.log("Signed URL error:", signedError);
      return c.json({ error: `Signed URL failed: ${signedError.message}` }, 500);
    }

    const discussions = (await kv.get(`session:${sessionId}:discussions`)) ?? [];
    return c.json({ session, fileUrl: signedData.signedUrl, discussions });
  } catch (e) {
    console.log("Get session error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// POST /sessions/:id/voice — upload an audio blob and return a signed URL
app.post("/make-server-1f7adb85/sessions/:id/voice", async (c) => {
  try {
    const sessionId = c.req.param("id");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Session not found" }, 404);

    await ensureBucket();
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const noteId = (formData.get("noteId") as string | null) ?? genId();
    if (!file) return c.json({ error: "No file provided" }, 400);

    const storageKey = `${sessionId}/voice/${noteId}.webm`;
    const buf = await file.arrayBuffer();
    const supabase = adminClient();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, buf, { contentType: "audio/webm", upsert: true });

    if (uploadError) {
      console.log("Voice upload error:", uploadError);
      return c.json({ error: `Upload failed: ${uploadError.message}` }, 500);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storageKey, 604800); // 7 days

    if (signedError) {
      return c.json({ error: `Signed URL failed: ${signedError.message}` }, 500);
    }

    return c.json({ url: signedData.signedUrl });
  } catch (e) {
    console.log("Voice upload error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// PUT /sessions/:id/discussions — persist latest discussions
app.put("/make-server-1f7adb85/sessions/:id/discussions", async (c) => {
  try {
    const sessionId = c.req.param("id");
    const session = await kv.get(`session:${sessionId}`);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const body = await c.req.json();
    await kv.set(`session:${sessionId}:discussions`, body.discussions ?? []);
    return c.json({ ok: true });
  } catch (e) {
    console.log("Update discussions error:", e);
    return c.json({ error: String(e) }, 500);
  }
});

Deno.serve(app.fetch);
