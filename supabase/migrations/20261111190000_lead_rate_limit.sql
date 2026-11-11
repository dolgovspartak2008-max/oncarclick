-- Ограничение частоты заявок с сайта.
-- Только add column / create index / create or replace function: существующие данные не меняются.

-- created_at уже есть (default now()), строка оставлена на случай чистой базы
alter table public.leads add column if not exists created_at timestamptz not null default now();
alter table public.leads add column if not exists ip_hash text;

create index if not exists leads_ip_hash_created_at_idx on public.leads (ip_hash, created_at);
create index if not exists leads_created_at_idx on public.leads (created_at);

-- Сигнатура и тип результата прежние (bigint), поэтому права EXECUTE (anon, service_role) сохраняются.
-- Результат:
--   id > 0  — заявка сохранена, её нужно отправить в Telegram;
--   -id     — заявка сохранена, но с этого телефона уже была заявка за 10 минут: в Telegram не отправлять.
-- Если с ip_hash за 10 минут уже 3 заявки или за сутки уже 10 — исключение с errcode 'P0429'.
create or replace function public.site_add_lead(p_secret text, p_lead jsonb)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id bigint;
  v_ip text := p_lead->>'ip_hash';
  v_phone text := right(regexp_replace(coalesce(p_lead->>'phone', ''), '\D', '', 'g'), 10);
  v_duplicate boolean := false;
begin
  perform _check_secret(p_secret);

  -- принимаем только hex SHA-256, всё остальное считаем «IP неизвестен»
  if v_ip is null or v_ip !~ '^[0-9a-f]{64}$' then v_ip := null; end if;

  if v_ip is not null then
    -- параллельные заявки с одного IP проверяются по очереди
    perform pg_advisory_xact_lock(hashtext('site_add_lead:' || v_ip));
    if (select count(*) from leads where ip_hash = v_ip and created_at > now() - interval '10 minutes') >= 3
       or (select count(*) from leads where ip_hash = v_ip and created_at > now() - interval '1 day') >= 10 then
      raise exception 'too_many_leads' using errcode = 'P0429';
    end if;
  end if;

  -- тот же телефон (последние 10 цифр, чтобы +7 и 8 совпадали) за последние 10 минут
  if length(v_phone) = 10 then
    v_duplicate := exists (
      select 1 from leads
      where created_at > now() - interval '10 minutes'
        and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_phone
    );
  end if;

  insert into leads(name, phone, comment, page, ip_hash)
  values (left(p_lead->>'name', 120), left(p_lead->>'phone', 40), left(p_lead->>'comment', 2000), left(p_lead->>'page', 300), v_ip)
  returning id into v_id;

  return case when v_duplicate then -v_id else v_id end;
end $function$;
