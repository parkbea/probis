async function fetchFromOpenProject() {
  const opUrl = document.getElementById('ep-opurl').value;
  const match = opUrl.match(/\/projects\/([^/?#\s]+)/);
  if (!match) { showToast('OpenProject URL 형식이 올바르지 않습니다', 'error'); return; }

  const projectId = match[1];
  showToast('OpenProject에서 가져오는 중…', 'info');

  try {
    const r = await fetch(`/op-proxy?path=/api/v3/projects/${encodeURIComponent(projectId)}`);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      if (r.status === 401) showToast('인증 실패 — API 키를 확인하세요', 'error');
      else showToast(`OpenProject 오류: ${r.status} ${err.message || ''}`.trim(), 'error');
      return;
    }
    const d = await r.json();

    if (d.name)    document.getElementById('ep-name').value  = d.name;
    if (d.startDate) document.getElementById('ep-start').value = d.startDate;
    if (d.dueDate)   document.getElementById('ep-end').value   = d.dueDate;

    showToast('OpenProject 데이터 가져오기 완료', 'success');
  } catch { showToast('OpenProject 연결 실패', 'error'); }
}

// 프로젝트 편집 모달에서 Epic URL로 OP 정보를 다시 읽어 원제·날짜 갱신
async function refreshFromOpenProject() {
  const url = document.getElementById('m-epic-url').value.trim();
  const match = url.match(/\/projects\/([^/?#\s]+)/);
  if (!match) { showToast('Epic URL이 없거나 형식이 올바르지 않습니다 (…/projects/…)', 'warning'); return; }

  const projectId = match[1];
  showToast('OpenProject에서 다시 읽는 중…', 'info');

  try {
    const r = await fetch(`/op-proxy?path=/api/v3/projects/${encodeURIComponent(projectId)}`);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      if (r.status === 401) showToast('인증 실패 — API 키를 확인하세요', 'error');
      else showToast(`OpenProject 오류: ${r.status} ${err.message || ''}`.trim(), 'error');
      return;
    }
    const d = await r.json();

    if (d.name)      document.getElementById('m-name').value  = d.name;
    if (d.startDate) document.getElementById('m-start').value = d.startDate;
    if (d.dueDate)   document.getElementById('m-end').value   = d.dueDate;

    showToast('OP 정보 갱신됨 — 저장 버튼을 눌러 반영하세요', 'success');
  } catch { showToast('OpenProject 연결 실패', 'error'); }
}
