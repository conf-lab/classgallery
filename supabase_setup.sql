-- 나만의 미술관: Supabase SQL Editor에서 전체를 한 번에 실행하세요.

-- ---------- Tables ----------
create table if not exists profiles (
  uid uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists galleries (
  uid uuid primary key references auth.users(id) on delete cascade,
  slots jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table galleries enable row level security;

-- 프로필: 누구나 읽기 가능(구경 목록용), 본인만 쓰기 가능
create policy "profiles are viewable by everyone"
  on profiles for select using (true);
create policy "users can insert their own profile"
  on profiles for insert with check (auth.uid() = uid);
create policy "users can update their own profile"
  on profiles for update using (auth.uid() = uid);

-- 갤러리: 누구나 읽기 가능(구경 기능용), 본인만 쓰기 가능
create policy "galleries are viewable by everyone"
  on galleries for select using (true);
create policy "users can insert their own gallery"
  on galleries for insert with check (auth.uid() = uid);
create policy "users can update their own gallery"
  on galleries for update using (auth.uid() = uid);

-- ---------- Storage policies ----------
-- 먼저 Storage 탭에서 'gallery-images' 버킷을 만드세요 (Public bucket 체크).
-- 파일 경로 규칙: {uid}/{slot번호}.jpg  ->  폴더명이 본인 uid와 같을 때만 쓰기 허용

create policy "gallery images are publicly readable"
  on storage.objects for select
  using ( bucket_id = 'gallery-images' );

create policy "users can upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'gallery-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update their own files"
  on storage.objects for update
  using (
    bucket_id = 'gallery-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own files"
  on storage.objects for delete
  using (
    bucket_id = 'gallery-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
