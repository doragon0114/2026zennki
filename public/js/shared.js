'use strict';

/* ============================================================
   shared.js — 全担当者共通のコア処理
   ─────────────────────────────────────────────────────────────
   ・モックデータ（開発・デモ用サンプル）
   ・状態管理オブジェクト S
   ・localStorage の保存・読み込み（save / load）
   ・共通ユーティリティ（uid, esc, shuffle, getRank …）
   ・SVG アイコン定義（IC, svg, getAvatarHTML）
   ・ナビゲーション（navigate / afterRender）
   ・アプリ起動処理（window.onload）

   ⚠ このファイルは index.html で最初に読み込まれます。
     他のすべての js/*.js はこのファイルの後に読み込んでください。
============================================================ */


/* ============================================================
   モックデータ（開発・デモ用のサンプルデータ）
   実際のサービスではサーバーから取得する想定
============================================================ */

/* アプリ起動時に最初から入っているサンプル問題（8問） */
const SAMPLE_QUESTIONS = [
  { id:'sq001', materialId:'sample', category:'数学', tags:['幾何学','基礎'],
    text:'三角形の内角の和は何度か？',
    choices:['90度','270度','180度','360度'], correct:2,
    explanation:'三角形の3つの角の和は必ず180度になります。四角形は360度です。' },
  { id:'sq002', materialId:'sample', category:'数学', tags:['ルート','近似値'],
    text:'√2 の近似値として最も正しいものはどれか？',
    choices:['1.21','1.33','1.52','1.41'], correct:3,
    explanation:'√2 ≈ 1.41421356…「一夜一夜に人見頃」と覚えましょう。' },
  { id:'sq003', materialId:'sample', category:'英語', tags:['単語'],
    text:'"apple" の意味として正しいものはどれか？',
    choices:['みかん','りんご','バナナ','ぶどう'], correct:1,
    explanation:'"apple" は「りんご」という意味の英単語です。' },
  { id:'sq004', materialId:'sample', category:'歴史', tags:['江戸時代','人物'],
    text:'江戸幕府を開いたのは誰か？',
    choices:['豊臣秀吉','織田信長','武田信玄','徳川家康'], correct:3,
    explanation:'1603年、徳川家康が征夷大将軍となり江戸幕府を開きました。' },
  { id:'sq005', materialId:'sample', category:'理科', tags:['物理','光'],
    text:'光の速さは1秒間に約何万kmか？',
    choices:['1万km','3万km','300万km','30万km'], correct:3,
    explanation:'光の速さは約30万km/s（299,792,458 m/s）です。' },
  { id:'sq006', materialId:'sample', category:'地理', tags:['日本','面積'],
    text:'日本の国土面積として最も近いものはどれか？',
    choices:['約18万km²','約58万km²','約38万km²','約78万km²'], correct:2,
    explanation:'日本の国土面積は約37.8万km²です。世界61位の広さです。' },
  { id:'sq007', materialId:'sample', category:'理科', tags:['生物','人体'],
    text:'人間の体の中で最も大きい臓器はどれか？',
    choices:['心臓','肺','脳','肝臓'], correct:3,
    explanation:'肝臓は体内最大の臓器で重さ約1.2〜1.5kg。解毒・代謝・胆汁生成などの機能があります。' },
  { id:'sq008', materialId:'sample', category:'国語', tags:['文学','明治時代'],
    text:'「吾輩は猫である」の作者は誰か？',
    choices:['芥川龍之介','夏目漱石','太宰治','森鴎外'], correct:1,
    explanation:'「吾輩は猫である」は夏目漱石の処女長編小説（1905〜1906年）です。' },
];

/* サンプル問題集の教材情報 */
const SAMPLE_MATERIAL = {
  id:'sample', name:'サンプル問題集', type:'file', filename:'sample_notes.pdf',
  createdAt: new Date(Date.now()-86400000*3).toISOString(), questionCount:8, shared:true,
};

/* ランキング画面で表示するダミーユーザーデータ */
const MOCK_RANKINGS = [
  { id:'r1', name:'田中 太郎',   avatar:'🐧', points:2850, wins:47 },
  { id:'r2', name:'鈴木 花子',   avatar:'🦊', points:2640, wins:42 },
  { id:'r3', name:'山田 一郎',   avatar:'🐻', points:2410, wins:38 },
  { id:'r4', name:'佐藤 美咲',   avatar:'🐱', points:2180, wins:35 },
  { id:'r5', name:'伊藤 健太',   avatar:'🐼', points:1960, wins:31 },
  { id:'r6', name:'渡辺 さくら', avatar:'🦋', points:1720, wins:27 },
  { id:'r7', name:'小林 大輝',   avatar:'🦁', points:1540, wins:24 },
];

/* 対戦モードで選ばれる相手の候補一覧（accuracy は正解率） */
const BATTLE_OPPONENTS = [
  { name:'田中 太郎',   avatar:'🐧', accuracy:0.85 },
  { name:'鈴木 花子',   avatar:'🦊', accuracy:0.65 },
  { name:'AIペンギン', avatar:'🤖', accuracy:0.50 },
];

/* AI が自動生成したように見せるテンプレート問題
   → 実際のサービスでは upload.js の runAIAnalysis() を AI API に置き換える */
const AI_GENERATED_TEMPLATES = [
  { category:'一般', tags:['AI生成'],
    text:'日本の元号「令和」が始まったのは何年か？',
    choices:['2018年','2019年','2020年','2021年'], correct:1,
    explanation:'令和は2019年5月1日から始まりました。平成31年4月30日をもって平成が終わりました。' },
  { category:'一般', tags:['AI生成'],
    text:'1mol の気体が標準状態で占める体積は約何Lか？',
    choices:['11.2L','22.4L','33.6L','44.8L'], correct:1,
    explanation:'標準状態（0℃・1atm）における1molの気体の体積は約22.4Lです（モル体積）。' },
  { category:'一般', tags:['AI生成'],
    text:'ピタゴラスの定理で正しいものはどれか？（直角三角形の辺 a,b、斜辺 c）',
    choices:['a+b=c','a²+b²=c²','a²-b²=c²','a×b=c²'], correct:1,
    explanation:'直角三角形では a²+b²=c² が成り立ちます。ピタゴラスにちなんで命名されました。' },
  { category:'一般', tags:['AI生成'],
    text:'大気圧の大きさとして最も近いものはどれか？',
    choices:['約0.1気圧','約1気圧','約10気圧','約100気圧'], correct:1,
    explanation:'標準大気圧は1気圧（約1013 hPa）です。1平方センチメートル当たり約1kgの力に相当します。' },
  { category:'一般', tags:['AI生成'],
    text:'血液中で酸素を運ぶタンパク質はどれか？',
    choices:['アミラーゼ','インスリン','ヘモグロビン','コラーゲン'], correct:2,
    explanation:'ヘモグロビンは赤血球に含まれる赤い色素タンパクで、鉄を含み酸素と結合して全身に酸素を運搬します。' },
];


/* ============================================================
   状態管理（アプリ全体で使うデータをひとつのオブジェクト S にまとめる）
============================================================ */
let S = {
  user: null,          // ログイン中のユーザー情報（null = 未ログイン）
  materials: [],       // 教材（問題セット）の一覧
  questions: [],       // すべての問題データ
  studySession: null,  // 個人学習中のセッション情報
  battleSession: null, // 対戦中のセッション情報
  studyFilter: 'すべて', // 問題集選択画面のカテゴリフィルター
  
};


/* ============================================================
   ストレージ（localStorage へのデータ保存・読み込み）
============================================================ */

function save() {
  if (!S.user) {
    localStorage.removeItem('pz_user');
    return;
  }

  localStorage.setItem('pz_user', JSON.stringify(S.user));
  localStorage.setItem('pz_materials', JSON.stringify(S.materials));
  localStorage.setItem('pz_questions', JSON.stringify(S.questions));
}

function load() {
  const u = localStorage.getItem('pz_user');
  if (!u) return false;
  S.user      = JSON.parse(u);
  S.materials = JSON.parse(localStorage.getItem('pz_materials') || '[]');
  S.questions = JSON.parse(localStorage.getItem('pz_questions')  || '[]');
  return true;
}


/* ============================================================
   ユーティリティ（共通の便利な関数）
============================================================ */

function uid()      { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function fmtDate(iso) { const d=new Date(iso); return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
function shuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function esc(s)     { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getLevel(pts) { return Math.floor(pts/100)+1; }
function getXP(pts)    { return pts % 100; }

function getRank(pct) {
  if (pct>=90) return { icon:`<span class="rank-icon gold">${svg(IC.trophy,40)}</span>`,   label:'SS ランク' };
  if (pct>=75) return { icon:`<span class="rank-icon gold">${svg(IC.award,40)}</span>`,    label:'S ランク'  };
  if (pct>=60) return { icon:`<span class="rank-icon silver">${svg(IC.award,40)}</span>`,  label:'A ランク'  };
  if (pct>=40) return { icon:`<span class="rank-icon bronze">${svg(IC.award,40)}</span>`,  label:'B ランク'  };
  return        { icon:`<span class="rank-icon blue">${svg(IC.bookOpen,40)}</span>`,        label:'C ランク'  };
}


/* ============================================================
   SVG アイコン（Lucide Icons）共通定義
============================================================ */

const svg = (paths, size=16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const IC = {
  mail:       `<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`,
  lock:       `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  user:       `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  trophy:     `<path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 5h12v6a6 6 0 0 1-12 0V5z"/><path d="M9 21h6"/><path d="M12 17v4"/>`,
  star:       `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  award:      `<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>`,
  bookOpen:   `<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>`,
  folder:     `<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z"/>`,
  help:       `<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>`,
  inbox:      `<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>`,
  bot:        `<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>`,
  search:     `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>`,
  share:      `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>`,
  zap:        `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  save:       `<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>`,
  plus:       `<path d="M5 12h14"/><path d="M12 5v14"/>`,
  x:          `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  pencil:     `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>`,
  sparkles:   `<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>`,
  flame:      `<path d="M8.5 14.5A4.5 4.5 0 0 0 17 12c0-4.5-4.5-4.5-4.5-9 0 3.5 3 4.5 3 9a3 3 0 0 1-3 3"/><path d="M12 3c0 3.5 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 1-1 2-3 2-5z"/>`,
  checkCircle:`<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>`,
  xCircle:    `<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>`,
  minusCircle:`<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>`,
  lightbulb:  `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>`,
  barChart:   `<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>`,
  swords:     `<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/>`,
  globe:      `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
  flask:      `<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>`,
  leaf:       `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,
  dna:        `<path d="M2 15c6.667-6 13.333 0 20-6"/><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993"/><path d="M2 9c6.667-6 13.333 0 20-6"/><path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993"/>`,
  map:        `<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><path d="M9 3v15"/><path d="M15 6v15"/>`,
};

const AVATAR_COLORS = {
  '🐧':{ c:'#0EA5E9', bg:'#E0F2FE' }, '🦊':{ c:'#EA580C', bg:'#FFEDD5' },
  '🐻':{ c:'#92400E', bg:'#FEF3C7' }, '🐱':{ c:'#EC4899', bg:'#FCE7F3' },
  '🐼':{ c:'#6B7280', bg:'#F3F4F6' }, '🦋':{ c:'#8B5CF6', bg:'#EDE9FE' },
  '🦁':{ c:'#D97706', bg:'#FFF7ED' }, '🐸':{ c:'#16A34A', bg:'#DCFCE7' },
  '🐯':{ c:'#F59E0B', bg:'#FFFBEB' }, '🦄':{ c:'#C026D3', bg:'#FDF4FF' },
  '🐮':{ c:'#78716C', bg:'#F5F5F4' }, '🐺':{ c:'#64748B', bg:'#F1F5F9' },
  '🤖':{ c:'#3B82F6', bg:'#DBEAFE' },
};

function getAvatarHTML(emoji, size=40) {
  const av = AVATAR_COLORS[emoji] || { c:'#3B82F6', bg:'#DBEAFE' };
  const fs = Math.round(size * 0.55);
  return `<div class="avatar-circle" style="width:${size}px;height:${size}px;background:${av.bg};color:${av.c};font-size:${fs}px;display:flex;align-items:center;justify-content:center;">${emoji}</div>`;
}


/* ============================================================
   グローバル変数（複数ファイルから参照される状態変数）
============================================================ */
const NAV_SCREENS      = new Set(['home','materials','ranking','mypage']);
let uploadMethod       = 'camera';
let editingQid         = null;
let battleTimerInterval = null;
let selectedAvatar     = null;
let selectedFile       = null;  


/* ============================================================
   ナビゲーション（画面の切り替え）
============================================================ */

function navigate(screen, params={}) {
  const screenEl = document.getElementById('screen');
  const navEl    = document.getElementById('bottom-nav');
  screenEl.className = 'fade-in';

  if (NAV_SCREENS.has(screen)) {
    navEl.classList.remove('hidden');
    navEl.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen===screen));
  } else {
    navEl.classList.add('hidden');
  }

  const map = {
    splash:           () => renderSplash(),
    login:            () => renderLogin(),
    register:         () => renderRegister(),
    home:             () => renderHome(),
    upload:           () => renderUpload(),
    analyzing:        () => renderAnalyzing(params),
    materials:        () => renderMaterials(),
    'question-edit':  () => renderQuestionEdit(params),
    'battle-start':   () => renderBattleStart(),
    'question-set':   () => renderQuestionSet(),
    question:         () => renderQuestion(params),
    result:           () => renderResult(params),
    'battle-matching':() => renderBattleMatching(),
    battle:           () => renderBattle(),
    'battle-result':  () => renderBattleResult(),
    mypage:           () => renderMyPage(),
    'profile-edit':   () => renderProfileEdit(),
    'battle-history': () => renderBattleHistory(),
    ranking:          () => renderRanking(),
    
    'puzzle-room':  () => renderPuzzleRoom(),
    'puzzle-board': () => renderPuzzleBoard(params),
  };
  if (map[screen]) {
    screenEl.innerHTML = map[screen]();

    if (screen === "register" && typeof initRegisterScreen === "function") {
      initRegisterScreen();
    }

    afterRender(screen, params);
  }
}

function afterRender(screen, params) {
  if (screen === 'splash') {
    setTimeout(async () => {
      if (typeof checkLoginStatus === "function") {
        const user = await checkLoginStatus();

        if (user) {
          navigate('home');
        } else {
          navigate('login');
        }

        return;
      }

      if (load()) {
        navigate('home');
      } else {
        navigate('login');
      }
    }, 2000);
  }

  if (screen === "home" && typeof loadHomeCalendarFromServer === "function") {
    loadHomeCalendarFromServer();
  }

  if (screen === 'analyzing') {
    runAIAnalysis(params);
  }

  if (screen === 'question-set' && typeof loadStudyDataFromServer === 'function') {
    if (!studyLoaded && (!Array.isArray(S.questions) || S.questions.length === 0)) {
      loadStudyDataFromServer();
    }
  }

  if (screen === 'battle-matching') {
    runMatchmaking();
  }

  if (screen === 'battle') {
    startBattleTimer();
  }

  if (screen === 'battle-result') {
    startPointCountUp();
  }
}


/* ============================================================
   アプリ初期化
============================================================ */
window.addEventListener('load', () => { navigate('splash'); });
