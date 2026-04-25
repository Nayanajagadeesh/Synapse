-- Optional demo data. Run AFTER you have at least one auth user.
-- Replace the email below with your own before running.
do $$
declare
  uid uuid;
  nb  uuid;
begin
  select id into uid from auth.users where email = 'you@example.com' limit 1;
  if uid is null then
    raise notice 'No user found — sign up first, then re-run seed.sql.';
    return;
  end if;

  insert into notebooks (id, owner_id, title, description, emoji)
  values (uuid_generate_v4(), uid, 'AI Research', 'Tracking new LLM techniques', '🧠')
  returning id into nb;

  insert into sources (notebook_id, kind, title, url, status, created_by)
  values (nb, 'url', 'Attention Is All You Need',
          'https://arxiv.org/abs/1706.03762', 'pending', uid);
end $$;
