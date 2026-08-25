-- =============================================================
-- Multi-account defense: salted IP hashes on the duel queue and
-- challenge links, so ranked play never pairs two accounts on the
-- same network. Raw IPs are never stored — minors' data.
-- =============================================================

alter table public.duel_queue
  add column if not exists ip_hash text;

alter table public.duel_challenges
  add column if not exists creator_ip_hash text;
