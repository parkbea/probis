import http.server, json, os, base64
from urllib import request as ureq
from urllib.parse import urlparse, parse_qs, quote

PORT   = 8080
ROOT   = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, 'public')
DATA   = os.path.join(ROOT, 'data')

def op_call(api_path, base_url, api_key):
    url  = base_url.rstrip('/') + api_path
    auth = base64.b64encode(f'apikey:{api_key}'.encode()).decode()
    req  = ureq.Request(url, headers={'Authorization': f'Basic {auth}', 'Accept': 'application/json'})
    with ureq.urlopen(req, timeout=15) as resp:
        return resp.status, json.loads(resp.read())

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        # ── OpenProject 동기화 ──────────────────
        if parsed.path == '/op-sync':
            self._handle_op_sync(); return

        # ── OpenProject 프록시 ──────────────────
        if parsed.path == '/op-proxy':
            qs          = parse_qs(parsed.query)
            target_path = qs.get('path', [''])[0]
            if not target_path:
                self.send_error(400, 'missing path'); return
            try:
                with open(os.path.join(DATA, 'config.json'), 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
            except Exception:
                self.send_error(500, 'data/config.json 없음'); return
            op       = cfg.get('openproject', {})
            base_url = op.get('baseUrl', '').rstrip('/')
            api_key  = op.get('apiKey', '')
            if not base_url:
                self.send_error(400, 'OpenProject URL 미설정'); return
            try:
                status, body = op_call(target_path, base_url, api_key)
                data = json.dumps(body).encode()
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_error(502, str(e))
            return

        # ── data/ JSON 읽기 ─────────────────────
        if parsed.path.startswith('/data/'):
            fname = os.path.basename(parsed.path)
            if not fname.endswith('.json'):
                self.send_error(403); return
            fpath = os.path.join(DATA, fname)
            try:
                with open(fpath, 'rb') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(data)
            except FileNotFoundError:
                self.send_error(404)
            return

        super().do_GET()

    def _handle_op_sync(self):
        try:
            with open(os.path.join(DATA, 'config.json'),  'r', encoding='utf-8') as f:
                cfg = json.load(f)
            with open(os.path.join(DATA, 'members.json'), 'r', encoding='utf-8') as f:
                members_data = json.load(f)
        except Exception as e:
            self._json_response(500, {'error': f'파일 읽기 실패: {e}'}); return

        op       = cfg.get('openproject', {})
        base_url = op.get('baseUrl', '').rstrip('/')
        api_key  = op.get('apiKey', '')
        if not base_url or not api_key:
            self._json_response(400, {'error': 'OpenProject 설정(URL/API 키)이 필요합니다'}); return

        # opUserId가 등록된 팀원만 사용 (조회 전용)
        members  = members_data.get('members', [])
        op_users = [
            {'name': m.get('name', ''), 'opId': str(m['opUserId'])}
            for m in members if m.get('opUserId')
        ]

        if not op_users:
            self._json_response(400, {
                'error': '팀원 관리에서 OpenProject 사용자 ID를 먼저 입력해주세요.',
            }); return

        # 2. 해당 사용자들이 멤버인 프로젝트 조회
        user_ids  = [u['opId'] for u in op_users]
        flt       = quote(json.dumps([{'member': {'operator': '=', 'values': user_ids}}]))
        try:
            status, body = op_call(f'/api/v3/projects?filters={flt}&pageSize=200', base_url, api_key)
        except Exception as e:
            self._json_response(502, {'error': f'OpenProject 프로젝트 조회 실패: {e}'}); return

        op_projects = body.get('_embedded', {}).get('elements', [])

        # 3. koFlow 포맷으로 변환
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        mapped = [{
            'id':           'op_' + str(p['id']),
            'type':         '실행중인 프로젝트',
            'name':         p.get('name', ''),
            'startDate':    p.get('startDate') or '',
            'endDate':      p.get('dueDate') or '',
            'status':       '완료' if 'finish' in (p.get('status', {}).get('name') or '').lower() else '진행중',
            'effort':       0,
            'effortUnit':   'MM',
            'opEpicUrl':    f"{base_url}/projects/{p.get('identifier', '')}",
            'opEffortUrl':  '',
            'opQaUrl':      '',
            'emailContent': '',
            'assignments':  [],
            'createdAt':    p.get('createdAt') or now_iso,
            'updatedAt':    now_iso,
        } for p in op_projects]

        self._json_response(200, {
            'projects': mapped,
            'opUsers':  op_users,
            'message':  f'{len(op_users)}명의 팀원이 속한 프로젝트 {len(mapped)}개를 찾았습니다.',
        })

    def _json_response(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith('/data/'):
            self.send_error(403); return
        fname = os.path.basename(parsed.path)
        if not fname.endswith('.json'):
            self.send_error(403); return
        fpath = os.path.join(DATA, fname)
        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length)
        try:
            json.loads(body)
            with open(fpath, 'wb') as f:
                f.write(body)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        except Exception as e:
            self.send_error(400, str(e))

    def log_message(self, fmt, *args):
        pass

if __name__ == '__main__':
    os.chdir(ROOT)
    with http.server.HTTPServer(('127.0.0.1', PORT), Handler) as s:
        print(f'koFlow 서버 실행 중: http://localhost:{PORT}')
        s.serve_forever()
