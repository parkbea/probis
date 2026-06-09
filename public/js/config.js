async function loadConfig() {
  try {
    const r = await fetch('data/config.json');
    if (r.ok) config = await r.json();
    document.getElementById('cfg-op-url').value = config.openproject?.baseUrl || '';
    document.getElementById('cfg-op-key').value = config.openproject?.apiKey  || '';
  } catch {}
}

function saveConfig() {
  config.openproject = {
    baseUrl: document.getElementById('cfg-op-url').value.trim().replace(/\/$/, ''),
    apiKey:  document.getElementById('cfg-op-key').value.trim(),
  };
  fetch('data/config.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config, null, 2),
  })
    .then(() => showToast('설정 저장됨', 'success'))
    .catch(() => showToast('설정 저장 실패', 'error'));
}

async function testOpConnection() {
  if (!config.openproject?.baseUrl) { showToast('서버 URL을 먼저 입력하세요', 'warning'); return; }
  showToast('연결 확인 중…', 'info');
  try {
    const r = await fetch('/op-proxy?path=/api/v3');
    if (r.ok) showToast('OpenProject 연결 성공!', 'success');
    else showToast(`연결 실패: HTTP ${r.status}`, 'error');
  } catch { showToast('서버에 연결할 수 없습니다', 'error'); }
}

function toggleSettingsPanel() {
  const el = document.getElementById('settings-panel');
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) document.getElementById('email-panel').classList.add('hidden');
}
