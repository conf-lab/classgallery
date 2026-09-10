-- 학생 업로드(반 코드) 기능용 추가 설정
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 한 번 실행하세요.
-- (기존 supabase_setup.sql 을 이미 실행한 프로젝트에 이어서 실행하는 스크립트입니다.)

-- ---------- 반 코드 테이블 ----------
-- 교사 계정(uid) 하나당 코드 하나. 코드로 학생이 어느 갤러리에 올릴지 찾습니다.
create table if not exists class_codes (
  uid        uuid primary key references auth.users(id) on delete cascade,
  code       text not null unique,
  is_open    boolean not null default true,
  created_at timestamptz default now()
);

alter table class_codes enable row level security;

-- 교사 본인만 자기 코드 행을 읽고 씁니다.
-- 학생은 이 표에 직접 접근하지 않습니다 (Edge Function 이 service_role 로 대신 조회).
drop policy if exists "owner reads own class code" on class_codes;
drop policy if exists "owner inserts own class code" on class_codes;
drop policy if exists "owner updates own class code" on class_codes;
drop policy if exists "owner deletes own class code" on class_codes;

create policy "owner reads own class code"
  on class_codes for select using (auth.uid() = uid);
create policy "owner inserts own class code"
  on class_codes for insert with check (auth.uid() = uid);
create policy "owner updates own class code"
  on class_codes for update using (auth.uid() = uid);
create policy "owner deletes own class code"
  on class_codes for delete using (auth.uid() = uid);

-- ---------- 슬롯 한 칸을 원자적으로 기록하는 함수 ----------
-- 여러 학생이 동시에 업로드해도 서로의 칸을 덮어쓰지 않도록,
-- galleries.slots(jsonb 배열)에서 한 인덱스만 잠금 후 갱신합니다.
-- Edge Function(class-upload)에서 service_role 로 호출합니다.
create or replace function set_gallery_slot(p_uid uuid, p_index int, p_value jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  cur jsonb;
begin
  insert into galleries(uid, slots) values (p_uid, '[]'::jsonb)
    on conflict (uid) do nothing;

  select slots into cur from galleries where uid = p_uid for update;
  cur := coalesce(cur, '[]'::jsonb);

  -- 배열이 p_index 보다 짧으면 null 로 채웁니다.
  while jsonb_array_length(cur) <= p_index loop
    cur := cur || 'null'::jsonb;
  end loop;

  cur := jsonb_set(cur, array[p_index::text], p_value, true);

  update galleries set slots = cur, updated_at = now() where uid = p_uid;
end;
$$;
