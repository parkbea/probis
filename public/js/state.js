// 전역 상태
let projects = [];
let members  = [];
let personal = [];
let config   = { openproject: { baseUrl: '', apiKey: '' } };

let draggedId        = null;
let currentView      = 'kanban';

// 간트·캘린더 타입 필터 (true = 표시)
let ganttTypeFilter  = { 'RFI': true, 'RFP': true, '실행중인 프로젝트': true };
let calTypeFilter    = { 'RFI': true, 'RFP': true, '실행중인 프로젝트': true };
let calPersonalShow  = true;
let calYear          = new Date().getFullYear();
let calMonth         = new Date().getMonth();

// 모달 임시 상태
let currentProjectId  = null;
let currentMemberId   = null;
let currentPersonalId = null;
let modalAssignments  = [];
