// ── 주간보고 모달 ──────────────────────────────

function _toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function _addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function updateNextWeek() {
  const from = document.getElementById('wr-from').value;
  if (!from) return;
  const mon = new Date(from);
  const nextMon = _addDays(mon, 7);
  const nextFri = _addDays(mon, 11);
  document.getElementById('wr-next-from').textContent = _toDateStr(nextMon);
  document.getElementById('wr-next-to').textContent   = _toDateStr(nextFri);
}

function openWeeklyModal() {
  const today = new Date();
  const dow   = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  const friday = _addDays(monday, 4);

  document.getElementById('wr-from').value = _toDateStr(monday);
  document.getElementById('wr-to').value   = _toDateStr(friday);
  updateNextWeek();

  renderWeeklyTable();
  showModalEl('weekly-modal');
}

function renderWeeklyTable() {
  const active = projects.filter(p => !isDone(p));
  const el = document.getElementById('wr-rows');
  if (!active.length) {
    el.innerHTML = `<tr><td colspan="7" class="text-center text-slate-400 py-10 text-sm">진행 중인 프로젝트가 없습니다.</td></tr>`;
    return;
  }
  const typeColor = { 'RFI':'bg-blue-400', 'RFP':'bg-amber-400', '실행중인 프로젝트':'bg-emerald-400' };
  el.innerHTML = active.map(p => {
    const assignees = (p.assignments||[]).map(a => a.name).join(', ');
    const tc = typeColor[p.type] || 'bg-slate-300';
    return `<tr class="border-b border-slate-100 hover:bg-slate-50/60">
      <td class="px-3 py-2 align-top min-w-[130px]">
        <div class="flex items-start gap-1.5">
          <span class="mt-1 w-2 h-2 rounded-full flex-shrink-0 ${tc}"></span>
          <span class="text-xs font-semibold text-slate-800 leading-snug">${esc(displayName(p))}</span>
        </div>
        <span class="ml-3.5 text-xs text-slate-400">${p.type}</span>
      </td>
      <td class="px-2 py-2 align-top min-w-[180px]">
        <textarea id="wr-tw-${p.id}" rows="3" placeholder="금주 완료/진행 내용을 입력하세요"
          class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 leading-relaxed"></textarea>
      </td>
      <td class="px-2 py-2 align-top min-w-[180px]">
        <textarea id="wr-nw-${p.id}" rows="3" placeholder="차주 예정 작업을 입력하세요"
          class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 leading-relaxed"></textarea>
      </td>
      <td class="px-2 py-2 align-top min-w-[90px]">
        <input type="text" id="wr-as-${p.id}" value="${esc(assignees)}"
          class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
      </td>
      <td class="px-2 py-2 align-top min-w-[110px]">
        <input type="date" id="wr-sd-${p.id}" value="${p.startDate||''}"
          class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
      </td>
      <td class="px-2 py-2 align-top min-w-[110px]">
        <input type="date" id="wr-ed-${p.id}" value="${p.endDate||''}"
          class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
      </td>
      <td class="px-2 py-2 align-top min-w-[100px]">
        <input type="text" id="wr-nt-${p.id}" placeholder="비고"
          class="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
      </td>
    </tr>`;
  }).join('');
}

async function generateWeeklyReport() {
  const from   = document.getElementById('wr-from').value;
  const to     = document.getElementById('wr-to').value;
  const active = projects.filter(p => !isDone(p));

  const rows = active.map(p => ({
    name:      displayName(p),
    type:      p.type,
    thisWeek:  (document.getElementById(`wr-tw-${p.id}`)?.value || '').trim(),
    nextWeek:  (document.getElementById(`wr-nw-${p.id}`)?.value || '').trim(),
    assignees: (document.getElementById(`wr-as-${p.id}`)?.value || '').trim(),
    startDate: document.getElementById(`wr-sd-${p.id}`)?.value || '',
    endDate:   document.getElementById(`wr-ed-${p.id}`)?.value || '',
    note:      (document.getElementById(`wr-nt-${p.id}`)?.value || '').trim(),
  }));

  const btn = document.getElementById('wr-gen-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> 생성 중…`;

  try {
    const nextFrom = document.getElementById('wr-next-from').textContent || '';
    const nextTo   = document.getElementById('wr-next-to').textContent   || '';
    const resp = await fetch('/weekly-report', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ from, to, nextFrom, nextTo, rows }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: '서버 오류' }));
      showToast(err.error || '생성 실패', 'error');
      return;
    }

    const contentType = resp.headers.get('Content-Type') || '';
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const stamp = (from || '').replace(/-/g, '');
    a.download  = contentType.includes('presentation')
      ? `주간보고_${stamp}.pptx`
      : `주간보고_${stamp}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('다운로드 완료!', 'success');
  } catch(e) {
    showToast('생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> 보고서 생성`;
  }
}
