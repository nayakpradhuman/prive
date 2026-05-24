import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "../make-server-1f7adb85/kv_store.ts";

const BUCKET = "make-1f7adb85-rive";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = Date.now() - MAX_AGE_MS;

    // getByPrefix returns values only; session objects have an `id` field,
    // discussion arrays do not — use that to distinguish them.
    const allEntries = await kv.getByPrefix("session:");
    const expiredSessions = allEntries.filter(
      (v: any) => v?.id && typeof v.createdAt === "number" && v.createdAt < cutoff,
    );

    let deleted = 0;
    const errors: string[] = [];

    for (const session of expiredSessions) {
      try {
        // Delete all storage files under this session's folder.
        // The main .riv lives at {sessionId}/{fileName};
        // voice files live at {sessionId}/voice/{noteId}.webm.
        for (const prefix of [session.id, `${session.id}/voice`]) {
          const { data: files } = await supabase.storage.from(BUCKET).list(prefix);
          if (files?.length) {
            const paths = files.map((f: any) => `${prefix}/${f.name}`);
            await supabase.storage.from(BUCKET).remove(paths);
          }
        }

        // Delete KV entries
        await kv.del(`session:${session.id}`);
        await kv.del(`session:${session.id}:discussions`);
        deleted++;
      } catch (e) {
        errors.push(`${session.id}: ${String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ deleted, checked: expiredSessions.length, errors }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Cleanup error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
