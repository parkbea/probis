// ── 필터 ─────────────────────────────────────
// 종료(완료) 상태값 — 완료함으로 이동되는 상태들 ('완료'는 구버전 호환)
const DONE_STATUSES = ['개발완료', '중지', '보류', '리젝', '완료'];
// 완료 처리된(보관된) 프로젝트 판정 = archived 플래그 OR 종료 상태
function isDone(p) { return !!p.archived || DONE_STATUSES.includes(p.status); }
// 메인 화면용 = 완료/보관되지 않은 프로젝트
function activeProjects() { return projects.filter(p => !isDone(p)); }
// 목록 대표 표시명 = 서브타이틀(한글) 우선, 없으면 원제(OpenProject name)
function displayName(p) { return (p.subtitle && p.subtitle.trim()) ? p.subtitle : (p.name || ''); }
function filtered() {
  const q = searchTerm(), sf = statusFilter();
  return projects.filter(p => {
    if (isDone(p)) return false;
    const ms = !q  || p.name.toLowerCase().includes(q) || (p.subtitle || '').toLowerCase().includes(q);
    const mf = !sf || p.status === sf;
    return ms && mf;
  });
}
function handleSearch() { renderKanban(); if (currentView==='gantt') renderGantt(); updateCount(); }
function handleFilter() { renderKanban(); if (currentView==='gantt') renderGantt(); updateCount(); }
function updateCount() {
  const el = document.getElementById('filter-count');
  const t = activeProjects().length, f = filtered().length;
  el.textContent = (searchTerm() || statusFilter()) ? `${f} / ${t} 건` : `총 ${t} 건`;
}

// ── 뷰 전환 ──────────────────────────────────
function switchView(v) {
  currentView = v;
  ['kanban','gantt','calendar','team'].forEach(n => {
    document.getElementById('view-'+n).classList.toggle('hidden', n !== v);
    document.getElementById('tab-'+n).classList.toggle('active',  n === v);
  });
  if (v === 'gantt')    renderGantt();
  if (v === 'calendar') renderCalendar();
  if (v === 'team')     renderTeam();
}

// ── 전체 렌더 ─────────────────────────────────
function renderAll() {
  renderDashboard(); renderKanban(); updateCount();
  if (typeof updateArchiveBadge === 'function') updateArchiveBadge();
  if (currentView === 'gantt')    renderGantt();
  if (currentView === 'calendar') renderCalendar();
  if (currentView === 'team')     renderTeam();
}

// ── 대시보드 ──────────────────────────────────
function renderDashboard() {
  const act = activeProjects();
  const mm = act.reduce((s,p) => s + (p.effortUnit==='MD' ? p.effort/20 : p.effort), 0);
  document.getElementById('dashboard').innerHTML = [
    statCard('전체',   act.length, '건', '#6366F1', 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'),
    statCard('RFI',    act.filter(p=>p.type==='RFI').length, '건', '#3B82F6', 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
    statCard('RFP',    act.filter(p=>p.type==='RFP').length, '건', '#F59E0B', 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
    statCard('실행중', act.filter(p=>p.type==='실행중인 프로젝트').length, '건', '#10B981', 'M13 10V3L4 14h7v7l9-11h-7z'),
    statCard('총 공수', mm.toFixed(1), 'MM', '#8B5CF6', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'),
  ].join('');
}
function statCard(label, val, unit, color, path) {
  return `<div class="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 border-l-4" style="border-color:${color}">
    <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background:${color}1a">
      <svg class="w-5 h-5" fill="none" stroke="${color}" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/></svg>
    </div>
    <div><p class="text-xs text-slate-500">${label}</p><p class="text-xl font-bold text-slate-800 leading-tight">${val} <span class="text-sm font-normal text-slate-400">${unit}</span></p></div>
  </div>`;
}

// ── 칸반 ─────────────────────────────────────
function renderKanban() {
  const cols = { 'RFI':[], 'RFP':[], '실행중인 프로젝트':[] };
  filtered().forEach(p => { if (cols[p.type]) cols[p.type].push(p); });
  ['RFI','RFP','실행중인 프로젝트'].forEach(t => {
    document.getElementById('col-'+t).innerHTML = cols[t].length ? cols[t].map(renderCard).join('') : emptyKanban();
    document.getElementById('count-'+t).textContent = activeProjects().filter(p=>p.type===t).length;
  });
}
function emptyKanban() {
  return `<div class="flex flex-col items-center justify-center py-10 text-slate-300 select-none text-xs">카드를 드래그하세요</div>`;
}
function renderCard(p) {
  const sc = { '대기':'bg-slate-100 text-slate-500', '진행중':'bg-blue-100 text-blue-700', '완료':'bg-emerald-100 text-emerald-700' };
  const lc = { 'RFI':'border-blue-400', 'RFP':'border-amber-400', '실행중인 프로젝트':'border-emerald-400' };
  const dd = dDay(p);
  const assigns = (p.assignments || []);
  const moveBtns = ['RFI','RFP','실행중인 프로젝트'].filter(t => t !== p.type).map(t => {
    const s  = t === '실행중인 프로젝트' ? '실행' : t;
    const bc = t==='RFI' ? 'bg-blue-50 hover:bg-blue-100 text-blue-600' : t==='RFP' ? 'bg-amber-50 hover:bg-amber-100 text-amber-600' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600';
    return `<button onclick="moveCard(event,'${p.id}','${t}')" class="text-xs px-2 py-0.5 rounded ${bc} transition-colors font-medium">→ ${s}</button>`;
  }).join('');
  return `<div class="project-card bg-white border border-slate-200 rounded-xl p-3 border-l-4 ${lc[p.type]||''}"
    draggable="true" ondragstart="dragStart(event,'${p.id}')" ondragend="dragEnd(event)" onclick="openEditModal('${p.id}')">
    <div class="flex items-start justify-between gap-2 mb-1.5">
      <h3 class="text-sm font-semibold text-slate-800 leading-snug flex-1 line-clamp-2">${esc(displayName(p))}</h3>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button onclick="copyProject(event,'${p.id}')" title="복사" class="p-0.5 text-slate-300 hover:text-indigo-400 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        </button>
        <span class="text-xs px-1.5 py-0.5 rounded-full font-medium ${sc[p.status]||''}">${p.status}</span>
      </div>
    </div>
    ${[p.opEpicUrl, p.opEffortUrl, p.opQaUrl].some(Boolean) ? `<div class="flex gap-1 mb-1.5">${p.opEpicUrl?'<span class="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded font-medium">Epic</span>':''}${p.opEffortUrl?'<span class="text-xs bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium">공수</span>':''}${p.opQaUrl?'<span class="text-xs bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded font-medium">QA</span>':''}</div>` : ''}
    <div class="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-50">
      <span>${fmtShort(p.startDate)} ${p.endDate ? '~ '+fmtShort(p.endDate) : ''}</span>
      <span>${p.effort ? `${p.effort} ${p.effortUnit}` : '공수 미정'}</span>
    </div>
    ${assigns.length ? `<div class="mt-1.5 flex flex-wrap gap-1">${assigns.slice(0,3).map(a=>`<span class="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">${esc(a.name)}</span>`).join('')}${assigns.length>3 ? `<span class="text-xs text-slate-400">+${assigns.length-3}</span>` : ''}</div>` : ''}
    ${dd ? `<div class="mt-1.5 text-xs ${dd.cls} font-medium">${dd.txt}</div>` : ''}
    <div class="mt-2 flex gap-1 flex-wrap items-center">${moveBtns}
      <button onclick="archiveProject(event,'${p.id}')" title="완료 처리(보관)" class="ml-auto text-xs px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600 transition-colors font-medium">✓ 완료</button>
    </div>
  </div>`;
}
function dDay(p) {
  if (!p.endDate || isDone(p)) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.ceil((new Date(p.endDate) - today) / 86400000);
  if (diff < 0)   return { txt:`${Math.abs(diff)}일 지연`, cls:'text-red-500' };
  if (diff === 0) return { txt:'오늘 마감',                cls:'text-red-500' };
  if (diff <= 7)  return { txt:`D-${diff}`,               cls:'text-amber-500' };
  if (diff <= 30) return { txt:`D-${diff}`,               cls:'text-blue-400' };
  return null;
}

// ── 드래그 & 드롭 ─────────────────────────────
function dragStart(e, id) { draggedId = id; e.dataTransfer.effectAllowed = 'move'; setTimeout(() => e.target.classList.add('card-dragging'), 0); }
function dragEnd(e)        { e.target.classList.remove('card-dragging'); document.querySelectorAll('.drop-active').forEach(el => el.classList.remove('drop-active')); }
function handleDragOver(e, t) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drop-active'); }
function handleDragLeave(e)   { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove('drop-active'); }
function handleDrop(e, type) {
  e.preventDefault(); e.currentTarget.classList.remove('drop-active');
  if (!draggedId) return;
  const p = projects.find(x => x.id === draggedId);
  if (p && p.type !== type) { p.type = type; p.updatedAt = now(); saveProjects(); renderAll(); showToast(`→ ${type}`, 'success'); }
  draggedId = null;
}
function moveCard(e, id, type) {
  e.stopPropagation();
  const p = projects.find(x => x.id === id);
  if (p) { p.type = type; p.updatedAt = now(); saveProjects(); renderAll(); showToast(`→ ${type}`, 'success'); }
}

// ── 타입 필터 토글 ───────────────────────────
const TYPE_COLORS = { 'RFI': 'bg-blue-500', 'RFP': 'bg-amber-500', '실행중인 프로젝트': 'bg-emerald-500' };
const TYPE_LABELS = { 'RFI': 'RFI', 'RFP': 'RFP', '실행중인 프로젝트': '실행중' };

function updateTypeFilterBtns(view, filter) {
  Object.keys(filter).forEach(type => {
    const btn = document.getElementById(`${view}-filter-${type}`);
    if (!btn) return;
    if (filter[type]) {
      btn.classList.remove('bg-slate-100', 'text-slate-400', 'line-through');
      btn.classList.add(TYPE_COLORS[type], 'text-white');
    } else {
      btn.classList.remove(TYPE_COLORS[type], 'text-white');
      btn.classList.add('bg-slate-100', 'text-slate-400');
    }
  });
}
function toggleGanttType(type) {
  const active = Object.values(ganttTypeFilter).filter(Boolean).length;
  ganttTypeFilter[type] = !(ganttTypeFilter[type]) || active === 1 ? true : false;
  if (Object.values(ganttTypeFilter).filter(Boolean).length === 0) ganttTypeFilter[type] = true;
  updateTypeFilterBtns('gantt', ganttTypeFilter);
  renderGantt();
}
function toggleCalType(type) {
  const active = Object.values(calTypeFilter).filter(Boolean).length;
  calTypeFilter[type] = !(calTypeFilter[type]) || active === 1 ? true : false;
  if (Object.values(calTypeFilter).filter(Boolean).length === 0) calTypeFilter[type] = true;
  updateTypeFilterBtns('cal', calTypeFilter);
  renderCalendar();
}
function toggleCalPersonal() {
  calPersonalShow = !calPersonalShow;
  const btn = document.getElementById('cal-filter-personal');
  if (calPersonalShow) {
    btn.classList.remove('bg-slate-100', 'text-slate-400');
    btn.classList.add('bg-pink-400', 'text-white');
  } else {
    btn.classList.remove('bg-pink-400', 'text-white');
    btn.classList.add('bg-slate-100', 'text-slate-400');
  }
  renderCalendar();
}

// ── 간트 ─────────────────────────────────────
function renderGantt() {
  const ps = filtered().filter(p => (p.startDate || p.endDate) && ganttTypeFilter[p.type]);
  const el = document.getElementById('gantt-body');
  if (!ps.length) { el.innerHTML = `<p class="text-center text-slate-400 py-16 text-sm">일정이 등록된 프로젝트가 없습니다.</p>`; return; }

  const today = new Date(); today.setHours(0,0,0,0);
  let minD = new Date(today), maxD = new Date(today);
  ps.forEach(p => {
    if (p.startDate) { const d = parseDate(p.startDate); if (d < minD) minD = d; }
    if (p.endDate)   { const d = parseDate(p.endDate);   if (d > maxD) maxD = d; }
  });
  minD = new Date(minD.getFullYear(), minD.getMonth()-1, 1);
  maxD = new Date(maxD.getFullYear(), maxD.getMonth()+2, 0);

  const totalMs = maxD - minD;
  const months = []; let cur = new Date(minD.getFullYear(), minD.getMonth(), 1);
  while (cur <= maxD) { months.push(new Date(cur)); cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1); }

  const todayPct = Math.max(0, Math.min(100, (today - minD) / totalMs * 100));
  const tc = { 'RFI':'#3B82F6', 'RFP':'#F59E0B', '실행중인 프로젝트':'#10B981' };
  const sa = { '완료':'bb', '진행중':'ff', '대기':'88' };
  const LW = 180;

  let html = `<div style="min-width:${LW + months.length*90}px">`;
  html += `<div class="flex mb-1" style="padding-left:${LW}px">`;
  months.forEach(m => { html += `<div class="text-xs text-slate-400 font-medium flex-shrink-0 text-center" style="width:${(1/months.length*100).toFixed(2)}%;min-width:80px">${m.getFullYear()}.${String(m.getMonth()+1).padStart(2,'0')}</div>`; });
  html += `</div><div class="relative">`;
  months.forEach((m,i) => { if (i===0) return; const pct=((m-minD)/totalMs*100).toFixed(2); html+=`<div class="absolute top-0 bottom-0 w-px bg-slate-100" style="left:calc(${LW}px + ${pct}%)"></div>`; });
  html += `<div class="gantt-today-line" style="left:calc(${LW}px + ${todayPct.toFixed(2)}%)"><span style="position:absolute;top:2px;left:1px;transform:translateX(-50%);font-size:9px;font-weight:700;color:#ef4444;background:white;border:1px solid #fca5a5;padding:0 3px;border-radius:3px;white-space:nowrap;z-index:6">TODAY</span></div>`;

  ps.forEach(p => {
    const color = (tc[p.type]||'#6366f1') + (sa[p.status]||'ff');
    const sD = p.startDate ? parseDate(p.startDate) : new Date(minD);
    const eD = p.endDate   ? parseDate(p.endDate)   : new Date(maxD);
    const lPct = Math.max(0, (sD - minD) / totalMs * 100);
    const wPct = Math.max(0.5, (eD - sD) / totalMs * 100);
    html += `<div class="flex items-center mb-2">
      <div class="flex-shrink-0 pr-3 text-right" style="width:${LW}px"><p class="text-xs font-semibold text-slate-700 truncate">${esc(displayName(p))}</p></div>
      <div class="flex-1 relative h-9 flex items-center">
        <div class="gantt-bar absolute" style="left:${lPct.toFixed(2)}%;width:${wPct.toFixed(2)}%;background:${color}" onclick="openEditModal('${p.id}')" title="${esc(displayName(p))}">${esc(displayName(p))}</div>
      </div>
    </div>`;
  });
  html += `</div></div>`;
  el.innerHTML = html;
}

// ── 캘린더 ────────────────────────────────────
function moveMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}
function renderCalendar() {
  document.getElementById('cal-title').textContent = `${calYear}년 ${calMonth+1}월`;
  const firstDow    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const tc = { 'RFI':'#3B82F6', 'RFP':'#F59E0B', '실행중인 프로젝트':'#10B981' };

  const evMap = {};
  const addEv = (ds, obj) => { if (!evMap[ds]) evMap[ds]=[]; evMap[ds].push(obj); };
  projects.filter(p => calTypeFilter[p.type] && !isDone(p)).forEach(p => {
    if (p.startDate) addEv(p.startDate, { kind:'project', label:'▶ '+displayName(p), id:p.id, color:tc[p.type]||'#6366f1' });
    if (p.endDate && p.endDate !== p.startDate) addEv(p.endDate, { kind:'project', label:'■ '+displayName(p), id:p.id, color:tc[p.type]||'#6366f1' });
  });
  if (calPersonalShow) {
    personal.forEach(ev => {
      if (ev.startDate) {
        const s = new Date(ev.startDate), e = new Date(ev.endDate || ev.startDate);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) {
          const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          addEv(ds, { kind:'personal', label:ev.title, id:ev.id, color:ev.color||'#ec4899' });
        }
      }
    });
  }

  let html = '', dc = 0;
  for (let i = firstDow-1; i >= 0; i--) { html += `<div class="cal-cell cal-other"><span class="text-xs text-slate-300">${daysInPrev-i}</span></div>`; dc++; }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(calYear, calMonth, d);
    const isToday = dt.getTime() === today.getTime();
    const ds  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const evs = evMap[ds] || [];
    const dow = dt.getDay();
    const nc  = dow===0 ? 'text-red-400' : dow===6 ? 'text-blue-400' : 'text-slate-600';
    html += `<div class="cal-cell ${isToday?'cal-today':''}" ondblclick="openPersonalEventModal('${ds}')">
      <span class="text-xs font-semibold ${nc}">${d}</span>`;
    evs.slice(0,3).forEach(ev => {
      if (ev.kind === 'project') {
        html += `<div class="cal-event" style="background:${ev.color}" onclick="openEditModal('${ev.id}')" title="${esc(ev.label)}">${esc(ev.label)}</div>`;
      } else {
        html += `<div class="cal-personal" style="border-color:${ev.color}" onclick="openPersonalEventEdit('${ev.id}')" title="${esc(ev.label)}">${esc(ev.label)}</div>`;
      }
    });
    if (evs.length > 3) html += `<div class="text-xs text-slate-400 mt-0.5 pl-1">+${evs.length-3}</div>`;
    html += `</div>`; dc++;
  }
  const rem = (7 - dc % 7) % 7;
  for (let d = 1; d <= rem; d++) { html += `<div class="cal-cell cal-other"><span class="text-xs text-slate-300">${d}</span></div>`; }
  document.getElementById('cal-grid').innerHTML = html;
}

// ── 팀 뷰 ────────────────────────────────────
function renderTeam() {
  const totalCapMM = members.reduce((s,m) => s + (parseFloat(m.capacity)||1), 0);
  const allocMap = {};
  activeProjects().forEach(p => (p.assignments||[]).forEach(a => {
    const key = a.memberId || a.name;
    if (!allocMap[key]) allocMap[key] = { totalMM:0, projects:[] };
    const mm = a.effortUnit==='MD' ? a.effort/20 : a.effort;
    allocMap[key].totalMM += mm;
    allocMap[key].projects.push({ name:displayName(p), type:p.type, effort:a.effort, effortUnit:a.effortUnit });
  }));
  const overloaded = members.filter(m => (allocMap[m.id]||{}).totalMM > (parseFloat(m.capacity)||1)*1.5).length;

  document.getElementById('team-stats').innerHTML = [
    tStatCard('전체 팀원',  '#6366F1', members.length, '명'),
    tStatCard('총 가용 공수','#10B981', totalCapMM.toFixed(1), 'MM/월'),
    tStatCard('배정 공수',  '#F59E0B', Object.values(allocMap).reduce((s,v)=>s+v.totalMM,0).toFixed(1), 'MM'),
    tStatCard('과부하',     '#EF4444', overloaded, '명'),
  ].join('');

  const tc = { 'RFI':'#3B82F6', 'RFP':'#F59E0B', '실행중인 프로젝트':'#10B981' };
  if (!members.length) {
    document.getElementById('team-grid').innerHTML = `<div class="col-span-3 py-12 text-center"><p class="text-slate-400 text-sm">등록된 팀원이 없습니다.</p><p class="text-xs text-slate-300 mt-1">상단 "팀원 추가" 버튼을 클릭하세요.</p></div>`;
    return;
  }
  document.getElementById('team-grid').innerHTML = members.map(m => {
    const alloc = allocMap[m.id] || { totalMM:0, projects:[] };
    const cap   = parseFloat(m.capacity) || 1;
    const pct   = Math.min(100, alloc.totalMM / cap * 100);
    const fc    = alloc.totalMM > cap*1.5 ? 'bg-red-400' : alloc.totalMM > cap ? 'bg-amber-400' : 'bg-indigo-400';
    return `<div class="border border-slate-200 rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">${esc(m.name.slice(0,1))}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-800 truncate">${esc(m.name)}</p>
          <p class="text-xs text-slate-400">${esc(m.role||'')}${m.team ? ` · ${esc(m.team)}` : ''}</p>
        </div>
        <div class="flex gap-1">
          <button onclick="openMemberEdit('${m.id}')" class="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
          <button onclick="deleteMember('${m.id}')" class="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
        </div>
      </div>
      <div class="mb-3">
        <div class="flex justify-between text-xs mb-1">
          <span class="text-slate-500">투입 공수</span>
          <span class="font-semibold ${alloc.totalMM>cap*1.5?'text-red-500':'text-slate-700'}">${alloc.totalMM.toFixed(1)} / ${cap} MM</span>
        </div>
        <div class="effort-track"><div class="effort-fill ${fc}" style="width:${pct}%"></div></div>
      </div>
      ${alloc.projects.length ? `<div class="space-y-1">${alloc.projects.map(pr=>`<div class="flex items-center justify-between text-xs"><span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:${tc[pr.type]||'#6366f1'}"></span><span class="text-slate-600 truncate max-w-[110px]">${esc(pr.name)}</span></span><span class="text-slate-400">${pr.effort} ${pr.effortUnit}</span></div>`).join('')}</div>` : `<p class="text-xs text-slate-300">배정된 프로젝트 없음</p>`}
      ${m.email ? `<p class="text-xs text-slate-300 mt-2 truncate">✉ ${esc(m.email)}</p>` : ''}
    </div>`;
  }).join('');
}
function tStatCard(label, color, val, unit) {
  return `<div class="bg-white rounded-xl px-4 py-3 shadow-sm border-l-4" style="border-color:${color}"><p class="text-xs text-slate-500">${label}</p><p class="text-xl font-bold text-slate-800">${val} <span class="text-sm font-normal text-slate-400">${unit}</span></p></div>`;
}
