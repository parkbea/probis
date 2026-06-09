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

// ── 주간보고 PPTX 생성 (Node.js 내장 zlib만 사용) ────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++)
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZip(fileMap) {
  const zlib = require('zlib');
  const localBufs = [], entries = [];
  let offset = 0;
  for (const [name, content] of Object.entries(fileMap)) {
    const nb   = Buffer.from(name, 'utf-8');
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf-8');
    const comp = zlib.deflateRawSync(data);
    const crc  = crc32(data);
    const hdr  = Buffer.alloc(30 + nb.length);
    hdr.writeUInt32LE(0x04034b50, 0); hdr.writeUInt16LE(20, 4);
    hdr.writeUInt16LE(0, 6);          hdr.writeUInt16LE(8, 8);
    hdr.writeUInt16LE(0, 10);         hdr.writeUInt16LE(0, 12);
    hdr.writeUInt32LE(crc, 14);       hdr.writeUInt32LE(comp.length, 18);
    hdr.writeUInt32LE(data.length, 22); hdr.writeUInt16LE(nb.length, 26);
    hdr.writeUInt16LE(0, 28);         nb.copy(hdr, 30);
    localBufs.push(hdr, comp);
    entries.push({ nb, crc, cs: comp.length, us: data.length, off: offset });
    offset += hdr.length + comp.length;
  }
  const cdBufs = []; let cdSize = 0;
  for (const e of entries) {
    const cd = Buffer.alloc(46 + e.nb.length);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4);  cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);          cd.writeUInt16LE(8, 10);  cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);         cd.writeUInt32LE(e.crc, 16);
    cd.writeUInt32LE(e.cs, 20);      cd.writeUInt32LE(e.us, 24);
    cd.writeUInt16LE(e.nb.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);         cd.writeUInt16LE(0, 36);  cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(e.off, 42);     e.nb.copy(cd, 46);
    cdBufs.push(cd); cdSize += cd.length;
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4);  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);    eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localBufs, ...cdBufs, eocd]);
}

function buildPptx(from, to, nextFrom, nextTo, rows) {
  const ex = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                               .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const SW = 12192000, SH = 6858000;

  const rpr = (c='FFFFFF',sz=1200,b=false) =>
    `<a:rPr lang="ko-KR" sz="${sz}"${b?' b="1"':''} dirty="0"><a:solidFill><a:srgbClr val="${c}"/></a:solidFill><a:latin typeface="맑은 고딕"/></a:rPr>`;

  const paras = (txt,c='FFFFFF',sz=1200,b=false,al='l') =>
    String(txt||'').split('\n').map(l=>
      `<a:p><a:pPr algn="${al}"/><a:r>${rpr(c,sz,b)}<a:t>${ex(l)}</a:t></a:r></a:p>`).join('') || '<a:p/>';

  const txb = (txt,c='FFFFFF',sz=1200,b=false,al='l',wr='square') =>
    `<p:txBody><a:bodyPr wrap="${wr}" rtlCol="0"/><a:lstStyle/>${paras(txt,c,sz,b,al)}</p:txBody>`;

  const sp = (id,nm,ox,oy,cx,cy,fi,txt='',sz=1200,b=false,c='FFFFFF',al='l',wr='square') => {
    const fill = fi ? `<a:solidFill><a:srgbClr val="${fi}"/></a:solidFill>` : '<a:noFill/>';
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${ex(nm)}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${ox}" y="${oy}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}<a:ln><a:noFill/></a:ln></p:spPr>${txb(txt,c,sz,b,al,wr)}</p:sp>`;
  };

  const tc = (txt,fi,c='1E293B',sz=850,b=false,al='l') => {
    const fill = fi ? `<a:solidFill><a:srgbClr val="${fi}"/></a:solidFill>` : '<a:noFill/>';
    const bdr  = ['lnL','lnR','lnT','lnB'].map(s=>`<a:${s} w="9525"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:${s}>`).join('');
    return `<a:tc><a:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${paras(txt,c,sz,b,al)}</a:txBody><a:tcPr marL="91440" marR="91440" marT="45720" marB="45720">${fill}${bdr}</a:tcPr></a:tc>`;
  };

  const tblXml = (ox,oy,cx,cy,cws,hdrs,data) => {
    const grid = cws.map(w=>`<a:gridCol w="${w}"/>`).join('');
    const hh = 411480;
    const rh = Math.max(330000, Math.min(914400, Math.floor((cy-hh)/Math.max(data.length,1))));
    const hRow = `<a:tr h="${hh}">${hdrs.map(h=>tc(h,'1E293B','FFFFFF',1000,true)).join('')}</a:tr>`;
    const dRows = data.map((vs,i)=>`<a:tr h="${rh}">${vs.map((v,ci)=>tc(v,i%2===0?'F0FDFA':'FFFFFF','1E293B',850,ci===0)).join('')}</a:tr>`).join('');
    return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="10" name="Table"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${ox}" y="${oy}"/><a:ext cx="${cx}" cy="${cy}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr/><a:tblGrid>${grid}</a:tblGrid>${hRow}${dRows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  };

  const sld = c => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SW}" cy="${SH}"/><a:chOff x="0" y="0"/><a:chExt cx="${SW}" cy="${SH}"/></a:xfrm></p:grpSpPr>${c}</p:spTree></p:cSld><p:clrMapOvr><a:masterClr/></p:clrMapOvr></p:sld>`;

  const mmdd = s => { const p=String(s||'').split('-'); return p.length>=3?`${p[1]}/${p[2]}`:s; };
  const ymd  = s => String(s||'').replace(/-/g,'/');

  const mg=274638,tx=mg,ty=182880,tcx=SW-mg*2,tcy=SH-ty-182880;
  const pcts=[145,220,220,105,80,80,150];
  const cws=pcts.map(p=>Math.floor(tcx*p/1000));
  cws[6]+=tcx-cws.reduce((a,b)=>a+b,0);
  const hdrs=['프로젝트명',
    `금주 내용\n(${mmdd(from)} ~ ${mmdd(to)})`,
    `차주 진행 내용\n(${mmdd(nextFrom)} ~ ${mmdd(nextTo)})`,
    '담당자','시작일','종료일','비고'];
  const data=(rows&&rows.length)?rows.map(r=>[r.name||'',r.thisWeek||'',r.nextWeek||'',
    r.assignees||'',ymd(r.startDate||''),ymd(r.endDate||''),r.note||'']):
    [['(데이터 없음)','','','','','','']];
  const s1 = tblXml(tx,ty,tcx,tcy,cws,hdrs,data);

  const sRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  const mRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`;
  const lRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`;

  return buildZip({
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="${SW}" cy="${SH}" type="custom"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`,
    'ppt/theme/theme1.xml': `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="koFlow"><a:themeElements><a:clrScheme name="koFlow"><a:dk1><a:srgbClr val="1E293B"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2><a:accent1><a:srgbClr val="6366F1"/></a:accent1><a:accent2><a:srgbClr val="0D9488"/></a:accent2><a:accent3><a:srgbClr val="3B82F6"/></a:accent3><a:accent4><a:srgbClr val="F59E0B"/></a:accent4><a:accent5><a:srgbClr val="10B981"/></a:accent5><a:accent6><a:srgbClr val="EF4444"/></a:accent6><a:hlink><a:srgbClr val="6366F1"/></a:hlink><a:folHlink><a:srgbClr val="4338CA"/></a:folHlink></a:clrScheme><a:fontScheme name="koFlow"><a:majorFont><a:latin typeface="맑은 고딕"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="맑은 고딕"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="koFlow"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`,
    'ppt/slideMasters/slideMaster1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SW}" cy="${SH}"/><a:chOff x="0" y="0"/><a:chExt cx="${SW}" cy="${SH}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId2"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr lang="ko-KR"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr lang="ko-KR"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:defPPr><a:defRPr lang="ko-KR"/></a:defPPr></p:otherStyle></p:txStyles></p:sldMaster>`,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': mRels,
    'ppt/slideLayouts/slideLayout1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SW}" cy="${SH}"/><a:chOff x="0" y="0"/><a:chExt cx="${SW}" cy="${SH}"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClr/></p:clrMapOvr></p:sldLayout>`,
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': lRels,
    'ppt/slides/slide1.xml':            sld(s1),
    'ppt/slides/_rels/slide1.xml.rels': sRels,
    'ppt/presProps.xml':   `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presProps xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:showPr/></p:presProps>`,
    'ppt/tableStyles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`,
  });
}

function handleWeeklyReport(req, res) {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    try {
      const { from = '', to = '', nextFrom = '', nextTo = '', rows = [] } = JSON.parse(body);
      const pptBuf = buildPptx(from, to, nextFrom, nextTo, rows);
      res.writeHead(200, {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename="weekly_report.pptx"',
        'Content-Length':      pptBuf.length,
      });
      res.end(pptBuf);
    } catch(e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
  });
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

  // ── 주간보고 ────────────────────────────────
  if (pathname === '/weekly-report' && req.method === 'POST') {
    handleWeeklyReport(req, res); return;
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
