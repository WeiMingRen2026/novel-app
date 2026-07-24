// ============================================
//  API 请求封装
// ============================================
const API = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, data) => fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) }).then(r => r.json()),
  del: (url) => fetch(url, { method: 'DELETE' }).then(r => r.json()),

  // 小说
  novelSearch: (keyword, source='all') => API.get(`/api/novel/search?keyword=${encodeURIComponent(keyword)}&source=${source}`),
  novelCategories: () => API.get('/api/novel/categories'),
  novelRankings: (source='fanqie', type='hot') => API.get(`/api/novel/rankings?source=${source}&type=${type}`),
  novelBookInfo: (source, bookId) => API.get(`/api/novel/book/${source}/${bookId}`),
  novelChapters: (novelId) => API.get(`/api/novel/chapters/${novelId}`),
  novelContent: (novelId, chapterId) => API.get(`/api/novel/content/${novelId}/${chapterId}`),
  novelReviews: (novelId, page=1, refresh=false) => API.get(`/api/novel/reviews/${novelId}?page=${page}&refresh=${refresh}`),
  novelRefreshReviews: (novelId) => API.post(`/api/novel/reviews/${novelId}/refresh`),
  novelParaComments: (novelId, chapterId, refresh=false) => API.get(`/api/novel/paragraph-comments/${novelId}/${chapterId}?refresh=${refresh}`),

  // 漫画
  comicCategories: () => API.get('/api/comic/categories'),
  comicRankings: (type='hot') => API.get(`/api/comic/rankings?type=${type}`),
  comicRandom: (count=5) => API.get(`/api/comic/random?count=${count}`),
  comicByCategory: (name, page=1) => API.get(`/api/comic/category/${encodeURIComponent(name)}?page=${page}`),
  comicSearch: (keyword) => API.get(`/api/comic/search?keyword=${encodeURIComponent(keyword)}`),
  comicBookInfo: (bookId) => API.get(`/api/comic/book/${bookId}`),
  comicChapters: (novelId) => API.get(`/api/comic/chapters/${novelId}`),
  comicContent: (novelId, chapterId) => API.get(`/api/comic/content/${novelId}/${chapterId}`),

  // 书架
  shelf: () => API.get('/api/shelf/'),
  addShelf: (novelId) => API.post('/api/shelf/add', { novelId }),
  removeShelf: (novelId) => API.del(`/api/shelf/${novelId}`),
  checkShelf: (novelId) => API.get(`/api/shelf/check/${novelId}`),
  history: () => API.get('/api/shelf/history'),
  progress: (novelId, chapterId, chapterTitle, pos) => API.post('/api/shelf/progress', { novelId, chapterId, chapterTitle, position: pos }),
};

// ============================================
//  全局状态
// ============================================
const state = {
  currentTab: 'home',
  currentBook: null,
  chapters: [],
  currentChapterIndex: 0,
  fontSize: 18,
  lineHeight: 1.8,
  theme: { bg: '#FFF9E8', text: '#333', name: '默认' },
  paraComments: {},
  bookshelfCount: 0,
  isComicMode: false,
  comicChapters: [],
  comicCurrentChapter: 0,
  categoryNovel: null,
  categoryComic: null,
};

const THEMES = [
  { bg: '#FFF9E8', text: '#333', name: '默认' },
  { bg: '#1A1A1A', text: '#AAA', name: '夜间' },
  { bg: '#C7EDCC', text: '#333', name: '护眼' },
  { bg: '#F9E0E6', text: '#333', name: '粉嫩' },
  { bg: '#D6E8F5', text: '#333', name: '清新' },
];

const NOVEL_CAT_COLORS = ['#FF6B35','#4CAF50','#2196F3','#9C27B0','#FF9800','#00BCD4','#795548','#F44336','#E91E63','#3F51B5','#009688','#FFC107','#607D8B'];
const COMIC_CAT_COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E2','#F8B500','#52BE80','#CD5C5C'];

// ============================================
//  工具函数
// ============================================
function formatTime(t) {
  if (!t) return '';
  const d = new Date(t), now = new Date(), diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff/60000)+'分钟前';
  if (diff < 86400000) return Math.floor(diff/3600000)+'小时前';
  if (diff < 2592000000) return Math.floor(diff/86400000)+'天前';
  return (d.getMonth()+1)+'-'+d.getDate();
}

function getSourceName(s) {
  return { fanqie:'番茄小说', qimao:'七猫小说', qidian:'起点读书', biquge:'笔趣阁', comic_biqukan:'漫画库' }[s] || s;
}

function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `<div class="modal-panel" onclick="event.stopPropagation()">${html}</div>`;
  overlay.style.display = 'flex';
  overlay.onclick = closeModal;
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.style.display = 'none';
  overlay.innerHTML = '';
}

// ============================================
//  页面导航
// ============================================
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  window.scrollTo(0, 0);
}

function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.tabbar-item').forEach(t => t.classList.remove('active'));
  document.querySelector(`.tabbar-item[data-tab="${tab}"]`)?.classList.add('active');
  showPage('page-' + tab);

  // 每个tab切换时加载对应数据
  if (tab === 'shelf') loadShelf();
  if (tab === 'profile') loadProfileData();
  if (tab === 'rank') loadRankings(rankSource, rankType);
  if (tab === 'comic') loadComicHome();
}

// ============================================
//  首页 - 小说
// ============================================
async function loadHome() {
  try {
    const res = await API.novelRankings('biquge', 'hot');
    if (res.code === 0) {
      const books = res.data.slice(0, 6);
      const html = books.map((b, i) => `
        <div class="book-card" onclick="openNovelBook('${b.source||'biquge'}','${b.bookId}')">
          <div class="book-cover">📖</div>
          <div class="book-title">${b.title}</div>
          <div class="book-author">${b.author||'未知'}</div>
        </div>
      `).join('');
      document.getElementById('home-hot').innerHTML = html;
    }
  } catch(e) { console.error(e); }
}

async function loadHomeCategories() {
  try {
    const res = await API.novelCategories();
    if (res.code === 0) {
      const cats = res.data.slice(0, 8);
      const html = cats.map((c, i) => `
        <div class="cat-item" onclick="openNovelCategory('${c.name}')">
          <div class="cat-icon" style="background:${NOVEL_CAT_COLORS[i%NOVEL_CAT_COLORS.length]}">📖</div>
          <div class="cat-name">${c.name}</div>
        </div>
      `).join('');
      document.getElementById('novel-cat-grid').innerHTML = html;
    }
  } catch(e) { console.error(e); }
}

// ============================================
//  漫画首页
// ============================================
async function loadComicHome() {
  // 加载漫画分类
  try {
    const res = await API.comicCategories();
    if (res.code === 0) {
      const cats = res.data.slice(0, 8);
      const html = cats.map((c, i) => `
        <div class="cat-item" onclick="openComicCategory('${c.name}')">
          <div class="cat-icon" style="background:${COMIC_CAT_COLORS[i%COMIC_CAT_COLORS.length]}">${c.icon||'📚'}</div>
          <div class="cat-name">${c.name}</div>
        </div>
      `).join('');
      document.getElementById('comic-cat-grid').innerHTML = html;
    }
  } catch(e) { console.error(e); }

  // 加载随机推荐5本漫画
  try {
    const res = await API.comicRandom(5);
    if (res.code === 0) {
      const html = res.data.map((b, i) => `
        <div class="book-card" onclick="openComicBook('${b.bookId}')">
          <div class="book-cover">${b.cover||'📚'}</div>
          <div class="book-title">${b.title}</div>
          <div class="book-author">${b.author||'未知'}</div>
        </div>
      `).join('');
      document.getElementById('comic-random').innerHTML = html;
    }
  } catch(e) { console.error(e); }
}

// ============================================
//  分类页 - 小说
// ============================================
async function loadNovelCategories() {
  try {
    const res = await API.novelCategories();
    if (res.code === 0) {
      const cats = res.data;
      const html = cats.map((c, i) => `
        <div class="cat-item" onclick="openNovelCategory('${c.name}')">
          <div class="cat-icon" style="background:${NOVEL_CAT_COLORS[i%NOVEL_CAT_COLORS.length]}">📖</div>
          <div class="cat-name">${c.name}</div>
        </div>
      `).join('');
      document.getElementById('novel-cat-grid2').innerHTML = html;
    }
  } catch(e) { console.error(e); }
}

// 打开小说分类书单页
async function openNovelCategory(name) {
  state.categoryNovel = name;
  showPage('page-novel-category');
  document.getElementById('novel-cat-title').textContent = name;
  document.getElementById('novel-cat-list').innerHTML = '<div class="loading"></div>';
  try {
    const res = await API.novelSearch(name, 'biquge');
    if (res.code === 0) {
      renderNovelList(res.data, 'novel-cat-list');
    } else {
      document.getElementById('novel-cat-list').innerHTML = '<div class="empty">暂无数据</div>';
    }
  } catch(e) {
    document.getElementById('novel-cat-list').innerHTML = '<div class="empty">加载失败</div>';
  }
}

function renderNovelList(books, containerId) {
  if (!books || books.length === 0) {
    document.getElementById(containerId).innerHTML = '<div class="empty">暂无数据</div>';
    return;
  }
  const html = books.map(b => `
    <div class="shelf-item" onclick="openNovelBook('${b.source}','${b.bookId}')">
      <div class="shelf-cover">📖</div>
      <div class="shelf-info">
        <div class="shelf-title">${b.title}</div>
        <div class="shelf-author">${b.author||'未知'} · ${getSourceName(b.source)}</div>
        <div class="shelf-progress">${(b.intro||'').slice(0,40)}</div>
      </div>
    </div>
  `).join('');
  document.getElementById(containerId).innerHTML = html;
}

// ============================================
//  漫画分类书单页
// ============================================
async function openComicCategory(name) {
  state.categoryComic = name;
  showPage('page-comic-category');
  document.getElementById('comic-cat-title').textContent = name;
  document.getElementById('comic-cat-list').innerHTML = '<div class="loading"></div>';
  try {
    const res = await API.comicByCategory(name);
    if (res.code === 0) {
      renderComicList(res.data, 'comic-cat-list');
    } else {
      document.getElementById('comic-cat-list').innerHTML = '<div class="empty">暂无数据</div>';
    }
  } catch(e) {
    document.getElementById('comic-cat-list').innerHTML = '<div class="empty">加载失败</div>';
  }
}

function renderComicList(comics, containerId) {
  if (!comics || comics.length === 0) {
    document.getElementById(containerId).innerHTML = '<div class="empty">暂无数据</div>';
    return;
  }
  const html = comics.map(b => `
    <div class="shelf-item" onclick="openComicBook('${b.bookId}')">
      <div class="shelf-cover">${b.cover||'📚'}</div>
      <div class="shelf-info">
        <div class="shelf-title">${b.title}</div>
        <div class="shelf-author">${b.author||'未知'} · ${b.category||'漫画'}</div>
        <div class="shelf-progress">${(b.intro||'').slice(0,40)}</div>
      </div>
    </div>
  `).join('');
  document.getElementById(containerId).innerHTML = html;
}

// ============================================
//  搜索
// ============================================
function showSearch() {
  document.getElementById('search-page').classList.add('active');
  document.getElementById('search-input').focus();
}

function hideSearch() {
  document.getElementById('search-page').classList.remove('active');
}

let searchMode = 'novel'; // novel or comic

function switchSearchMode(mode, el) {
  searchMode = mode;
  document.querySelectorAll('#search-mode-tabs .source-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const kw = document.getElementById('search-input').value;
  if (kw) doSearch(kw);
}

async function doSearch(kw) {
  if (!kw || !kw.trim()) return;
  document.getElementById('search-results').innerHTML = '<div class="loading"></div>';
  try {
    let res;
    if (searchMode === 'novel') {
      const source = document.getElementById('search-source')?.dataset.source || 'all';
      res = await API.novelSearch(kw.trim(), source);
    } else {
      res = await API.comicSearch(kw.trim());
    }
    if (res.code === 0 && res.data.length > 0) {
      if (searchMode === 'novel') {
        renderNovelList(res.data, 'search-results');
      } else {
        renderComicList(res.data, 'search-results');
      }
    } else {
      document.getElementById('search-results').innerHTML = '<div class="empty">没有找到相关结果</div>';
    }
  } catch(e) {
    document.getElementById('search-results').innerHTML = '<div class="empty">搜索失败</div>';
  }
}

function switchSearchSource(s, el) {
  document.querySelectorAll('#search-source-tabs .source-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  el.dataset.source = s;
  const kw = document.getElementById('search-input').value;
  if (kw) doSearch(kw);
}

// ============================================
//  小说详情
// ============================================
async function openNovelBook(source, bookId) {
  hideSearch();
  state.isComicMode = false;
  showPage('page-detail');
  document.getElementById('detail-content').innerHTML = '<div class="loading"></div>';
  try {
    const res = await API.novelBookInfo(source, bookId);
    if (res.code === 0) {
      state.currentBook = res.data;
      state.chapters = res.data.chapters || [];
      renderBookDetail(res.data, 'novel');
    } else {
      document.getElementById('detail-content').innerHTML = '<div class="empty">加载失败</div>';
    }
  } catch(e) {
    document.getElementById('detail-content').innerHTML = '<div class="empty">加载失败: '+e.message+'</div>';
  }
}

function renderBookDetail(b, type) {
  const isComic = type === 'comic';
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-header">
      <div class="detail-cover">${b.cover||(isComic?'📚':'📖')}</div>
      <div class="detail-meta">
        <div class="detail-title">${b.title}</div>
        <div class="detail-author">${b.author||'未知作者'}</div>
        <div class="detail-tags">
          <span class="detail-tag">${b.category||'未知'}</span>
          <span class="detail-tag">${b.status||'连载中'}</span>
        </div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">简介</div>
      <p class="detail-intro" style="margin-top:8px">${b.intro||'暂无简介'}</p>
    </div>
    <div class="section">
      <div class="detail-info-row"><span class="detail-info-label">书源</span><span class="detail-info-value">${getSourceName(b.source)}</span></div>
      <div class="detail-info-row"><span class="detail-info-label">章节数</span><span class="detail-info-value">${b.totalChapters||b.chapters?.length||0} ${isComic?'话':'章'}</span></div>
      <div class="detail-info-row"><span class="detail-info-label">最新章节</span><span class="detail-info-value">${b.lastChapter||'未知'}</span></div>
    </div>
    <div class="section" onclick="showCatalog()" style="cursor:pointer">
      <div class="section-header">
        <span class="section-title">${isComic?'话目录':'章节目录'}</span>
        <span class="section-more">全部 ${b.totalChapters||0} ${isComic?'话':'章'} ›</span>
      </div>
      ${(b.chapters||[]).slice(0,5).map(c => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;color:var(--text2)">${c.title}</div>`).join('')}
    </div>
    ${!isComic ? `
    <div class="section" onclick="showReviews(${b.id})" style="cursor:pointer">
      <div class="section-header">
        <span class="section-title">书友书评</span>
        <span class="section-more">查看全部 ›</span>
      </div>
      <p style="font-size:13px;color:var(--text3)">点击查看书评</p>
    </div>
    ` : ''}
    <div style="height:70px"></div>
    <div class="action-bar">
      <div class="action-btn ${b.inShelf?'active':''}" onclick="toggleShelf(${b.id})">
        <div class="icon">${b.inShelf?'★':'☆'}</div>
        <div class="text">${b.inShelf?'已收藏':'加入书架'}</div>
      </div>
      <button class="read-btn" onclick="${isComic?`startComicReading(0)`:`startReading(0)`}">${isComic?'开始阅读':'开始阅读'}</button>
    </div>
  `;
}

async function toggleShelf(novelId) {
  const b = state.currentBook;
  if (!b) return;
  if (b.inShelf) {
    await API.removeShelf(novelId);
    b.inShelf = false;
  } else {
    await API.addShelf(novelId);
    b.inShelf = true;
  }
  renderBookDetail(b, state.isComicMode ? 'comic' : 'novel');
}

// ============================================
//  漫画详情
// ============================================
async function openComicBook(bookId) {
  hideSearch();
  state.isComicMode = true;
  showPage('page-detail');
  document.getElementById('detail-content').innerHTML = '<div class="loading"></div>';
  try {
    const res = await API.comicBookInfo(bookId);
    if (res.code === 0) {
      state.currentBook = res.data;
      state.comicChapters = res.data.chapters || [];
      renderBookDetail(res.data, 'comic');
    } else {
      document.getElementById('detail-content').innerHTML = '<div class="empty">加载失败</div>';
    }
  } catch(e) {
    document.getElementById('detail-content').innerHTML = '<div class="empty">加载失败: '+e.message+'</div>';
  }
}

// ============================================
//  小说阅读器
// ============================================
async function startReading(chapterIndex) {
  state.currentChapterIndex = chapterIndex;
  const chapter = state.chapters[chapterIndex];
  if (!chapter) { alert('暂无章节'); return; }

  showPage('page-reader');
  document.getElementById('reader-content').innerHTML = '<div class="loading"></div>';

  try {
    const res = await API.novelContent(state.currentBook.id, chapter.chapter_id);
    if (res.code === 0) {
      const paragraphs = (res.data.content||'').split(/\n\s*\n/).filter(p=>p.trim());
      let html = `<div class="reader-title">${res.data.title||chapter.title}</div>`;
      paragraphs.forEach((p, i) => {
        html += `<div class="reader-para" onclick="showParaComments(${i})">　　${p.trim()}<div class="comment-hint hidden" id="hint-${i}">💬 <span id="count-${i}"></span></div></div>`;
      });
      html += `<div class="reader-nav">
        <button class="${chapterIndex===0?'btn-disabled':'btn-default'}" ${chapterIndex===0?'disabled':''} onclick="startReading(${chapterIndex-1})">上一章</button>
        <button class="btn-default" onclick="showCatalog()">目录</button>
        <button class="${chapterIndex>=state.chapters.length-1?'btn-disabled':'btn-primary'}" ${chapterIndex>=state.chapters.length-1?'disabled':''} onclick="startReading(${chapterIndex+1})">下一章</button>
      </div>`;
      document.getElementById('reader-content').innerHTML = html;

      // 应用主题
      document.getElementById('reader-content').style.background = state.theme.bg;
      document.getElementById('reader-content').style.color = state.theme.text;
      document.getElementById('reader-page').style.background = state.theme.bg;

      loadParaComments(chapter.chapter_id);
      API.progress(state.currentBook.id, chapter.chapter_id, chapter.title, 0);
    }
  } catch(e) {
    document.getElementById('reader-content').innerHTML = '<div class="empty">加载失败</div>';
  }
}

async function loadParaComments(chapterId) {
  try {
    const res = await API.novelParaComments(state.currentBook.id, chapterId);
    if (res.code === 0) {
      const map = {};
      res.data.forEach(c => {
        const idx = c.paragraph_index || 0;
        if (!map[idx]) map[idx] = [];
        map[idx].push(c);
      });
      state.paraComments = map;
      Object.keys(map).forEach(idx => {
        const hint = document.getElementById(`hint-${idx}`);
        const count = document.getElementById(`count-${idx}`);
        if (hint && count) {
          hint.classList.remove('hidden');
          count.textContent = map[idx].length + '条评论';
        }
      });
    }
  } catch(e) { console.error(e); }
}

function showParaComments(idx) {
  const comments = state.paraComments[idx] || [];
  if (comments.length === 0) return;
  let html = `<div class="modal-header"><span class="modal-title">段评 (${comments.length})</span><span class="modal-close" onclick="closeModal()">✕</span></div>`;
  comments.forEach(c => {
    html += `<div class="comment-item">
      <div class="comment-avatar">👤</div>
      <div class="comment-body">
        <div class="comment-user">${c.user_name}</div>
        <div class="comment-text">${c.content}</div>
        <div class="comment-meta"><span>👍 ${c.like_count||0}</span><span>${formatTime(c.comment_time)}</span></div>
      </div>
    </div>`;
  });
  showModal(html);
}

function showAllParaComments() {
  const all = Object.values(state.paraComments).flat();
  if (all.length === 0) {
    showModal('<div class="modal-header"><span class="modal-title">段评</span><span class="modal-close" onclick="closeModal()">✕</span></div><div class="empty">暂无评论</div>');
    return;
  }
  let html = `<div class="modal-header"><span class="modal-title">全部段评 (${all.length})</span><span class="modal-close" onclick="closeModal()">✕</span></div>`;
  all.forEach(c => {
    html += `<div class="comment-item"><div class="comment-avatar">👤</div><div class="comment-body"><div class="comment-user">${c.user_name}</div><div class="comment-text">${c.content}</div><div class="comment-meta"><span>👍 ${c.like_count||0}</span><span>${formatTime(c.comment_time)}</span></div></div></div>`;
  });
  showModal(html);
}

function showReaderMenu() {
  const bar = document.getElementById('reader-top-bar');
  const bbar = document.getElementById('reader-bottom-bar');
  bar.style.display = bar.style.display === 'flex' ? 'none' : 'flex';
  bbar.style.display = bbar.style.display === 'flex' ? 'none' : 'flex';
}

function showReaderSettings() {
  let html = `<div class="modal-header"><span class="modal-title">阅读设置</span><span class="modal-close" onclick="closeModal()">✕</span></div>`;
  html += `<div class="setting-section"><div class="setting-label">字体大小</div><div class="font-control"><button class="font-btn" onclick="changeFont(-2)">−</button><span id="font-size-val">${state.fontSize}</span><button class="font-btn" onclick="changeFont(2)">+</button></div></div>`;
  html += `<div class="setting-section"><div class="setting-label">阅读主题</div><div class="theme-list">${THEMES.map((t,i)=>`<div class="theme-item ${state.theme.name===t.name?'active':''}" style="background:${t.bg};color:${t.text}" onclick="changeTheme(${i})">${t.name}</div>`).join('')}</div></div>`;
  showModal(html);
}

function changeFont(delta) {
  state.fontSize = Math.max(14, Math.min(32, state.fontSize + delta));
  document.getElementById('font-size-val').textContent = state.fontSize;
  document.querySelectorAll('.reader-para').forEach(p => {
    p.style.fontSize = state.fontSize + 'px';
    p.style.lineHeight = state.fontSize * state.lineHeight + 'px';
  });
}

function changeTheme(i) {
  state.theme = THEMES[i];
  document.getElementById('reader-content').style.background = state.theme.bg;
  document.getElementById('reader-content').style.color = state.theme.text;
  document.querySelectorAll('.reader-para').forEach(p => p.style.color = state.theme.text);
  document.querySelectorAll('.reader-title').forEach(p => p.style.color = state.theme.text);
  document.getElementById('reader-page').style.background = state.theme.bg;
  showReaderSettings();
}

// ============================================
//  漫画阅读器
// ============================================
async function startComicReading(chapterIndex) {
  state.comicCurrentChapter = chapterIndex;
  const chapter = state.comicChapters[chapterIndex];
  if (!chapter) { alert('暂无章节'); return; }

  showPage('page-comic-reader');
  document.getElementById('comic-reader-content').innerHTML = '<div class="loading"></div>';

  try {
    const res = await API.comicContent(state.currentBook.id, chapter.chapter_id);
    if (res.code === 0) {
      const pages = res.data.pages || [];
      let html = `<div style="color:#888;text-align:center;padding:16px;background:#111;border-bottom:1px solid #222">${res.data.title||chapter.title}</div>`;
      pages.forEach(p => {
        html += `<div class="comic-page">
          <div class="comic-page-placeholder">
            <div class="big-icon">📖</div>
            <div>${p.text||('第 '+p.page+' 页')}</div>
          </div>
        </div>`;
      });
      html += `<div class="comic-nav">
        <button class="${chapterIndex===0?'btn-disabled':'btn-default'}" ${chapterIndex===0?'disabled':''} onclick="startComicReading(${chapterIndex-1})">上一话</button>
        <button class="btn-default" onclick="showCatalog()">目录</button>
        <button class="${chapterIndex>=state.comicChapters.length-1?'btn-disabled':'btn-primary'}" ${chapterIndex>=state.comicChapters.length-1?'disabled':''} onclick="startComicReading(${chapterIndex+1})">下一话</button>
      </div>`;
      document.getElementById('comic-reader-content').innerHTML = html;
    }
  } catch(e) {
    document.getElementById('comic-reader-content').innerHTML = '<div class="empty">加载失败</div>';
  }
}

// ============================================
//  目录
// ============================================
function showCatalog() {
  const chapters = state.isComicMode ? state.comicChapters : state.chapters;
  const currentIdx = state.isComicMode ? state.comicCurrentChapter : state.currentChapterIndex;
  const onItemClick = state.isComicMode
    ? `closeModal();startComicReading(IDX)`
    : `closeModal();startReading(IDX)`;

  let html = `<div class="catalog-modal"><div class="catalog-header"><span style="font-size:18px;font-weight:bold">目录 (${chapters.length}${state.isComicMode?'话':'章'})</span><span class="modal-close" onclick="closeModal()">✕</span></div>`;
  chapters.forEach((c, i) => {
    html += `<div class="catalog-item ${i===currentIdx?'active':''}" onclick="${onItemClick.replace('IDX', i)}">${c.title}</div>`;
  });
  html += '</div>';
  showModal(html);
}

// ============================================
//  书评
// ============================================
async function showReviews(novelId) {
  showPage('page-reviews');
  document.getElementById('reviews-content').innerHTML = '<div class="loading"></div>';
  try {
    const res = await API.novelReviews(novelId, 1, true);
    if (res.code === 0) {
      const list = res.data.list || [];
      if (list.length === 0) {
        document.getElementById('reviews-content').innerHTML = '<div class="empty">暂无书评</div>';
        return;
      }
      let html = `<div style="padding:12px 16px;background:var(--card);border-bottom:1px solid var(--border)"><span style="font-weight:bold">《${state.currentBook?.title||''}》</span> <span style="font-size:13px;color:var(--text3)">共 ${res.data.total} 条评论</span></div>`;
      list.forEach(r => {
        const stars = Math.round(r.rating||0);
        html += `<div class="comment-item">
          <div class="comment-avatar">👤</div>
          <div class="comment-body">
            <div class="comment-user">${r.user_name}</div>
            <div class="rating">${[1,2,3,4,5].map(s=>`<span class="star ${s<=stars?'on':''}">★</span>`).join('')}</div>
            <div class="comment-text">${r.content}</div>
            <div class="comment-meta"><span>👍 ${r.like_count||0}</span><span>💬 ${r.reply_count||0}</span><span>${formatTime(r.review_time)}</span></div>
          </div>
        </div>`;
      });
      document.getElementById('reviews-content').innerHTML = html;
    }
  } catch(e) {
    document.getElementById('reviews-content').innerHTML = '<div class="empty">加载失败</div>';
  }
}

async function refreshReviews() {
  if (!state.currentBook) return;
  document.getElementById('reviews-content').innerHTML = '<div class="loading"></div>';
  await API.novelRefreshReviews(state.currentBook.id);
  showReviews(state.currentBook.id);
}

// ============================================
//  书架
// ============================================
async function loadShelf() {
  try {
    const res = await API.shelf();
    if (res.code === 0) {
      state.bookshelfCount = res.data.length;
      if (res.data.length === 0) {
        document.getElementById('shelf-content').innerHTML = '<div class="empty">📖<br>书架空空如也<br><br><span style="color:var(--primary)" onclick="switchTab(\'home\')">去发现好书</span></div>';
        return;
      }
      const html = res.data.map(b => `
        <div class="shelf-item" onclick="${b.type==='comic'?`openComicBook('${b.book_id}')`:`openNovelBook('${b.source}','${b.book_id}')`}">
          <div class="shelf-cover">${b.type==='comic'?'📚':'📖'}</div>
          <div class="shelf-info">
            <div class="shelf-title">${b.title}</div>
            <div class="shelf-author">${b.author}</div>
            <div class="shelf-progress">${b.last_read_chapter?'看到: '+b.last_read_chapter:'未阅读'}</div>
          </div>
        </div>
      `).join('');
      document.getElementById('shelf-content').innerHTML = html;
    }
  } catch(e) { console.error(e); }
}

// ============================================
//  排行榜
// ============================================
let rankSource = 'biquge', rankType = 'hot';

async function loadRankings(source='biquge', type='hot') {
  try {
    const res = await API.novelRankings(source, type);
    if (res.code === 0) {
      const html = res.data.map((b, i) => `
        <div class="rank-item" onclick="openNovelBook('${b.source||source}','${b.bookId}')">
          <div class="rank-num ${i<3?'top':''}">${i+1}</div>
          <div class="rank-info">
            <div class="rank-title">${b.title}</div>
            <div class="rank-author">${b.author||'未知作者'}</div>
          </div>
          <span style="color:var(--text3)">›</span>
        </div>
      `).join('');
      document.getElementById('rank-list').innerHTML = html;
    }
  } catch(e) { console.error(e); }
}

function switchRankSource(s, el) {
  document.querySelectorAll('#rank-source-tabs .source-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  rankSource = s;
  loadRankings(s, rankType);
}
function switchRankType(t, el) {
  document.querySelectorAll('#rank-type-tabs .source-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  rankType = t;
  loadRankings(rankSource, t);
}

// ============================================
//  我的页面
// ============================================
async function loadProfileData() {
  loadHistory();
  document.getElementById('stat-shelf').textContent = state.bookshelfCount;
}

async function loadHistory() {
  try {
    const res = await API.history();
    if (res.code === 0) {
      const list = res.data || [];
      if (list.length === 0) {
        document.getElementById('history-list').innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px">暂无阅读记录</div>';
        return;
      }
      const html = list.slice(0, 5).map(h => `
        <div class="shelf-item" onclick="${h.type==='comic'?`openComicBook('${h.book_id}')`:`openNovelBook('${h.source}','${h.book_id}')`}">
          <div class="shelf-cover" style="width:36px;height:50px;font-size:16px">${h.type==='comic'?'📚':'📖'}</div>
          <div class="shelf-info">
            <div class="shelf-title" style="font-size:14px">${h.title}</div>
            <div class="shelf-progress">读到: ${h.chapter_title||''}</div>
          </div>
        </div>
      `).join('');
      document.getElementById('history-list').innerHTML = html;
      document.getElementById('stat-history').textContent = list.length;
    }
  } catch(e) { console.error(e); }
}

// ============================================
//  初始化 - 构建全部UI
// ============================================
function initApp() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <!-- 小说首页 -->
    <div class="page active" id="page-home">
      <div class="search-bar">
        <div class="search-input" onclick="showSearch()">
          <span>🔍</span><span class="placeholder">搜索小说</span>
        </div>
      </div>
      <div class="banner-scroll">
        <div class="banner" style="background:#FF6B35"><h3>新书首发</h3><p>热门小说免费看</p></div>
        <div class="banner" style="background:#4CAF50"><h3>限时免费</h3><p>精品好书大放送</p></div>
        <div class="banner" style="background:#2196F3"><h3>完本精选</h3><p>全本小说畅快读</p></div>
      </div>
      <div class="section">
        <div class="section-title">精选分类</div>
        <div class="cat-grid" id="novel-cat-grid" style="margin-top:12px"></div>
      </div>
      <div class="section">
        <div class="section-header"><span class="section-title">热门榜单</span><span class="section-more" onclick="switchTab('rank')">更多 ›</span></div>
        <div class="book-grid" id="home-hot"></div>
      </div>
    </div>

    <!-- 分类 - 小说 -->
    <div class="page" id="page-category">
      <div class="header"><h1>小说分类</h1></div>
      <div class="section"><div class="cat-grid" id="novel-cat-grid2"></div></div>
    </div>

    <!-- 排行榜 -->
    <div class="page" id="page-rank">
      <div class="header"><h1>排行榜</h1></div>
      <div class="source-tabs" id="rank-source-tabs">
        <div class="source-tab active" onclick="switchRankSource('biquge',this)">笔趣阁</div>
        <div class="source-tab" onclick="switchRankSource('fanqie',this)">番茄</div>
        <div class="source-tab" onclick="switchRankSource('qimao',this)">七猫</div>
        <div class="source-tab" onclick="switchRankSource('qidian',this)">起点</div>
      </div>
      <div class="source-tabs" id="rank-type-tabs">
        <div class="source-tab active" onclick="switchRankType('hot',this)">热门榜</div>
        <div class="source-tab" onclick="switchRankType('new',this)">新书榜</div>
        <div class="source-tab" onclick="switchRankType('total',this)">总榜</div>
        <div class="source-tab" onclick="switchRankType('vote',this)">推荐榜</div>
      </div>
      <div id="rank-list"></div>
    </div>

    <!-- 书架 -->
    <div class="page" id="page-shelf">
      <div class="header"><h1>我的书架</h1></div>
      <div id="shelf-content"></div>
    </div>

    <!-- 漫画首页 -->
    <div class="page" id="page-comic">
      <div class="search-bar" style="background:linear-gradient(135deg,#FF6B6B,#FF8E53)">
        <div class="search-input" onclick="showSearch();searchMode='comic'">
          <span>🔍</span><span class="placeholder">搜索漫画</span>
        </div>
      </div>
      <div class="banner-scroll">
        <div class="banner comic-banner"><h3>热门漫画</h3><p>精彩漫画免费看</p></div>
        <div class="banner" style="background:#4ECDC4"><h3>每日更新</h3><p>新番漫画抢先看</p></div>
        <div class="banner" style="background:#9C27B0"><h3>完结精选</h3><p>全本漫画畅快读</p></div>
      </div>
      <div class="section">
        <div class="section-title">精选分类</div>
        <div class="cat-grid" id="comic-cat-grid" style="margin-top:12px"></div>
      </div>
      <div class="section">
        <div class="section-header"><span class="section-title">随机推荐</span><span class="section-more" onclick="loadComicHome()">换一批 🔄</span></div>
        <div class="book-grid" id="comic-random"></div>
      </div>
    </div>

    <!-- 我的 -->
    <div class="page" id="page-profile">
      <div class="profile-header">
        <div class="profile-avatar">👤</div>
        <div class="profile-name">读者</div>
        <div class="profile-desc">热爱阅读的人</div>
      </div>
      <div class="profile-stats">
        <div class="profile-stat"><div class="num" id="stat-shelf">0</div><div class="label">书架</div></div>
        <div class="profile-stat-divider"></div>
        <div class="profile-stat"><div class="num" id="stat-history">0</div><div class="label">阅读</div></div>
      </div>
      <div class="section" style="margin-top:8px">
        <div class="section-title">最近阅读</div>
        <div id="history-list" style="margin-top:8px"></div>
      </div>
      <div style="margin-top:8px">
        <div class="menu-item" onclick="switchTab('shelf')"><div class="menu-left"><span>📚</span><span class="menu-label">我的书架</span></div><span style="color:var(--text3)">›</span></div>
        <div class="menu-item" onclick="switchTab('home')"><div class="menu-left"><span>📖</span><span class="menu-label">小说首页</span></div><span style="color:var(--text3)">›</span></div>
        <div class="menu-item" onclick="switchTab('comic')"><div class="menu-left"><span>📚</span><span class="menu-label">漫画专区</span></div><span style="color:var(--text3)">›</span></div>
        <div class="menu-item"><div class="menu-left"><span>⚙️</span><span class="menu-label">设置</span></div><span style="color:var(--text3)">›</span></div>
        <div class="menu-item"><div class="menu-left"><span>ℹ️</span><span class="menu-label">关于</span></div><span style="color:var(--text3)">›</span></div>
      </div>
      <div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">版本 2.0.0</div>
    </div>

    <!-- 小说分类书单页 -->
    <div class="page" id="page-novel-category">
      <div class="category-header">
        <span class="category-back" onclick="switchTab('category')">‹</span>
        <span class="category-title" id="novel-cat-title">分类</span>
      </div>
      <div id="novel-cat-list" class="category-book-list"></div>
    </div>

    <!-- 漫画分类书单页 -->
    <div class="page" id="page-comic-category">
      <div class="category-header">
        <span class="category-back" onclick="switchTab('comic')">‹</span>
        <span class="category-title" id="comic-cat-title">分类</span>
      </div>
      <div id="comic-cat-list" class="category-book-list"></div>
    </div>

    <!-- 书籍详情 -->
    <div class="page" id="page-detail">
      <div class="header" style="display:flex;align-items:center">
        <span onclick="goBack()" style="font-size:22px">‹</span>
        <span style="flex:1;text-align:center;font-size:18px;font-weight:bold">详情</span>
        <span style="width:22px"></span>
      </div>
      <div id="detail-content"></div>
    </div>

    <!-- 书评 -->
    <div class="page" id="page-reviews">
      <div class="header" style="display:flex;align-items:center">
        <span onclick="showPage('page-detail')" style="font-size:22px">‹</span>
        <span style="flex:1;text-align:center;font-size:18px;font-weight:bold">书评</span>
        <span onclick="refreshReviews()" style="font-size:14px">🔄</span>
      </div>
      <div id="reviews-content"></div>
    </div>

    <!-- 小说阅读器 -->
    <div class="page" id="page-reader" style="padding:0;background:var(--reader-bg)">
      <div class="reader-top-bar" id="reader-top-bar" style="display:none;background:var(--reader-bg)">
        <span onclick="showPage('page-detail');document.getElementById('reader-top-bar').style.display='none';document.getElementById('reader-bottom-bar').style.display='none'" style="font-size:22px;color:var(--reader-text)">‹</span>
        <span class="title" style="color:var(--reader-text)">${''}</span>
        <span onclick="showCatalog()" style="font-size:22px;color:var(--reader-text)">☰</span>
      </div>
      <div class="reader-content" id="reader-content" onclick="showReaderMenu()" style="background:var(--reader-bg);color:var(--reader-text)"></div>
      <div class="reader-bottom-bar" id="reader-bottom-bar" style="display:none;background:var(--reader-bg)">
        <div class="rb-item" onclick="showCatalog()"><div class="rb-icon" style="color:var(--reader-text)">📋</div><div class="rb-text" style="color:var(--reader-text)">目录</div></div>
        <div class="rb-item" onclick="showAllParaComments()"><div class="rb-icon" style="color:var(--reader-text)">💬</div><div class="rb-text" style="color:var(--reader-text)">段评</div></div>
        <div class="rb-item" onclick="showReaderSettings()"><div class="rb-icon" style="color:var(--reader-text)">⚙️</div><div class="rb-text" style="color:var(--reader-text)">设置</div></div>
      </div>
    </div>

    <!-- 漫画阅读器 -->
    <div class="page" id="page-comic-reader" style="padding:0;background:#000">
      <div class="reader-top-bar" id="comic-top-bar" style="display:none;background:#1a1a1a">
        <span onclick="showPage('page-detail');document.getElementById('comic-top-bar').style.display='none';document.getElementById('comic-bottom-bar').style.display='none'" style="font-size:22px;color:#fff">‹</span>
        <span class="title" style="color:#fff">漫画</span>
        <span onclick="showCatalog()" style="font-size:22px;color:#fff">☰</span>
      </div>
      <div class="comic-reader" id="comic-reader-content" onclick="toggleComicMenu()"></div>
      <div class="reader-bottom-bar" id="comic-bottom-bar" style="display:none;background:#1a1a1a">
        <div class="rb-item" onclick="showCatalog()"><div class="rb-icon" style="color:#fff">📋</div><div class="rb-text" style="color:#fff">目录</div></div>
        <div class="rb-item"><div class="rb-icon" style="color:#fff">⬇️</div><div class="rb-text" style="color:#fff">下载</div></div>
        <div class="rb-item"><div class="rb-icon" style="color:#fff">⚙️</div><div class="rb-text" style="color:#fff">设置</div></div>
      </div>
    </div>

    <!-- 搜索页 -->
    <div class="search-page" id="search-page" style="display:none">
      <div class="search-header">
        <span class="search-back" onclick="hideSearch()">‹</span>
        <div class="search-box"><span>🔍</span><input id="search-input" placeholder="搜索书名/作者" onkeydown="if(event.key==='Enter')doSearch(this.value)"></div>
        <span class="search-btn" onclick="doSearch(document.getElementById('search-input').value)">搜索</span>
      </div>
      <div class="source-tabs" id="search-mode-tabs">
        <div class="source-tab active" onclick="switchSearchMode('novel',this)">小说</div>
        <div class="source-tab" onclick="switchSearchMode('comic',this)">漫画</div>
      </div>
      <div id="search-source-tabs" class="source-tabs" style="display:flex">
        <div class="source-tab active" onclick="switchSearchSource('all',this)" data-source="all">全部</div>
        <div class="source-tab" onclick="switchSearchSource('biquge',this)" data-source="biquge">笔趣阁</div>
        <div class="source-tab" onclick="switchSearchSource('fanqie',this)" data-source="fanqie">番茄</div>
        <div class="source-tab" onclick="switchSearchSource('qimao',this)" data-source="qimao">七猫</div>
        <div class="source-tab" onclick="switchSearchSource('qidian',this)" data-source="qidian">起点</div>
      </div>
      <div id="search-results">
        <div class="section">
          <div class="section-title">热门搜索</div>
          <div class="hot-tags" style="margin-top:8px">
            <div class="hot-tag top" onclick="document.getElementById('search-input').value='斗破苍穹';doSearch('斗破苍穹')">1. 斗破苍穹</div>
            <div class="hot-tag top" onclick="document.getElementById('search-input').value='凡人修仙传';doSearch('凡人修仙传')">2. 凡人修仙传</div>
            <div class="hot-tag top" onclick="document.getElementById('search-input').value='诡秘之主';doSearch('诡秘之主')">3. 诡秘之主</div>
            <div class="hot-tag" onclick="document.getElementById('search-input').value='斗罗大陆';doSearch('斗罗大陆')">4. 斗罗大陆</div>
            <div class="hot-tag" onclick="document.getElementById('search-input').value='完美世界';doSearch('完美世界')">5. 完美世界</div>
            <div class="hot-tag" onclick="document.getElementById('search-input').value='遮天';doSearch('遮天')">6. 遮天</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <div class="modal-overlay" id="modal-overlay" style="display:none"></div>

    <!-- 底部导航 - 6个tab 可横向滚动 -->
    <div class="tabbar">
      <div class="tabbar-item active" data-tab="home" onclick="switchTab('home')"><div class="icon">🏠</div><div class="label">小说</div></div>
      <div class="tabbar-item" data-tab="comic" onclick="switchTab('comic')"><div class="icon">📚</div><div class="label">漫画</div></div>
      <div class="tabbar-item" data-tab="category" onclick="switchTab('category')"><div class="icon">📑</div><div class="label">分类</div></div>
      <div class="tabbar-item" data-tab="rank" onclick="switchTab('rank')"><div class="icon">🏆</div><div class="label">排行</div></div>
      <div class="tabbar-item" data-tab="shelf" onclick="switchTab('shelf')"><div class="icon">📖</div><div class="label">书架</div></div>
      <div class="tabbar-item" data-tab="profile" onclick="switchTab('profile')"><div class="icon">👤</div><div class="label">我的</div></div>
    </div>
  `;

  // 加载初始数据
  loadHome();
  loadHomeCategories();
  loadNovelCategories();
  loadShelf();
  loadRankings();
}

function goBack() {
  if (state.isComicMode) {
    switchTab('comic');
  } else {
    switchTab('home');
  }
}

function toggleComicMenu() {
  const bar = document.getElementById('comic-top-bar');
  const bbar = document.getElementById('comic-bottom-bar');
  bar.style.display = bar.style.display === 'flex' ? 'none' : 'flex';
  bbar.style.display = bbar.style.display === 'flex' ? 'none' : 'flex';
}

// 搜索模式切换时显示/隐藏书源tab
const _origSwitchSearchMode = switchSearchMode;
switchSearchMode = function(mode, el) {
  _origSwitchSearchMode(mode, el);
  const tabs = document.getElementById('search-source-tabs');
  if (tabs) {
    tabs.style.display = mode === 'novel' ? 'flex' : 'none';
  }
};

initApp();
