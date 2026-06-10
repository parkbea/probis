// ── 완료(보관) 프로젝트 관리 ─────────────────────────
// 메인에서 "✓ 완료" → archived=true 로 보관함 이동
// 보관함에서 "복원" → archived=false 로 메인 복귀

// 진행중 프로젝트를 완료(보관) 처리
function archiveProject(e, id) {
  if (e) e.stopPropagation();
  const p = projects.find(x => x.id === id); if (!p) return;
  p.archived  = true;
  p.status    = '완료';
  p.updatedAt = now();
  saveProjects(); renderAll();
  if (!document.getElementById('archive-modal').classList.contains('hidden')) renderArchiveList();
  showToast(`"${p.name}" 완료 처리됨`, 'success');
}

// 보관된 프로젝트를 다시 메인으로 복원
function restoreProject(e, id) {
  if (e) e.stopPropagation();
  const p = projects.find(x => x.id === id); if (!p) return;
  p.archived  = false;
  p.status    = '진행중';
  p.updatedAt = now();
  saveProjects(); renderAll(); renderArchiveList();
  showToast(`"${p.name}" 복원됨 — 메인으로 이동`, 'success');
}

// 보관된 프로젝트 영구 삭제
function deleteArchivedProject(e, id) {
  if (e) e.stopPropagation();
  const p = projects.find(x => x.id === id); if (!p) return;
  if (!confirm(`"${p.name}"을(를) 영구 삭제하시겠습니까?`)) return;
  projects = projects.filter(x => x.id !== id);
  saveProjects(); renderAll(); renderArchiveList();
  showToast('삭제됨', 'info');
}

// 헤더 버튼의 보관 개수 배지 갱신
function updateArchiveBadge() {
  const badge = document.getElementById('archive-badge');
  if (!badge) return;
  const n = projects.filter(p => p.archived).length;
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

// 보관함 모달 열기
function openArchiveModal() {
  renderArchiveList();
  showModalEl('archive-modal');
}

// 보관 프로젝트 목록 렌더
function renderArchiveList() {
  const arr = projects.filter(p => p.archived)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  const el  = document.getElementById('archive-list');
  const cnt = document.getElementById('archive-count');
  if (cnt) cnt.textContent = `${arr.length}건`;

  if (!arr.length) {
    el.innerHTML = `<p class="text-center text-slate-400 py-12 text-sm">완료된 프로젝트가 없습니다.</p>`;
    return;
  }

  const tc = { 'RFI':'border-blue-400', 'RFP':'border-amber-400', '실행중인 프로젝트':'border-emerald-400' };
  const tl = { 'RFI':'RFI', 'RFP':'RFP', '실행중인 프로젝트':'실행' };

  el.innerHTML = arr.map(p => `
    <div class="border border-slate-200 border-l-4 ${tc[p.type]||''} rounded-xl px-3 py-2.5 flex items-center gap-3 bg-white">
      <div class="flex-1 min-w-0 cursor-pointer" onclick="closeModal('archive'); openEditModal('${p.id}')">
        <div class="flex items-center gap-2">
          <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium flex-shrink-0">${tl[p.type]||esc(p.type)}</span>
          <p class="text-sm font-semibold text-slate-700 truncate">${esc(p.name)}</p>
        </div>
        <p class="text-xs text-slate-400 mt-0.5">
          ${fmtShort(p.startDate)}${p.endDate ? ' ~ '+fmtShort(p.endDate) : ''}
          ${p.effort ? ` · ${p.effort} ${p.effortUnit}` : ''}
          ${p.updatedAt ? ` · 완료 ${fmtDate(p.updatedAt)}` : ''}
        </p>
      </div>
      <button onclick="restoreProject(event,'${p.id}')" title="메인으로 복원"
        class="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-medium rounded-lg transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a4 4 0 014 4v0a4 4 0 01-4 4H9m-6-8l4-4m-4 4l4 4"/></svg>복원
      </button>
      <button onclick="deleteArchivedProject(event,'${p.id}')" title="영구 삭제"
        class="flex-shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>`).join('');
}
