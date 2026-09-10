# 학생 업로드(반 코드) 기능 설치 안내

학생이 로그인 없이 QR/코드로 들어와서, 자기 출석번호 칸에 그림을 올리면
그 그림이 **선생님 계정**에 저장되는 기능입니다.

동작 방식: 학생 페이지 → `class-upload`(작은 서버 함수)가 코드를 확인 →
선생님 계정 폴더에 대신 저장. 학생 계정은 만들지 않습니다.

설치는 **3단계**입니다. 한 번만 하면 됩니다.

---

## 1단계. 데이터베이스 설정 (2분)

1. Supabase 대시보드 → 왼쪽 **SQL Editor** → **New query**
2. 이 저장소의 [`class_upload_setup.sql`](class_upload_setup.sql) 내용을 전부 복사해 붙여넣기
3. **Run** 클릭 → "Success" 나오면 끝

> 만드는 것: `class_codes` 표(반 코드 저장) + `set_gallery_slot` 함수(동시 업로드 안전 처리)

---

## 2단계. 서버 함수 2개 배포 (5분)

`class-info` 와 `class-upload` 두 개를 올립니다. **방법 A(대시보드)** 를 추천합니다.

### 방법 A — 대시보드에서 (설치 프로그램 필요 없음)

1. Supabase 대시보드 → 왼쪽 **Edge Functions** → **Deploy a new function** (또는 **Create a new function**)
2. 이름: `class-info`
3. 편집기에 이 저장소의 [`supabase/functions/class-info/index.ts`](supabase/functions/class-info/index.ts) 내용을 전부 붙여넣기
4. **Deploy** 클릭
5. **같은 방법으로 `class-upload`** 도 배포
   ([`supabase/functions/class-upload/index.ts`](supabase/functions/class-upload/index.ts) 내용)

> "Verify JWT" 옵션은 **켜진 상태 그대로** 두세요. 학생 페이지는 프로젝트 anon 키로
> 호출하므로 그대로 통과합니다.
> `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 는 Supabase가 자동으로 넣어주므로
> 따로 등록할 것이 없습니다.

### 방법 B — 내 컴퓨터에서 명령어로 (Node.js 설치되어 있으면)

```bash
npx supabase login
npx supabase link --project-ref gqwskbidcodngedosaxb
npx supabase functions deploy class-info
npx supabase functions deploy class-upload
```

---

## 3단계. 웹사이트 코드 반영

이 브랜치(`feature/student-upload`)를 `main` 에 병합(Merge)하면
Vercel이 자동으로 새로 배포합니다. (index.html 만 바뀌었습니다.)

---

## 사용법 (선생님)

1. 평소처럼 로그인
2. 오른쪽 위 **"학생 업로드"** 버튼 → **"업로드 코드 만들기"**
3. 나온 **QR 또는 6자리 코드**를 학생들에게 보여주기 (TV/빔프로젝터)
4. 학생: QR 찍기 → 자기 출석번호 칸 누르기 → 사진 선택 → 이름 입력 (자동 저장)
5. 활동이 끝나면 같은 창에서 **"지금 업로드 받는 중"** 체크를 꺼서 잠그기
6. 선생님 계정으로 보면 학생 그림이 모두 들어와 있음

### 알아두실 점

- QR/코드를 아는 사람은 누구나 올릴 수 있습니다. **활동 후 체크를 꺼서 잠그거나,
  "코드 새로 만들기"** 로 이전 코드를 무효화하세요.
- 학생이 남의 번호 칸에 올리면 덮어써집니다(경고 팝업은 뜸). 화면 보며 지도해 주세요.
- 부적절한 사진 방지 지도는 기존과 동일하게 필요합니다. 선생님은 "그림 관리"에서
  삭제할 수 있습니다.
- 사진은 업로드 전 자동 축소(가로/세로 최대 1400px)됩니다.
