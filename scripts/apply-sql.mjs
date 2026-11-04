// Apply every .sql file in the given folders (sorted by name) to Supabase via the Management API.
// Usage: node scripts/apply-sql.mjs supabase/migrations   (reads SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF from .env.local)
import fs from 'node:fs'; import path from 'node:path';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')), l.slice(l.indexOf('=')+1)]));
const url = `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`;
const dirs = process.argv.slice(2);
for (const d of dirs) for (const f of fs.readdirSync(d).filter(f=>f.endsWith('.sql')).sort()) {
  const sql = fs.readFileSync(path.join(d,f),'utf8');
  const r = await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});
  const t = await r.text();
  console.log(`${r.ok?'OK  ':'FAIL'} ${d}/${f} ${r.ok?'':t.slice(0,400)}`);
  if (!r.ok) process.exit(1);
}
