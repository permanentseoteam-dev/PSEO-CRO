-- Each project gets a soft colour; task cards are tinted with it.
alter table public.projects add column if not exists color text
  check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

-- Give existing projects a colour from the palette, in creation order.
with palette(i, c) as (values (0,'#cfe3ff'),(1,'#ffd9e1'),(2,'#d4f0e7'),(3,'#e3d7ff'),(4,'#fff1c7'),(5,'#d8f3c9'),(6,'#ffe0cc'),(7,'#d6eef7')),
ranked as (select id, (row_number() over (order by created_at) - 1) % 8 as i from public.projects where color is null)
update public.projects p set color = palette.c from ranked join palette using (i) where p.id = ranked.id;
