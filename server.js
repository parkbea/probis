const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT   = 8080;
const ROOT   = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA   = path.join(ROOT, 'data');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json; charset=utf-8',
};

// ── OpenProject API 호출 헬퍼 ────────────────────────────────
function opRequest(apiPath, baseUrl, apiKey) {
  return new Promise((resolve, reject) => {
    const url   = baseUrl.replace(/\/$/, '') + apiPath;
    const proto = require(url.startsWith('https') ? 'https' : 'http');
    const auth  = 'Basic ' + Buffer.from(`apikey:${apiKey}`).toString('base64');
    proto.get(url, { headers: { Authorization: auth, Accept: 'application/json' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error('JSON 파싱 실패: ' + data.slice(0, 100))); }
      });
    }).on('error', reject);
  });
}

// ── OP 동기화 핸들러 (async) ─────────────────────────────────
// OP는 조회 전용. 팀원의 opUserId를 기반으로 멤버로 있는 프로젝트 목록만 가져옴.
async function handleOpSync(req, res) {
  let cfg, membersData;
  try {
    cfg         = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'),  'utf-8'));
    membersData = JSON.parse(fs.readFileSync(path.join(DATA, 'members.json'), 'utf-8'));
  } catch (e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'config.json 또는 members.json 읽기 실패' }));
    return;
  }

  const { baseUrl, apiKey } = cfg.openproject || {};
  if (!baseUrl || !apiKey) {
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'OpenProject 설정(URL/API 키)이 필요합니다' }));
    return;
  }

  // opUserId가 등록된 팀원만 사용
  const members = membersData.members || [];
  const opUsers = members
    .filter(m => m.opUserId)
    .map(m => ({ name: m.name, opId: String(m.opUserId) }));

  if (opUsers.length === 0) {
    res.writeHead(400);
    res.end(JSON.stringify({
      error: '팀원 관리에서 OpenProject 사용자 ID를 먼저 입력해주세요.',
    }));
    return;
  }

  // 해당 사용자들이 멤버로 있는 프로젝트 조회 (조회 전용)
  const userIds    = opUsers.map(u => u.opId);
  const filter     = encodeURIComponent(JSON.stringify([{ member: { operator: '=', values: userIds } }]));
  const projResult = await opRequest(`/api/v3/projects?filters=${filter}&pageSize=200`, baseUrl, apiKey);

  if (projResult.status !== 200) {
    res.writeHead(projResult.status);
    res.end(JSON.stringify({ error: projResult.body.message || 'OpenProject 프로젝트 조회 실패' }));
    return;
  }

  const opProjects = projResult.body._embedded?.elements || [];
  const nowIso     = new Date().toISOString();

  const mapped = opProjects.map(p => ({
    id:          'op_' + p.id,
    type:        '실행중인 프로젝트',
    name:        p.name,
    startDate:   p.startDate || '',
    endDate:     p.dueDate   || '',
    status:      (p.status?.name || '').toLowerCase().includes('finish') ? '완료' : '진행중',
    effort:      0,
    effortUnit:  'MM',
    opEpicUrl:   baseUrl.replace(/\/$/, '') + '/projects/' + p.identifier,
    opEffortUrl: '',
    opQaUrl:     '',
    emailContent:'',
    assignments: [],
    createdAt:   p.createdAt || nowIso,
    updatedAt:   nowIso,
  }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    projects: mapped,
    opUsers,
    message:  `${opUsers.length}명 기준 프로젝트 ${mapped.length}개 조회됨`,
  }));
}

// ── HTTP 서버 ────────────────────────────────────────────────
http.createServer((req, res) => {
  const parsed   = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(parsed.pathname);

  // ── OpenProject 동기화 ──────────────────────
  if (pathname === '/op-sync') {
    handleOpSync(req, res).catch(e => {
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
    return;
  }

  // ── OpenProject 프록시 ──────────────────────
  if (pathname === '/op-proxy') {
    const targetPath = parsed.searchParams.get('path');
    if (!targetPath) { res.writeHead(400); res.end('{"error":"missing path"}'); return; }

    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf-8')); }
    catch { res.writeHead(500); res.end('{"error":"data/config.json 없음"}'); return; }

    const { baseUrl, apiKey } = (cfg.openproject || {});
    if (!baseUrl) { res.writeHead(400); res.end('{"error":"OpenProject URL 미설정"}'); return; }

    const targetUrl = baseUrl.replace(/\/$/, '') + targetPath;
    const proto = require(targetUrl.startsWith('https') ? 'https' : 'http');
    const auth  = 'Basic ' + Buffer.from(`apikey:${apiKey || ''}`).toString('base64');

    proto.get(targetUrl, { headers: { Authorization: auth, Accept: 'application/json' } }, opRes => {
      let data = '';
      opRes.on('data', c => data += c);
      opRes.on('end', () => {
        res.writeHead(opRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(data);
      });
    }).on('error', e => { res.writeHead(502); res.end(JSON.stringify({ error: String(e) })); });
    return;
  }

  // ── data/ 경로: JSON 읽기/쓰기 ──────────────
  if (pathname.startsWith('/data/')) {
    const fileName = path.basename(pathname);
    const filePath = path.join(DATA, fileName);

    if (!filePath.startsWith(DATA) || !fileName.endsWith('.json')) {
      res.writeHead(403); res.end(); return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          JSON.parse(body);
          fs.writeFileSync(filePath, body, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        } catch (e) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  // ── public/ 정적 파일 ───────────────────────
  const relPath  = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(PUBLIC, relPath);

  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); res.end(); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });

}).listen(PORT, '127.0.0.1', () => {
  console.log(`koFlow 서버 실행 중: http://localhost:${PORT}`);
});
