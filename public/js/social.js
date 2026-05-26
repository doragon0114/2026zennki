/* ============================================================
   social.js — マイページ・プロフィール編集・ランキング画面
   ─────────────────────────────────────────────────────────────
   担当: フロントエンド担当

   TODO（DB担当者へ）:
     ・renderRanking()   : MOCK_RANKINGS の代わりにサーバーからランキングデータを取得する
     ・saveProfile()     : save() の後にサーバーへプロフィール更新 API も呼ぶ
     ・doLogout()        : サーバー側のセッション破棄 API を呼んでからリセットする
============================================================ */


/* ============================================================
   マイページ画面
   ユーザーのアバター・名前・レベル・各種統計を表示し、
   プロフィール編集・セット一覧・ランキング・対戦履歴・ログアウトへのメニューを提供する
============================================================ */
function renderMyPage() {
  const lv = getLevel(S.user.points);
  return `
    <div class="mypage-hero">
      <span class="mypage-avatar">${getAvatarHTML(S.user.avatar,72)}</span>
      <div class="mypage-name">${esc(S.user.name)}</div>
      <div class="mypage-email">${esc(S.user.email)}</div>
      <div style="display:inline-block;background:linear-gradient(135deg,#FFD44D,var(--gold));color:white;padding:4px 14px;border-radius:14px;font-size:13px;font-weight:900;margin-bottom:14px;box-shadow:var(--shadow-gold)">Lv. ${lv}</div>
      <div class="mypage-stats">
        <div class="mypage-stat"><div class="mypage-stat-num">${S.user.points}</div><div class="mypage-stat-lbl">ポイント</div></div>
        <div class="mypage-stat"><div class="mypage-stat-num">${S.user.wins}</div><div class="mypage-stat-lbl">対戦勝利</div></div>
        <div class="mypage-stat"><div class="mypage-stat-num">${S.user.totalStudied}</div><div class="mypage-stat-lbl">学習回数</div></div>
        <div class="mypage-stat"><div class="mypage-stat-num">${S.questions.length}</div><div class="mypage-stat-lbl">問題数</div></div>
      </div>
    </div>
    <div class="mypage-menu">
      <div class="mypage-menu-item" onclick="navigate('profile-edit')">
        <div class="mypage-menu-icon blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <div class="mypage-menu-label">プロフィール編集</div>
        <div class="mypage-menu-arrow">›</div>
      </div>
      <div class="mypage-menu-item" onclick="navigate('materials')">
        <div class="mypage-menu-icon green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></svg>
        </div>
        <div class="mypage-menu-label">セット一覧</div>
        <div class="mypage-menu-arrow">›</div>
      </div>
      <div class="mypage-menu-item" onclick="navigate('ranking')">
        <div class="mypage-menu-icon gold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 5h12v6a6 6 0 0 1-12 0V5z"/><path d="M9 21h6"/><path d="M12 17v4"/></svg>
        </div>
        <div class="mypage-menu-label">ランキング</div>
        <div class="mypage-menu-arrow">›</div>
      </div>
      <div class="mypage-menu-item" onclick="navigate('battle-history')">
        <div class="mypage-menu-icon red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/></svg>
        </div>
        <div class="mypage-menu-label">対戦履歴</div>
        <div class="mypage-menu-arrow">›</div>
      </div>
    </div>
    <div class="mypage-menu" style="margin-top:8px">
      <div class="mypage-menu-item danger" onclick="doLogout()">
        <div class="mypage-menu-icon red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <div class="mypage-menu-label">ログアウト</div>
        <div class="mypage-menu-arrow">›</div>
      </div>
    </div>
    <div style="height:16px"></div>`;
}

/* ログアウト処理：確認後に S の中身をリセットしてログイン画面へ戻る
   TODO(DB担当): サーバー側のセッション破棄 API を呼んでからリセットする */
function doLogout() {
  if (!confirm('ログアウトしますか？')) return;
  S.user=null; S.materials=[]; S.questions=[];
  navigate('login');
}


/* ============================================================
   プロフィール編集画面
   アバター（絵文字）の選択と名前の変更ができる
============================================================ */
const AVATARS=['🐧','🦊','🐻','🐱','🐼','🦋','🦁','🐸','🐯','🦄','🐮','🐺'];

function renderProfileEdit() {
  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('mypage')">←</button>
      <div class="header-title">プロフィール編集</div>
    </div>
    <div class="screen-body">
      <div style="text-align:center;padding:16px 0 8px" id="preview-avatar-wrap">
        ${getAvatarHTML(S.user.avatar,72)}
      </div>
      <div class="form-group">
        <label class="form-label">アバターを選択</label>
        <div class="avatar-picker">
          ${AVATARS.map(a=>`<div class="avatar-option ${a===S.user.avatar?'selected':''}" onclick="selectAvatar('${a}')" id="av-${a}">${a}</div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">${svg(IC.user,14)} 名前</label>
        <input class="form-input" id="edit-name" type="text" value="${esc(S.user.name)}" placeholder="名前を入力">
      </div>
      <div class="form-group">
        <label class="form-label">${svg(IC.mail,14)} メールアドレス</label>
        <input class="form-input" type="email" value="${esc(S.user.email)}" readonly style="opacity:0.6">
      </div>
      <div id="profile-msg" class="alert hidden"></div>
      <button class="btn btn-primary" onclick="saveProfile()">${svg(IC.save,15)} 保存する</button>
    </div>`;
}

function selectAvatar(a) {
  selectedAvatar=a;
  document.querySelectorAll('.avatar-option').forEach(el=>el.classList.remove('selected'));
  const el=document.getElementById(`av-${a}`); if(el) el.classList.add('selected');
  const pw=document.getElementById('preview-avatar-wrap');
  if(pw) pw.innerHTML=getAvatarHTML(a,72);
}

/* TODO(DB担当): save() の後にサーバーへプロフィール更新 API も呼ぶ */
function saveProfile() {
  const name=document.getElementById('edit-name').value.trim();
  if (!name) { alert('名前を入力してください'); return; }
  S.user.name=name;
  if (selectedAvatar) S.user.avatar=selectedAvatar;
  save();
  const msg=document.getElementById('profile-msg');
  msg.textContent='✓ 保存しました';
  msg.className='alert alert-success';
  setTimeout(()=>navigate('mypage'),1000);
}


/* ============================================================
   ランキング画面
   自分のポイントに応じてランキングに自分を挿入し、上位3名を表彰台で表示する
   TODO（DB担当者へ）: MOCK_RANKINGS の代わりにサーバーからランキングデータを取得する
============================================================ */
function renderRanking() {
  const all = [...MOCK_RANKINGS];
  const insertAt = all.findIndex(u=>u.points<S.user.points);
  const me = { id:'me', name:S.user.name+' (あなた)', avatar:S.user.avatar, points:S.user.points, wins:S.user.wins, isMe:true };
  all.splice(insertAt===-1?all.length:insertAt, 0, me);

  const top3 = all.slice(0,3);
  const rest  = all.slice(3);
  const podiumOrder=[{i:1,cls:'second'},{i:0,cls:'first'},{i:2,cls:'third'}];
  const medals=['1','2','3'];
  const podiumH=['70px','54px','42px'];
  const po = podiumOrder.filter(p=>top3[p.i]).map(p=>{
    const u=top3[p.i];
    const h=p.cls==='first'?podiumH[0]:p.cls==='second'?podiumH[1]:podiumH[2];
    return `
      <div class="rank-podium">
        <div class="rank-podium-avatar">${getAvatarHTML(u.avatar,44)}</div>
        <div class="rank-podium-name">${esc(u.name.replace(' (あなた)',''))}</div>
        <div class="rank-podium-pts">${u.points}pt</div>
        <div class="rank-podium-box ${p.cls}" style="height:${h}">${medals[['first','second','third'].indexOf(p.cls)]}</div>
      </div>`;
  }).join('');

  const rows = all.map((u,i)=>`
    <div class="rank-item ${u.isMe?'me':''}">
      <div class="rank-num">${i+1}</div>
      <div class="rank-avatar-icon">${getAvatarHTML(u.avatar,36)}</div>
      <div class="rank-info">
        <div class="rank-name">${esc(u.name)}</div>
        <div class="rank-wins">${svg(IC.swords,12)} 勝利 ${u.wins}回</div>
      </div>
      <div class="rank-pts">${u.points}pt</div>
    </div>`).join('');

  return `
    <div class="ranking-hero">
      <div class="ranking-hero-icon"><img src="trophy.png" alt="trophy" class="ranking-trophy-img"></div>
      <div class="ranking-hero-title">ランキング</div>
      <div class="ranking-hero-sub">学校内で1位を目指そう！</div>
    </div>
    <div class="ranking-top3">${po}</div>
    <div class="rank-list">${rows}</div>`;
}
