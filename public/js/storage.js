async function loadFromFiles() {
  const results = await Promise.allSettled([
    fetch('data/projects.json').then(r => r.ok ? r.json() : Promise.reject()),
    fetch('data/members.json').then(r => r.ok ? r.json() : Promise.reject()),
    fetch('data/personal_calendar.json').then(r => r.ok ? r.json() : Promise.reject()),
  ]);
  let loaded = false;
  if (results[0].status === 'fulfilled') { const d = results[0].value; if (Array.isArray(d.projects))            { projects = d.projects;                        loaded = true; } }
  if (results[1].status === 'fulfilled') { const d = results[1].value; if (Array.isArray(d.members))             { members  = d.members;                         loaded = true; } }
  if (results[2].status === 'fulfilled') { const d = results[2].value; const evs = d.personalEvents||d.events||[]; if (Array.isArray(evs)) { personal = evs;    loaded = true; } }
  return loaded;
}

function saveProjects() {
  fetch('data/projects.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: '1.0', exported: now(), projects }, null, 2),
  }).catch(() => {});
}
function saveMembers() {
  fetch('data/members.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: '1.0', exported: now(), members }, null, 2),
  }).catch(() => {});
}
function savePersonal() {
  fetch('data/personal_calendar.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: '1.0', exported: now(), personalEvents: personal }, null, 2),
  }).catch(() => {});
}
