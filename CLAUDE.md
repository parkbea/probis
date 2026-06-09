# koFlow — 프로젝트 문서

**한국지사 프로젝트 관리 시스템**  
망분리 환경용 프로젝트 관리 웹앱 (Node.js/Python 로컬 서버 + 순수 프론트엔드)

---

## 폴더 구조

```
probis/
├── public/                  ← 웹서버가 서빙하는 프론트엔드
│   ├── index.html           ← 앱 진입점 (HTML만, JS/CSS 분리)
│   ├── css/
│   │   └── style.css        ← 커스텀 CSS (Tailwind 유틸 외 전용 클래스)
│   ├── js/
│   │   ├── state.js         ← 전역 상태 변수
│   │   ├── utils.js         ← uid, now, esc, fmtDate, showToast, closeModal
│   │   ├── storage.js       ← JSON 파일 읽기(fetch GET) / 쓰기(fetch POST)
│   │   ├── config.js        ← 설정 로드/저장, OpenProject 연결 테스트
│   │   ├── openproject.js   ← OpenProject API 프록시 연동
│   │   ├── render.js        ← 대시보드, 칸반, 간트, 캘린더, 팀 뷰 렌더링
│   │   ├── modal.js         ← 프로젝트/팀원/개인일정 모달 CRUD
│   │   ├── email.js         ← 이메일 분석, OpenProject URL 감지, 등록
│   │   └── main.js          ← 샘플 데이터, DOMContentLoaded 초기화
│   └── lib/
│       └── tailwind.js      ← Tailwind Play CDN 로컬 사본 (~398KB, 망분리)
├── data/                    ← 앱 데이터 (서버가 읽기/쓰기)
│   ├── projects.json
│   ├── members.json
│   ├── personal_calendar.json
│   └── config.json          ← OpenProject 연동 설정
├── server.js                ← Node.js 서버
├── server.py                ← Python 서버
├── 실행.bat                  ← 더블클릭 한 번으로 서버 시작 + 브라우저 열기
└── CLAUDE.md                ← 이 파일
```

---

## 실행 방법

**`실행.bat` 더블클릭** — Node.js 또는 Python을 자동 감지해서 서버 시작 후 브라우저 열기

수동 실행:
```powershell
node server.js     # Node.js
python server.py   # Python
```
→ `http://localhost:8080` 접속

---

## 서버 라우팅

| 요청 | 처리 |
|------|------|
| `GET /` | `public/index.html` 서빙 |
| `GET /css/style.css` | `public/css/style.css` 서빙 |
| `GET /js/*.js` | `public/js/` 서빙 |
| `GET /lib/tailwind.js` | `public/lib/tailwind.js` 서빙 |
| `GET /data/*.json` | `data/*.json` 읽기 |
| `POST /data/*.json` | `data/*.json` 덮어쓰기 |
| `GET /op-proxy?path=...` | OpenProject API 프록시 (config.json의 API 키 사용) |

---

## 데이터 흐름

```
앱 시작
  └─ loadConfig()          : GET data/config.json → 설정 패널 초기화
  └─ loadFromFiles()       : GET data/projects.json + members.json + personal_calendar.json
  └─ seedXxx()             : 파일 없으면 샘플 데이터 사용 (메모리만)
  └─ renderAll()           : 화면 그리기

데이터 수정 (저장/삭제/드래그 등)
  └─ saveProjects/Members/Personal() : POST data/*.json → 서버가 파일 즉시 덮어씀

새로고침 → loadFromFiles()가 업데이트된 파일 다시 읽음
```

---

## JS 파일별 역할

| 파일 | 주요 함수 |
|------|----------|
| `state.js` | `projects`, `members`, `personal`, `config`, `draggedId` 등 전역 변수 |
| `utils.js` | `uid()`, `now()`, `esc()`, `fmtDate()`, `fmtShort()`, `showToast()`, `closeModal()` |
| `storage.js` | `loadFromFiles()`, `saveProjects()`, `saveMembers()`, `savePersonal()` |
| `config.js` | `loadConfig()`, `saveConfig()`, `testOpConnection()`, `toggleSettingsPanel()` |
| `openproject.js` | `fetchFromOpenProject()` — 이메일 분석 후 OP URL로 프로젝트 정보 자동 채우기 |
| `render.js` | `renderAll()`, `renderDashboard()`, `renderKanban()`, `renderGantt()`, `renderCalendar()`, `renderTeam()` |
| `modal.js` | `openCreateModal()`, `openEditModal()`, `saveProjectModal()`, `openMemberModal()`, `saveMemberModal()`, `openPersonalEventModal()` 등 |
| `email.js` | `analyzeEmail()`, `analyzeAndPreview()`, `registerFromEmail()`, `toggleEmailPanel()` |
| `main.js` | `seedProjects()`, `seedMembers()`, `seedPersonal()`, `DOMContentLoaded` 핸들러 |

---

## OpenProject 연동 설정

1. OpenProject → 개인설정 → **Access Tokens** → API access token 발급
2. koFlow 헤더 ⚙ 설정 버튼 → 서버 URL + API 키 입력 → 저장
3. 이메일 분석 시 `http://openproject.xxx.co.jp/projects/123` 형식 URL 자동 감지
4. "가져오기" 버튼 클릭 → 프로젝트명/날짜/요약 자동 채움

---

## 데이터 스키마

### Project
```json
{ "id":"p1", "type":"RFI|RFP|실행중인 프로젝트", "name":"", "client":"",
  "summary":"", "effort":5, "effortUnit":"MM|MD",
  "startDate":"YYYY-MM-DD", "endDate":"YYYY-MM-DD",
  "status":"대기|진행중|완료", "emailContent":"",
  "assignments":[{"id":"a1","memberId":"m1","name":"","role":"","effort":1,"effortUnit":"MM"}],
  "createdAt":"ISO", "updatedAt":"ISO" }
```

### Member
```json
{ "id":"m1", "name":"", "role":"", "team":"", "email":"", "capacity":1, "memo":"" }
```

### Personal Event
```json
{ "id":"pe1", "title":"", "type":"개인|휴가|출장|회의|기념일|기타",
  "color":"#hex", "startDate":"YYYY-MM-DD", "endDate":"YYYY-MM-DD", "memo":"" }
```

### Config
```json
{ "openproject": { "baseUrl": "http://openproject.xxx.co.jp", "apiKey": "..." } }
```
