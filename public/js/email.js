function toggleEmailPanel() {
  const panel  = document.getElementById('email-panel');
  const isOpen = !panel.classList.contains('hidden');
  if (isOpen) {
    panel.classList.add('hidden');
    document.body.style.overflow = '';
  } else {
    document.getElementById('settings-panel').classList.add('hidden');
    panel.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

// OpenProject URL 추출 (최대 3개)
// /project/ /projects/ /work_package/ /work_packages/ 모두 인식
function extractOpUrls(text) {
  const re = /https?:\/\/[^\s<>\n]+\/(?:work_packages?|projects?)\/[a-zA-Z0-9_\-%]+/g;
  return [...new Set(text.match(re) || [])].slice(0, 3);
}

function analyzeEmail(text) {
  const r = {
    name:'', client:'', summary:'',
    startDate:'', endDate:'',
    effort:'', effortUnit:'MM',
    type:'RFI', status:'대기',
    opUrls: [],   // [epic, 공수, QA] 순서
  };

  if (/RFP|제안\s*요청/i.test(text))          r.type   = 'RFP';
  else if (/착수|수주|계약\s*체결/i.test(text)) r.type   = '실행중인 프로젝트';
  if (/진행\s*중|착수|실행\s*중/i.test(text))   r.status = '진행중';

  for (const pat of [
    /(?:프로젝트명|과제명|건명|제목)\s*[:：]\s*(.+?)(?:\n|$)/i,
    /(?:Subject)\s*[:：]\s*(?:re:\s*|fw:\s*)?(.+?)(?:\n|$)/i,
  ]) {
    const m = text.match(pat);
    if (m?.[1]?.trim().length > 2) { r.name = m[1].trim(); break; }
  }
  for (const pat of [
    /(?:고객사|발주처|의뢰처)\s*[:：]\s*(.+?)(?:\n|$)/i,
    /([\w가-힣]+(?:주식회사|\(주\)|㈜))/,
  ]) {
    const m = text.match(pat);
    if (m?.[1]?.trim().length > 1) { r.client = m[1].trim(); break; }
  }

  const dates = [];
  ['(\\d{4})[./\\-](\\d{1,2})[./\\-](\\d{1,2})', '(\\d{4})년\\s*(\\d{1,2})월\\s*(\\d{1,2})일'].forEach(rx => {
    const re = new RegExp(rx, 'g'); let m;
    while ((m = re.exec(text)) !== null) {
      const y=+m[1], mo=+m[2], d=+m[3];
      if (y>=2020 && y<=2035 && mo>=1 && mo<=12 && d>=1 && d<=31)
        dates.push(`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
    }
  });
  r.startDate = dates[0] || '';
  r.endDate   = dates.length > 1 ? dates[dates.length-1] : '';

  const mMD = text.match(/(\d+(?:\.\d+)?)\s*(?:M[./]?D|man[\s-]?day|인일)/i);
  const mMM = text.match(/(\d+(?:\.\d+)?)\s*(?:M[./]?M|man[\s-]?month|인월)/i);
  if (mMD)      { r.effort = mMD[1]; r.effortUnit = 'MD'; }
  else if (mMM) { r.effort = mMM[1]; r.effortUnit = 'MM'; }

  r.summary = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20 && !/^[>※\-*]/.test(l) && !/^(보낸|받는|from|to|subject|cc|re:|fw:)/i.test(l))
    .slice(0, 3).join(' ').slice(0, 300);

  r.opUrls = extractOpUrls(text);
  return r;
}

function analyzeAndPreview() {
  try {
  const text = document.getElementById('email-text').value.trim();
  if (!text) { showToast('이메일을 입력하세요', 'warning'); return; }
  const r = analyzeEmail(text);

  // type / status 는 항상 분석 결과 적용 (기본값이 의미 있음)
  document.getElementById('ep-type').value   = r.type;
  document.getElementById('ep-status').value = r.status;
  // 나머지는 분석에서 값을 찾았을 때만 덮어씀 (빈 값으로 기존 내용 지우지 않음)
  if (r.name)       document.getElementById('ep-name').value   = r.name;
  if (r.startDate)  document.getElementById('ep-start').value  = r.startDate;
  if (r.endDate)    document.getElementById('ep-end').value    = r.endDate;
  if (r.effort)     document.getElementById('ep-effort').value = r.effort;
  if (r.effortUnit) document.getElementById('ep-unit').value   = r.effortUnit;

  // Epic URL (첫 번째)
  const [url1='', url2='', url3=''] = r.opUrls;
  const opRow = document.getElementById('ep-op-row');
  if (url1) {
    document.getElementById('ep-opurl').value  = url1;
    const row2 = document.getElementById('ep-op-row2');
    const row3 = document.getElementById('ep-op-row3');
    if (url2) { document.getElementById('ep-opurl2').value = url2; row2.classList.remove('hidden'); row2.classList.add('flex'); }
    else       { row2.classList.add('hidden'); row2.classList.remove('flex'); }
    if (url3) { document.getElementById('ep-opurl3').value = url3; row3.classList.remove('hidden'); row3.classList.add('flex'); }
    else       { row3.classList.add('hidden'); row3.classList.remove('flex'); }
    opRow.classList.remove('hidden'); opRow.classList.add('flex');
  } else {
    opRow.classList.add('hidden'); opRow.classList.remove('flex');
  }

  // 중복 체크: 첫 번째 URL이 기존 프로젝트의 opEpicUrl과 동일한지
  const dupWarn = document.getElementById('ep-dup-warn');
  const regBtn  = document.getElementById('ep-reg-btn');
  const dupProj = url1 ? projects.find(p => p.opEpicUrl && p.opEpicUrl === url1) : null;

  if (dupProj) {
    document.getElementById('ep-dup-name').textContent = dupProj.name;
    dupWarn.classList.remove('hidden'); dupWarn.classList.add('flex');
    regBtn.disabled = true;
    regBtn.classList.add('opacity-40', 'cursor-not-allowed');
    regBtn.classList.remove('hover:bg-emerald-500');
  } else {
    dupWarn.classList.add('hidden'); dupWarn.classList.remove('flex');
    regBtn.disabled = false;
    regBtn.classList.remove('opacity-40', 'cursor-not-allowed');
    regBtn.classList.add('hover:bg-emerald-500');
  }

  document.getElementById('email-preview').classList.remove('hidden');

  const urlCount = r.opUrls.length;
  const msg = urlCount > 0
    ? `분석 완료! — OpenProject URL ${urlCount}개 감지` + (dupProj ? ' ⚠ 중복' : '')
    : '분석 완료!';
  showToast(msg, dupProj ? 'warning' : 'success');

  } catch (e) {
    showToast('분석 오류: ' + e.message, 'error');
    console.error('[analyzeAndPreview]', e);
  }
}

function registerFromEmail() {
  const regBtn = document.getElementById('ep-reg-btn');
  if (regBtn.disabled) return;

  const name = document.getElementById('ep-name').value.trim();
  if (!name) { showToast('프로젝트명 필수', 'error'); return; }

  const emailContent = document.getElementById('email-text').value.trim();

  projects.push({
    id:           uid(),
    type:         document.getElementById('ep-type').value,
    name,
    startDate:    document.getElementById('ep-start').value,
    endDate:      document.getElementById('ep-end').value,
    effort:       parseFloat(document.getElementById('ep-effort').value) || 0,
    effortUnit:   document.getElementById('ep-unit').value,
    status:       document.getElementById('ep-status').value,
    emailContent,
    opEpicUrl:    document.getElementById('ep-opurl').value.trim(),
    opEffortUrl:  document.getElementById('ep-opurl2').value.trim(),
    opQaUrl:      document.getElementById('ep-opurl3').value.trim(),
    assignments:  [],
    createdAt:    now(),
    updatedAt:    now(),
  });
  saveProjects(); renderAll();
  showToast(`"${name}" 등록됨`, 'success');

  document.getElementById('email-text').value = '';
  document.getElementById('email-preview').classList.add('hidden');
  document.getElementById('email-panel').classList.add('hidden');
  document.body.style.overflow = '';
}
