// ── 프로젝트 모달 ─────────────────────────────
function refreshMemberPicker() {
  const sel = document.getElementById('member-pick');
  sel.innerHTML = '<option value="">-- 팀원 선택 --</option>';
  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.name} (${m.role||'역할없음'})`;
    sel.appendChild(opt);
  });
}
function openCreateModal() {
  currentProjectId = null; modalAssignments = [];
  document.getElementById('project-modal-title').textContent = '새 프로젝트 등록';
  ['m-type','m-status','m-name','m-start','m-end','m-effort','m-unit','m-email','m-epic-url','m-effort-url','m-qa-url'].forEach(id => {
    const el = document.getElementById(id);
    if (el.tagName === 'SELECT') el.selectedIndex = 0; else el.value = '';
  });
  document.getElementById('m-type').value   = 'RFI';
  document.getElementById('m-status').value = '대기';
  document.getElementById('m-unit').value   = 'MM';
  document.getElementById('m-meta').classList.add('hidden');
  const btn = document.getElementById('btn-delete'); btn.classList.add('hidden'); btn.style.display = '';
  refreshMemberPicker(); renderAssignments();
  showModalEl('project-modal');
}
function openEditModal(id) {
  const p = projects.find(x => x.id === id); if (!p) return;
  currentProjectId = id; modalAssignments = (p.assignments||[]).map(a => ({...a}));
  document.getElementById('project-modal-title').textContent = '프로젝트 편집';
  document.getElementById('m-type').value       = p.type;
  document.getElementById('m-status').value     = p.status;
  document.getElementById('m-name').value       = p.name;
  document.getElementById('m-start').value      = p.startDate||'';
  document.getElementById('m-end').value        = p.endDate||'';
  document.getElementById('m-effort').value     = p.effort||'';
  document.getElementById('m-unit').value       = p.effortUnit||'MM';
  document.getElementById('m-email').value      = p.emailContent||'';
  document.getElementById('m-epic-url').value   = p.opEpicUrl||'';
  document.getElementById('m-effort-url').value = p.opEffortUrl||'';
  document.getElementById('m-qa-url').value     = p.opQaUrl||'';
  document.getElementById('m-created').textContent = fmtDate(p.createdAt);
  document.getElementById('m-updated').textContent = fmtDate(p.updatedAt);
  document.getElementById('m-meta').classList.remove('hidden');
  const btn = document.getElementById('btn-delete'); btn.classList.remove('hidden'); btn.style.display = 'inline-flex';
  refreshMemberPicker(); renderAssignments();
  showModalEl('project-modal');
}
function saveProjectModal() {
  const name = document.getElementById('m-name').value.trim();
  if (!name) { showToast('프로젝트명은 필수입니다', 'error'); return; }
  const d = {
    type:         document.getElementById('m-type').value,   name,
    startDate:    document.getElementById('m-start').value,
    endDate:      document.getElementById('m-end').value,
    effort:       parseFloat(document.getElementById('m-effort').value) || 0,
    effortUnit:   document.getElementById('m-unit').value,
    status:       document.getElementById('m-status').value,
    emailContent: document.getElementById('m-email').value.trim(),
    opEpicUrl:    document.getElementById('m-epic-url').value.trim(),
    opEffortUrl:  document.getElementById('m-effort-url').value.trim(),
    opQaUrl:      document.getElementById('m-qa-url').value.trim(),
    assignments:  modalAssignments,
  };
  if (currentProjectId) {
    const p = projects.find(x => x.id === currentProjectId);
    Object.assign(p, d, { updatedAt: now() });
  } else {
    projects.push({ id:uid(), ...d, createdAt:now(), updatedAt:now() });
  }
  saveProjects(); renderAll(); closeModal('project');
  showToast(currentProjectId ? '수정됨' : '등록됨', 'success');
}
function deleteCurrentProject() {
  if (!currentProjectId) return;
  const p = projects.find(x => x.id === currentProjectId);
  if (p && confirm(`"${p.name}" 삭제하시겠습니까?`)) {
    projects = projects.filter(x => x.id !== currentProjectId);
    saveProjects(); renderAll(); closeModal('project'); showToast('삭제됨', 'info');
  }
}

// ── 팀원 배정 ─────────────────────────────────
function addAssignment() {
  const sel = document.getElementById('member-pick');
  const mid = sel.value; if (!mid) return;
  const m = members.find(x => x.id === mid); if (!m) return;
  if (modalAssignments.find(a => a.memberId === mid)) { showToast('이미 배정된 팀원입니다', 'warning'); return; }
  modalAssignments.push({ id:uid(), memberId:mid, name:m.name, role:m.role||'', effort:1, effortUnit:'MM' });
  renderAssignments();
}
function addCustomAssignment() {
  const name = prompt('이름:'); if (!name || !name.trim()) return;
  const role = prompt('역할:', '') || '';
  modalAssignments.push({ id:uid(), memberId:null, name:name.trim(), role, effort:1, effortUnit:'MM' });
  renderAssignments();
}
function removeAssignment(aid)  { modalAssignments = modalAssignments.filter(a => a.id !== aid); renderAssignments(); }
function updateAssign(aid, field, val) {
  const a = modalAssignments.find(x => x.id === aid);
  if (a) a[field] = field === 'effort' ? parseFloat(val)||0 : val;
  updateAssignTotal();
}
function updateAssignTotal() {
  const total = modalAssignments.reduce((s,a) => s + (a.effortUnit==='MD' ? a.effort/20 : a.effort), 0);
  document.getElementById('modal-assign-total').textContent = total.toFixed(1) + ' MM';
}
function renderAssignments() {
  const el = document.getElementById('modal-assignments');
  if (!modalAssignments.length) { el.innerHTML = `<p class="text-xs text-slate-300 text-center py-4">배정된 팀원이 없습니다</p>`; updateAssignTotal(); return; }
  el.innerHTML = modalAssignments.map(a => `
    <div class="flex items-center gap-2 px-3 py-2">
      <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">${esc(a.name.slice(0,1))}</span>
      <input type="text" value="${esc(a.name)}" placeholder="이름" onchange="updateAssign('${a.id}','name',this.value)"
        class="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
      <input type="text" value="${esc(a.role)}" placeholder="역할" onchange="updateAssign('${a.id}','role',this.value)"
        class="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
      <input type="number" value="${a.effort}" step="0.5" min="0" onchange="updateAssign('${a.id}','effort',this.value)"
        class="w-14 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400">
      <select onchange="updateAssign('${a.id}','effortUnit',this.value)" class="px-1 py-1 border border-slate-200 rounded text-xs bg-white focus:outline-none">
        <option ${a.effortUnit==='MM'?'selected':''}>MM</option><option ${a.effortUnit==='MD'?'selected':''}>MD</option>
      </select>
      <button onclick="removeAssignment('${a.id}')" class="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
  updateAssignTotal();
}

// ── 팀원 모달 ─────────────────────────────────
function openMemberModal() {
  currentMemberId = null;
  document.getElementById('member-modal-title').textContent = '팀원 추가';
  ['mm-name','mm-role','mm-team','mm-email','mm-op-user-id','mm-memo'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mm-capacity').value = '1';
  const btn = document.getElementById('mm-delete'); btn.classList.add('hidden'); btn.style.display = '';
  showModalEl('member-modal');
}
function openMemberEdit(id) {
  const m = members.find(x => x.id === id); if (!m) return;
  currentMemberId = id;
  document.getElementById('member-modal-title').textContent = '팀원 편집';
  document.getElementById('mm-name').value        = m.name||'';
  document.getElementById('mm-role').value        = m.role||'';
  document.getElementById('mm-team').value        = m.team||'';
  document.getElementById('mm-email').value       = m.email||'';
  document.getElementById('mm-capacity').value    = m.capacity||1;
  document.getElementById('mm-op-user-id').value  = m.opUserId||'';
  document.getElementById('mm-memo').value        = m.memo||'';
  const btn = document.getElementById('mm-delete'); btn.classList.remove('hidden'); btn.style.display = 'inline-flex';
  showModalEl('member-modal');
}
function saveMemberModal() {
  const name = document.getElementById('mm-name').value.trim();
  if (!name) { showToast('이름은 필수입니다', 'error'); return; }
  const d = {
    name,
    role:      document.getElementById('mm-role').value.trim(),
    team:      document.getElementById('mm-team').value.trim(),
    email:     document.getElementById('mm-email').value.trim(),
    capacity:  parseFloat(document.getElementById('mm-capacity').value) || 1,
    opUserId:  document.getElementById('mm-op-user-id').value.trim(),
    memo:      document.getElementById('mm-memo').value.trim(),
  };
  if (currentMemberId) { const m = members.find(x => x.id === currentMemberId); Object.assign(m, d); }
  else { members.push({ id:uid(), ...d }); }
  saveMembers(); renderAll(); closeModal('member');
  showToast(currentMemberId ? '팀원 수정됨' : '팀원 추가됨', 'success');
}
function deleteCurrentMember() {
  if (!currentMemberId) return;
  const m = members.find(x => x.id === currentMemberId);
  if (m && confirm(`"${m.name}" 팀원을 삭제하시겠습니까?`)) {
    members = members.filter(x => x.id !== currentMemberId);
    saveMembers(); renderAll(); closeModal('member'); showToast('팀원 삭제됨', 'info');
  }
}
function deleteMember(id) {
  const m = members.find(x => x.id === id);
  if (m && confirm(`"${m.name}" 팀원을 삭제하시겠습니까?`)) {
    members = members.filter(x => x.id !== id);
    saveMembers(); renderTeam(); showToast('삭제됨', 'info');
  }
}

// ── 개인 일정 모달 ────────────────────────────
function openPersonalEventModal(dateStr) {
  currentPersonalId = null;
  document.getElementById('personal-modal-title').textContent = '개인 일정 추가';
  document.getElementById('pe-title').value = '';
  document.getElementById('pe-type').value  = '개인';
  document.getElementById('pe-color').value = '#ec4899';
  document.getElementById('pe-start').value = dateStr||'';
  document.getElementById('pe-end').value   = dateStr||'';
  document.getElementById('pe-memo').value  = '';
  const btn = document.getElementById('pe-delete'); btn.classList.add('hidden'); btn.style.display = '';
  showModalEl('personal-modal');
}
function openPersonalEventEdit(id) {
  const ev = personal.find(x => x.id === id); if (!ev) return;
  currentPersonalId = id;
  document.getElementById('personal-modal-title').textContent = '개인 일정 편집';
  document.getElementById('pe-title').value = ev.title||'';
  document.getElementById('pe-type').value  = ev.type||'개인';
  document.getElementById('pe-color').value = ev.color||'#ec4899';
  document.getElementById('pe-start').value = ev.startDate||'';
  document.getElementById('pe-end').value   = ev.endDate||'';
  document.getElementById('pe-memo').value  = ev.memo||'';
  const btn = document.getElementById('pe-delete'); btn.classList.remove('hidden'); btn.style.display = 'inline-flex';
  showModalEl('personal-modal');
}
function savePersonalEventModal() {
  const title = document.getElementById('pe-title').value.trim();
  if (!title) { showToast('제목은 필수입니다', 'error'); return; }
  const startDate = document.getElementById('pe-start').value;
  if (!startDate) { showToast('시작일을 입력하세요', 'error'); return; }
  const d = {
    title, type:  document.getElementById('pe-type').value,
    color:        document.getElementById('pe-color').value,
    startDate,
    endDate:      document.getElementById('pe-end').value || startDate,
    memo:         document.getElementById('pe-memo').value.trim(),
  };
  if (currentPersonalId) { const ev = personal.find(x => x.id === currentPersonalId); Object.assign(ev, d); }
  else { personal.push({ id:uid(), ...d }); }
  savePersonal(); renderCalendar(); closeModal('personal');
  showToast(currentPersonalId ? '일정 수정됨' : '일정 추가됨', 'success');
}
function deleteCurrentPersonalEvent() {
  if (!currentPersonalId) return;
  const ev = personal.find(x => x.id === currentPersonalId);
  if (ev && confirm(`"${ev.title}" 삭제하시겠습니까?`)) {
    personal = personal.filter(x => x.id !== currentPersonalId);
    savePersonal(); renderCalendar(); closeModal('personal'); showToast('삭제됨', 'info');
  }
}
