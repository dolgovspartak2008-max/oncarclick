-- Бот-фильтр заявок («второй бот»): заявка с сайта сначала приходит владельцу бота-фильтра,
-- и только по кнопке «Переслать» уходит администраторам основного бота.
-- Только create table / add column / create function: существующие данные не меняются.

create table if not exists public.gate_owners (
  chat_id bigint primary key,
  name text,
  created_at timestamptz not null default now()
);
alter table public.gate_owners enable row level security; -- доступ только через функции ниже

-- Решение по заявке: null — ждёт решения, forwarded — переслана, rejected — не пересылать
alter table public.leads add column if not exists gate_status text;
alter table public.leads add column if not exists gate_decided_at timestamptz;

create or replace function public.gate_owner_ids(p_secret text)
 returns setof bigint language plpgsql security definer set search_path to 'public'
as $$ begin perform _check_secret(p_secret); return query select chat_id from gate_owners; end $$;

create or replace function public.gate_is_owner(p_secret text, p_chat bigint)
 returns boolean language plpgsql security definer set search_path to 'public'
as $$ begin perform _check_secret(p_secret); return exists (select 1 from gate_owners where chat_id = p_chat); end $$;

-- Стать владельцем. p_by_code = true — пользователь прислал верный код (проверяется на сервере сайта).
-- Без кода — только если владельцев ещё нет и пользователь уже администратор основного бота.
create or replace function public.gate_claim(p_secret text, p_chat bigint, p_name text, p_by_code boolean)
 returns boolean language plpgsql security definer set search_path to 'public'
as $$
begin
  perform _check_secret(p_secret);
  if p_chat is null or p_chat <= 0 then raise exception 'bad id'; end if;
  perform pg_advisory_xact_lock(hashtext('gate_claim'));
  if not coalesce(p_by_code, false) then
    if exists (select 1 from gate_owners) or not exists (select 1 from admins where chat_id = p_chat) then
      return false;
    end if;
  end if;
  insert into gate_owners(chat_id, name) values (p_chat, left(nullif(p_name, ''), 80)) on conflict (chat_id) do nothing;
  return exists (select 1 from gate_owners where chat_id = p_chat);
end $$;

create or replace function public.gate_get_lead(p_secret text, p_id bigint)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $$
begin
  perform _check_secret(p_secret);
  return (select jsonb_build_object('id', id, 'name', name, 'phone', phone, 'comment', comment, 'page', page, 'gate_status', gate_status)
          from leads where id = p_id);
end $$;

-- Атомарно записывает решение. Переслать можно заявку, которая ждёт или была отклонена;
-- уже пересланную — нельзя (защита от двойного нажатия). Возвращает true, если решение записано.
create or replace function public.gate_decide(p_secret text, p_id bigint, p_status text)
 returns boolean language plpgsql security definer set search_path to 'public'
as $$
begin
  perform _check_secret(p_secret);
  if p_status not in ('forwarded', 'rejected') then raise exception 'bad status'; end if;
  update leads set gate_status = p_status, gate_decided_at = now()
   where id = p_id
     and (gate_status is null or (p_status = 'forwarded' and gate_status = 'rejected'));
  return found;
end $$;

-- Если пересылка в основной бот не удалась — возвращаем заявку в «ждёт решения»
create or replace function public.gate_undo(p_secret text, p_id bigint)
 returns void language plpgsql security definer set search_path to 'public'
as $$ begin perform _check_secret(p_secret); update leads set gate_status = null, gate_decided_at = null where id = p_id and gate_status = 'forwarded'; end $$;

revoke all on function public.gate_owner_ids(text), public.gate_is_owner(text, bigint),
  public.gate_claim(text, bigint, text, boolean), public.gate_get_lead(text, bigint),
  public.gate_decide(text, bigint, text), public.gate_undo(text, bigint) from public;
grant execute on function public.gate_owner_ids(text), public.gate_is_owner(text, bigint),
  public.gate_claim(text, bigint, text, boolean), public.gate_get_lead(text, bigint),
  public.gate_decide(text, bigint, text), public.gate_undo(text, bigint) to anon, service_role;
