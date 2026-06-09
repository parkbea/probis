// ── 샘플 데이터 ───────────────────────────────
function seedMembers() {
  members = [
    { id:'m1', name:'김철수', role:'PM',     team:'PMO',     email:'kim@company.com',  capacity:1, memo:'' },
    { id:'m2', name:'이영희', role:'아키텍트', team:'개발팀',  email:'lee@company.com',  capacity:1, memo:'' },
    { id:'m3', name:'박지수', role:'디자이너', team:'디자인팀', email:'park@company.com', capacity:1, memo:'' },
    { id:'m4', name:'최민준', role:'개발',    team:'개발팀',  email:'choi@company.com', capacity:1, memo:'' },
    { id:'m5', name:'오세진', role:'개발',    team:'개발팀',  email:'oh@company.com',   capacity:1, memo:'' },
  ];
}
function seedProjects() {
  projects = [
    { id:'p1', type:'RFI',          name:'클라우드 인프라 전환 검토', client:'대한제조(주)',   summary:'온프레미스 서버 환경을 AWS 기반 클라우드로 전환하기 위한 사전 정보 수집', effort:2,  effortUnit:'MM', startDate:'2024-03-01', endDate:'2024-04-30', status:'진행중', emailContent:'', assignments:[{id:'a1',memberId:'m1',name:'김철수',role:'PM',effort:1,effortUnit:'MM'},{id:'a2',memberId:'m2',name:'이영희',role:'아키텍트',effort:1,effortUnit:'MM'}], createdAt:now(), updatedAt:now() },
    { id:'p2', type:'RFP',          name:'모바일 뱅킹 앱 리뉴얼',   client:'한국디지털은행', summary:'iOS/Android 모바일 뱅킹 앱 UI/UX 전면 개선 및 신규 금융 서비스 기능 추가', effort:8,  effortUnit:'MM', startDate:'2024-05-01', endDate:'2024-10-31', status:'대기',   emailContent:'', assignments:[{id:'a3',memberId:'m3',name:'박지수',role:'디자이너',effort:3,effortUnit:'MM'},{id:'a4',memberId:'m4',name:'최민준',role:'개발',effort:5,effortUnit:'MM'}], createdAt:now(), updatedAt:now() },
    { id:'p3', type:'RFP',          name:'HR 시스템 고도화',        client:'글로벌HR솔루션', summary:'AI 기반 채용 자동화 및 성과 분석 모듈 추가 개발',                       effort:5,  effortUnit:'MM', startDate:'2024-06-01', endDate:'2024-09-30', status:'대기',   emailContent:'', assignments:[{id:'a5',memberId:'m1',name:'김철수',role:'PM',effort:1,effortUnit:'MM'},{id:'a6',memberId:'m5',name:'오세진',role:'개발',effort:4,effortUnit:'MM'}], createdAt:now(), updatedAt:now() },
    { id:'p4', type:'실행중인 프로젝트', name:'물류 통합 플랫폼 구축', client:'한국물류(주)',  summary:'AI 기반 실시간 물류 추적, 재고 최적화, 자동 배차 시스템 통합 플랫폼 개발',  effort:15, effortUnit:'MM', startDate:'2023-11-01', endDate:'2024-08-31', status:'진행중', emailContent:'', assignments:[{id:'a7',memberId:'m4',name:'최민준',role:'개발',effort:8,effortUnit:'MM'},{id:'a8',memberId:'m2',name:'이영희',role:'아키텍트',effort:4,effortUnit:'MM'},{id:'a9',memberId:'m3',name:'박지수',role:'디자이너',effort:3,effortUnit:'MM'}], createdAt:now(), updatedAt:now() },
    { id:'p5', type:'실행중인 프로젝트', name:'전자정부 민원 포털 개편', client:'행정안전부',  summary:'노후화된 민원 처리 시스템의 클라우드 전환 및 UX 개선',                    effort:20, effortUnit:'MM', startDate:'2024-01-02', endDate:'2024-12-31', status:'진행중', emailContent:'', assignments:[{id:'a10',memberId:'m1',name:'김철수',role:'PM',effort:3,effortUnit:'MM'},{id:'a11',memberId:'m5',name:'오세진',role:'개발',effort:10,effortUnit:'MM'}], createdAt:now(), updatedAt:now() },
  ];
}
function seedPersonal() {
  const y = new Date().getFullYear(), m = String(new Date().getMonth()+1).padStart(2,'0');
  personal = [
    { id:'pe1', title:'팀 회식',    type:'기타', color:'#f97316', startDate:`${y}-${m}-15`, endDate:`${y}-${m}-15`, memo:'' },
    { id:'pe2', title:'여름 휴가',  type:'휴가', color:'#06b6d4', startDate:`${y}-${m}-20`, endDate:`${y}-${m}-24`, memo:'제주도' },
    { id:'pe3', title:'고객사 방문', type:'출장', color:'#8b5cf6', startDate:`${y}-${m}-10`, endDate:`${y}-${m}-11`, memo:'한국물류 본사' },
  ];
}

// ── 초기화 ────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  const fromFiles = await loadFromFiles();
  if (!members.length)  seedMembers();
  if (!projects.length) seedProjects();
  if (!personal.length) seedPersonal();
  renderAll();
  renderCalendar();
  if (fromFiles) showToast('JSON 파일 데이터 로드 완료', 'success');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['project','member','personal'].forEach(t => {
      if (!document.getElementById(t+'-modal').classList.contains('hidden')) closeModal(t);
    });
  }
});
