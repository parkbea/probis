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
