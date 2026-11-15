-- Фото отзыва может лежать на самом сайте (public/assets/img/reviews), а не только в Telegram.
alter table public.reviews add column if not exists photo_url text
  check (photo_url is null or photo_url ~ '^/assets/img/reviews/[a-z0-9-]+\.(webp|jpg)$');
