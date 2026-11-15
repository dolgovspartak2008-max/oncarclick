-- Ручной порядок отзывов: новые из бота (position = null) идут первыми, затем по position.
alter table public.reviews add column if not exists position int;
