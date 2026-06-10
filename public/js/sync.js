// ── OpenProject 동기화 ────────────────────────────────
// 헤더 "OP 동기화" → 직원 선택 모달 → 전체 또는 특정 직원만 갱신

function openSyncModal() {
  renderSyncMemberList();
  showModalEl('sync-modal');
}

function renderSyncMemberList() {
  const withId  = members.filter(m => m.opUserId);
  const without = members.filter(m => !m.opUserId);
  const el = document.getElementById('sync-member-list');

  let html = '';
  if (withId.length) {
    html += withId.map(m => `
      <div class="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2.5 bg-white">
        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">${esc(m.name.slice(0,1))}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-700 truncate">${esc(m.name)}</p>
          <p class="text-xs text-slate-400 truncate">${esc(m.role||'')}${m.role?' · ':''}OP ID ${esc(String(m.opUserId))}</p>
        </div>
        <button onclick="closeModal('sync'); syncFromOpenProject('${esc(String(m.opUserId))}', '${esc(m.name)}')"
          class="flex-shrink-0 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors">이 직원만 갱신</button>
      </div>`).join('');
  } else {
    html += `<p class="text-center text-slate-400 py-6 text-sm">OP 사용자 ID가 입력된 팀원이 없습니다.<br>팀원 관리에서 ID를 먼저 입력하세요.</p>`;
  }

  if (without.length) {
    html += `<p class="text-xs text-slate-400 mt-3 mb-1 px-1">OP ID 미입력 (갱신 불가)</p>` +
      without.map(m => `<div class="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400"><span>${esc(m.name)}</span><span class="text-slate-300">· ID 없음</span></div>`).join('');
  }
  el.innerHTML = html;
}

// opId 지정 시 그 직원만, 없으면 전체 갱신
async function syncFromOpenProject(opId, label) {
  const btn = document.getElementById('btn-op-sync');
  btn.disabled = true;
  btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>동기화 중…`;

  try {
    const url  = opId ? `/op-sync?opId=${encodeURIComponent(opId)}` : '/op-sync';
    const res  = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'OpenProject 동기화 실패', 'error');
      return;
    }

    if (data.projects.length === 0) {
      showToast(data.message || '동기화할 프로젝트가 없습니다', 'warning');
      return;
    }

    // 기존 projects와 병합: opEpicUrl 기준으로 매칭 (해당 직원 프로젝트만 갱신/추가, 나머지는 그대로)
    let added = 0, updated = 0;

    data.projects.forEach(opProj => {
      const existing = opProj.opEpicUrl
        ? projects.find(p => p.opEpicUrl === opProj.opEpicUrl)
        : projects.find(p => p.id === opProj.id);

      if (existing) {
        // 원제·날짜만 갱신, 사용자가 입력한 서브타이틀·비고·공수 등은 유지
        existing.name      = opProj.name;
        if (opProj.startDate) existing.startDate = opProj.startDate;
        if (opProj.endDate)   existing.endDate   = opProj.endDate;
        existing.updatedAt = opProj.updatedAt;
        updated++;
      } else {
        projects.push(opProj);
        added++;
      }
    });

    saveProjects();
    renderAll();

    const who = label ? `${label} — ` : '';
    showToast(`${who}동기화 완료 — 신규 ${added}개 추가, ${updated}개 업데이트`, 'success');
  } catch (e) {
    showToast('서버 연결 오류: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>OP 동기화`;
  }
}
