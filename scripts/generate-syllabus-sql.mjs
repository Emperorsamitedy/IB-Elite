// Generates supabase/seed_syllabus.sql from supabase/syllabus.json.
// The database stays the single source of truth at runtime; this script only
// keeps the seeded syllabus tree reproducible.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const syllabus = JSON.parse(
  readFileSync(resolve(root, "supabase/syllabus.json"), "utf8"),
);

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const subjects = [];
const themes = [];
const topics = [];
const subtopics = [];

syllabus.subjects.forEach((s, si) => {
  subjects.push(`  (${q(s.slug)}, ${q(s.name)}, ${q(s.group)}, ${q(s.description)}, ${q(s.color)}, ${si + 1})`);
  s.themes.forEach((th, ti) => {
    themes.push(
      `  (${q(s.slug)}, ${q(th.slug)}, ${q(th.name)}, ${q(th.description ?? null)}, ${q(th.level ?? null)}, ${ti + 1})`,
    );
    th.topics.forEach((tp, pi) => {
      topics.push(
        `  (${q(s.slug)}, ${q(th.slug)}, ${q(tp.slug)}, ${q(tp.name)}, ${q(tp.description ?? null)}, ${q(tp.level ?? null)}, ${pi + 1})`,
      );
      (tp.subtopics ?? []).forEach((st, sti) => {
        const name = typeof st === "string" ? st : st.name;
        const slug = typeof st === "string" ? slugify(st) : st.slug;
        subtopics.push(`  (${q(s.slug)}, ${q(tp.slug)}, ${q(slug)}, ${q(name)}, ${sti + 1})`);
      });
    });
  });
});

const sql = `-- =============================================================
-- GENERATED FILE — do not edit by hand.
-- Source: supabase/syllabus.json  ·  Regenerate: npm run syllabus:sql
-- Subject → Theme → Topic → Subtopic tree for every supported subject.
-- =============================================================

insert into public.subjects (slug, name, group_name, description, color, sort_order) values
${subjects.join(",\n")}
on conflict (slug) do update set
  name = excluded.name, group_name = excluded.group_name,
  description = excluded.description, color = excluded.color,
  sort_order = excluded.sort_order;

insert into public.levels (subject_id, code, name, sort_order)
select s.id, l.code, l.name, l.sort_order
from public.subjects s
cross join (values ('SL', 'Standard Level', 1), ('HL', 'Higher Level', 2)) as l(code, name, sort_order)
on conflict (subject_id, code) do nothing;

insert into public.themes (subject_id, slug, name, description, level_code, sort_order)
select s.id, t.slug, t.name, t.description, t.level_code, t.sort_order
from public.subjects s
join (values
${themes.join(",\n")}
) as t(subject_slug, slug, name, description, level_code, sort_order) on t.subject_slug = s.slug
on conflict (subject_id, slug) do update set
  name = excluded.name, description = excluded.description,
  level_code = excluded.level_code, sort_order = excluded.sort_order;

insert into public.topics (subject_id, theme_id, slug, name, description, level_code, sort_order)
select s.id, th.id, t.slug, t.name, t.description, t.level_code, t.sort_order
from public.subjects s
join (values
${topics.join(",\n")}
) as t(subject_slug, theme_slug, slug, name, description, level_code, sort_order) on t.subject_slug = s.slug
join public.themes th on th.subject_id = s.id and th.slug = t.theme_slug
on conflict (subject_id, slug) do update set
  theme_id = excluded.theme_id, name = excluded.name,
  description = excluded.description, level_code = excluded.level_code,
  sort_order = excluded.sort_order;

insert into public.subtopics (topic_id, slug, name, sort_order)
select tp.id, st.slug, st.name, st.sort_order
from public.subjects s
join (values
${subtopics.join(",\n")}
) as st(subject_slug, topic_slug, slug, name, sort_order) on st.subject_slug = s.slug
join public.topics tp on tp.subject_id = s.id and tp.slug = st.topic_slug
on conflict (topic_id, slug) do update set
  name = excluded.name, sort_order = excluded.sort_order;
`;

writeFileSync(resolve(root, "supabase/seed_syllabus.sql"), sql);
console.log(
  `subjects=${subjects.length} themes=${themes.length} topics=${topics.length} subtopics=${subtopics.length}`,
);
