// Uploads a tiny placeholder to every Storage path the seed SQL points at, so seeded files and chat
// attachments download instead of 404ing. Existing objects are left alone (no overwrite).
//
//   node --env-file=.env.local scripts/upload-seed-placeholders.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. Their values are never printed.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SEED = join(import.meta.dirname, "..", "supabase", "seed");
const read = (f) => readFileSync(join(SEED, f), "utf8");
const pad = (n) => String(n).padStart(12, "0");

/** [bucket, path] pairs. */
const targets = [];

// Literal paths: chat attachments (0105_chat -> chat-files) and file versions (-> client-files).
const LITERAL = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/seed-[^'",]+/g;
for (const f of readdirSync(SEED).filter((x) => x.endsWith(".sql")).sort()) {
  const bucket = /chat/.test(f) ? "chat-files" : "client-files";
  for (const p of read(f).match(LITERAL) ?? []) targets.push([bucket, p]);
}

// 0109_clientops builds its file_version paths in SQL from the `f` rows:
//   c0000000-0000-4000-8000-<client>/seed-<n>-v<version>-<name with spaces as ->
const ROW = /^\s*\((\d+),\s*(\d+),\s*'(?:[^']|'')*',\s*'((?:[^']|'')*)',\s*(?:true|false),\s*(\d+),/gm;
for (const [, n, c, name, vers] of read("0109_clientops.sql").matchAll(ROW)) {
  for (let v = 1; v <= Number(vers); v++) {
    targets.push(["client-files", `c0000000-0000-4000-8000-${pad(c)}/seed-${n}-v${v}-${name.replaceAll("''", "'").replaceAll(" ", "-")}`]);
  }
}

const unique = [...new Map(targets.map((t) => [t.join(":"), t])).values()];

// 1x1 transparent PNG for images; a short text body for everything else.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const TEXT = Buffer.from("Placeholder for a seeded sample file. Upload the real file to replace it.\n");
const isImage = (p) => /\.(png|jpe?g|gif|webp)$/i.test(p);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Run with: node --env-file=.env.local scripts/upload-seed-placeholders.mjs");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let made = 0, kept = 0, failed = 0;
for (const [bucket, path] of unique) {
  const img = isImage(path);
  const { error } = await db.storage.from(bucket).upload(path, img ? PNG : TEXT, {
    contentType: img ? "image/png" : "text/plain",
    upsert: false,
  });
  if (!error) {
    made++;
    console.log(`uploaded ${bucket}/${path}`);
  } else if (/exists|duplicate/i.test(error.message)) {
    kept++;
  } else {
    failed++;
    console.error(`failed   ${bucket}/${path}: ${error.message}`);
  }
}
console.log(`${unique.length} paths: ${made} uploaded, ${kept} already there, ${failed} failed.`);
process.exit(failed ? 1 : 0);
