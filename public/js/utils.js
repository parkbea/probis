const uid = () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
const now = () => new Date().toISOString();

function esc(s) {
  return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : '';
}
function fmtDate(iso) {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' }); }
  catch { return iso; }
}
function fmtShort(d) {
  if (!d) return '미정';
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}
function searchTerm()  { return document.getElementById('search-input').value.toLowerCase(); }
function statusFilter(){ return document.getElementById('status-filter').value; }

function showToast(msg, type = 'info') {
  const colors = { success:'bg-emerald-500', error:'bg-red-500', warning:'bg-amber-500', info:'bg-indigo-500' };
  const el = document.createElement('div');
  el.className = `anim-toast flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm shadow-xl max-w-xs pointer-events-auto ${colors[type] || colors.info}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
function showModalEl(id) { document.getElementById(id).classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeModal(type){ document.getElementById(type + '-modal').classList.add('hidden'); document.body.style.overflow = ''; }
