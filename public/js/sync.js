async function syncFromOpenProject() {
  const btn = document.getElementById('btn-op-sync');
  btn.disabled = true;
  btn.innerHTML = `<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>동기화 중…`;

  try {
    const res  = await fetch('/op-sync');
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'OpenProject 동기화 실패', 'error');
      return;
    }

    if (data.projects.length === 0) {
      showToast(data.message || '동기화할 프로젝트가 없습니다', 'warning');
      return;
    }

    // 기존 projects와 병합: opEpicUrl 기준으로 매칭
    let added = 0, updated = 0;

    data.projects.forEach(opProj => {
      const existing = opProj.opEpicUrl
        ? projects.find(p => p.opEpicUrl === opProj.opEpicUrl)
        : projects.find(p => p.id === opProj.id);

      if (existing) {
        // 이름·날짜만 업데이트, 사용자가 수정한 나머지 필드는 유지
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

    const opUserNames = (data.opUsers || []).map(u => u.opName || u.email).join(', ');
    showToast(
      `동기화 완료 — 신규 ${added}개 추가, ${updated}개 업데이트` +
      (opUserNames ? ` (${opUserNames})` : ''),
      'success'
    );
  } catch (e) {
    showToast('서버 연결 오류: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>OP 동기화`;
  }
}
