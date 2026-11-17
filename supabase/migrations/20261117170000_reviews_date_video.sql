-- Дата отзыва (её указывает администратор в боте) и видео отзыва из Telegram.
alter table public.reviews add column if not exists review_date date;
alter table public.reviews add column if not exists video_file_id text check (video_file_id is null or video_file_id ~ '^[A-Za-z0-9_-]{10,200}$');
alter table public.reviews add column if not exists video_thumb_file_id text check (video_thumb_file_id is null or video_thumb_file_id ~ '^[A-Za-z0-9_-]{10,200}$');

create or replace function public.bot_add_review(p_secret text, p_review jsonb)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint;
begin perform _check_secret(p_secret);
  insert into reviews(name, city, car, country, rating, body, photo_file_id, review_date, video_file_id, video_thumb_file_id)
  values (p_review->>'name', nullif(p_review->>'city',''), nullif(p_review->>'car',''), nullif(p_review->>'country',''),
          coalesce((p_review->>'rating')::int, 5), p_review->>'body', nullif(p_review->>'photo',''),
          nullif(p_review->>'date','')::date, nullif(p_review->>'video',''), nullif(p_review->>'videoThumb',''))
  returning id into v_id;
  return v_id; end $$;

-- Дата уже опубликованного отзыва (например, исправить «ноябрь 2026» у старых отзывов).
create or replace function public.bot_set_review_date(p_secret text, p_id bigint, p_date date)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin perform _check_secret(p_secret);
  update reviews set review_date = p_date where id = p_id; return found; end $$;

-- Видео к уже опубликованному отзыву (null — убрать видео).
create or replace function public.bot_set_review_video(p_secret text, p_id bigint, p_video text, p_thumb text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin perform _check_secret(p_secret);
  update reviews set video_file_id = nullif(p_video,''), video_thumb_file_id = nullif(p_thumb,'') where id = p_id; return found; end $$;

-- Отдаём из Telegram только файлы опубликованных отзывов: фото, превью видео.
create or replace function public.bot_photo_allowed(p_secret text, p_file text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin perform _check_secret(p_secret);
  return exists (select 1 from reviews where published and (photo_file_id = p_file or video_thumb_file_id = p_file)); end $$;

create or replace function public.bot_video_allowed(p_secret text, p_file text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin perform _check_secret(p_secret);
  return exists (select 1 from reviews where published and video_file_id = p_file); end $$;

revoke all on function public.bot_set_review_date(text, bigint, date) from public;
revoke all on function public.bot_set_review_video(text, bigint, text, text) from public;
revoke all on function public.bot_video_allowed(text, text) from public;
grant execute on function public.bot_set_review_date(text, bigint, date) to anon, service_role;
grant execute on function public.bot_set_review_video(text, bigint, text, text) to anon, service_role;
grant execute on function public.bot_video_allowed(text, text) to anon, service_role;
