// ========== DOM ==========
const $ = id => document.getElementById(id);
const inputArea = $('inputArea');
const previewArea = $('previewArea');
const copyBtn = $('copyBtn');
const themeToggle = $('themeToggle');
const toast = $('toast');
const statChars = $('statChars');
const statParagraphs = $('statParagraphs');
const statReadTime = $('statReadTime');
const proBtn = $('proBtn');
const proModal = $('proModal');
const proModalClose = $('proModalClose');
const draftList = $('draftList');
const draftCount = $('draftCount');
const autoSaveInd = $('autoSaveIndicator');
const charBar = $('charBar');
const charArea = document.querySelector('.char-area');
const DRAFTS_KEY = 'hongbi_drafts';
const THEME_KEY = 'hongbi_theme';
const AUTOSAVE_KEY = 'hongbi_autosave';
const MAX_CHARS = 1000;

let currentStyle = 'clean';
let currentSpacing = 'normal';
let currentAlign = 'left';
let toastTimer = null;
let saveTimer = null;

// ===== 撤销/重做 =====
const history = { stack: [[]], index: 0 };
function pushHistory(text) {
  const arr = text.split('');
  const cur = history.stack[history.index];
  if (JSON.stringify(cur) === JSON.stringify(arr)) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(arr);
  if (history.stack.length > 50) history.stack.shift();
  history.index = history.stack.length - 1;
}
function undo() {
  if (history.index <= 0) { showToast('没有可撤销的'); return; }
  history.index--;
  inputArea.value = history.stack[history.index].join('');
  inputArea.dispatchEvent(new Event('input', { bubbles: true }));
  showToast('↩ 已撤销');
}
function redo() {
  if (history.index >= history.stack.length - 1) { showToast('没有可重做的'); return; }
  history.index++;
  inputArea.value = history.stack[history.index].join('');
  inputArea.dispatchEvent(new Event('input', { bubbles: true }));
  showToast('↪ 已重做');
}

// ===== Markdown 渲染 =====
function renderMarkdown(text) {
  if (!text) return '';
  let html = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  html = html
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|\s)#([\u4e00-\u9fff\w]+)/g, '$1<span class="hashtag">#$2</span>');
  return html.replace(/\n/g, '<br>');
}

// ===== 排版引擎 =====
function formatText(text, style) {
  if (!text.trim()) return '';
  let r = text.trim().replace(/\n{3,}/g, '\n\n');
  switch (style) {
    case 'clean': r = r.split('\n').map(l => l.trim()).join('\n'); break;
    case 'cute':
      r = r.split('\n\n').map((p, i) => {
        p = p.trim(); if (!p) return '';
        return ['🌸','✨','💕','🎀','🌟','💗'][i%6] + ' ' + p;
      }).join('\n\n');
      break;
    case 'simple': r = r.split('\n').map(l => l.trim()).join('\n'); r = r.replace(/\n\n\n+/g, '\n\n'); break;
  }
  return r;
}
function lineHeightValue(s) { return { tight:'1.5', normal:'1.9', loose:'2.5' }[s] || '1.9'; }

// ===== 更新预览 =====
function updatePreview() {
  const raw = inputArea.value;
  const len = raw.length;
  const pct = Math.min((len / MAX_CHARS) * 100, 100);
  charBar.style.width = pct + '%';
  charArea.className = 'char-area';
  if (len > MAX_CHARS) charArea.classList.add('exceed');
  else if (len > MAX_CHARS * 0.85) charArea.classList.add('warning');
  $('charCount').textContent = len;

  const formatted = formatText(raw, currentStyle);
  if (formatted) {
    previewArea.innerHTML = renderMarkdown(formatted);
    previewArea.style.lineHeight = lineHeightValue(currentSpacing);
    previewArea.style.textAlign = currentAlign;
  } else {
    previewArea.innerHTML = '<div class="preview-placeholder"><svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:10px;opacity:0.3"><rect x="4" y="4" width="32" height="32" rx="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M12 16H28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 22H28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 28H24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>排版效果会显示在这里</span></div>';
  }
  const t = raw.trim();
  statChars.textContent = t.length;
  statParagraphs.textContent = t ? t.split('\n\n').filter(p => p.trim()).length : 0;
  statReadTime.textContent = Math.ceil(t.length / 300) + 's';
}

// ===== 光标插入 =====
function wrapSelection(prefix, suffix, placeholder) {
  const s = inputArea.selectionStart, e = inputArea.selectionEnd, t = inputArea.value;
  if (s === e) {
    inputArea.value = t.slice(0, s) + prefix + placeholder + suffix + t.slice(e);
    inputArea.selectionStart = s + prefix.length;
    inputArea.selectionEnd = s + prefix.length + placeholder.length;
  } else {
    const sel = t.slice(s, e);
    inputArea.value = t.slice(0, s) + prefix + sel + suffix + t.slice(e);
    inputArea.selectionStart = s;
    inputArea.selectionEnd = e + prefix.length + suffix.length;
  }
  inputArea.focus();
  updatePreview();
  pushHistory(inputArea.value);
}
function insertAtCursor(text) {
  const s = inputArea.selectionStart, e = inputArea.selectionEnd, t = inputArea.value;
  inputArea.value = t.slice(0, s) + text + t.slice(e);
  inputArea.focus();
  inputArea.selectionStart = inputArea.selectionEnd = s + text.length;
  updatePreview();
  pushHistory(inputArea.value);
}

// ===== Emoji =====
document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    insertAtCursor(btn.dataset.emoji);
    btn.style.transform = 'scale(1.4)';
    setTimeout(() => btn.style.transform = '', 150);
  });
});

// ===== 格式工具 =====
$('boldBtn').addEventListener('click', () => wrapSelection('**','**','加粗文字'));
$('italicBtn').addEventListener('click', () => wrapSelection('*','*','斜体文字'));
$('strikeBtn').addEventListener('click', () => wrapSelection('~~','~~','删除线'));
$('hashBtn').addEventListener('click', () => wrapSelection('#','','话题标签'));
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('spacingBtn').addEventListener('click', () => {
  inputArea.value = inputArea.value.replace(/\n{2,}/g,'\n\n').replace(/([^\n])\n([^\n])/g,'$1\n\n$2');
  inputArea.focus();
  updatePreview();
  pushHistory(inputArea.value);
  showToast('✓ 已智能分段');
});
$('clearFormatBtn').addEventListener('click', () => {
  let t = inputArea.value;
  const before = t;
  t = t.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/~~(.+?)~~/g,'$1').replace(/#([\u4e00-\u9fff\w]+)/g,'$1');
  if (t === before) { showToast('没有格式需要清除'); return; }
  inputArea.value = t;
  updatePreview();
  pushHistory(t);
  showToast('🧹 已清除所有格式');
});
$('clearBtn').addEventListener('click', () => {
  if (inputArea.value.trim() && !confirm('确定清空全部内容？')) return;
  inputArea.value = '';
  updatePreview();
  pushHistory('');
});

// ===== 模板 =====
const TEMPLATES = {
  recommend: '❤️ 被问疯了！这个XX我真的会回购一万次\n\n姐妹们！最近挖到的这个XX真的绝了，我必须分享给你们！\n\n**🌟 先说优点：**\n1. 颜值超高，拿在手里质感满分\n2. 效果真的惊艳，用了第一次就爱上了\n3. 价格也很合理，性价比超高\n\n**💡 小贴士：**\n建议大家搭配XX一起用，效果翻倍～\n\n**📌 入手方式：**\n评论区见哦！\n\n#好物推荐 #我的宝藏 #值得入手 #必买清单',
  daily: '✨ **今日份的开心 分享给你们**\n\n今天天气真的太好了！\n出门走了一圈，心情超棒～\n\n**☀️ 今日小确幸：**\n喝了超好喝的咖啡☕\n看到了可爱的猫猫🐱\n收到了期待已久的快递📦\n\n生活真的需要这些小小的快乐碎片\n攒起来就是满满幸福感呀💕\n\n#日常分享 #生活碎片 #小确幸 #治愈系',
  tutorial: '📖 **手把手教你XX 超简单！**\n\n之前好多姐妹问我是怎么做的\n今天来出个详细教程！\n\n**📝 准备材料：**\n1. XXXXXX\n2. XXXXXX\n3. XXXXXX\n\n**👣 步骤：**\n第一步：先做XX，注意不要XX\n第二步：然后XX，这里有个 *小技巧* ～\n第三步：最后XX，就完成啦！\n\n**💡 划重点：**\n一定要记住这一点，不然容易翻车！\n\n#教程 #干货 #学习方法 #轻松学会',
  travel: '✈️ **我在XX待了3天 真的不想回家了**\n\n终于来了心心念念的XX！\n分享一下我的旅行攻略～\n\n**📍 路线推荐：**\nDay1: XXX → XXX → XXX\nDay2: XXX → XXX → XXX\nDay3: XXX → XXX → XXX\n\n**🍜 美食推荐：**\nXX家的XXX真的绝了！一定要去！\n\n**📸 拍照机位：**\n这几个地方超级出片！\n\n**🏨 住宿：**\n住在XX区真的很方便\n\n快收藏起来，下次出发用！\n\n#旅行攻略 #旅游打卡 #说走就走 #XX旅行',
  review: '🔍 **XX vs XX 到底哪个值得买？**\n\n两款网红产品都用了一个月\n今天来给大家做个 **真实测评**\n\n**📦 外观：**\nXX：颜值高，但容易沾指纹\nXX：磨砂质感，手感更好\n\n**⚡ 使用体验：**\nXX：操作简单，但功能少\nXX：功能丰富，*学习成本略高*\n\n**💰 价格：**\nXX：¥199\nXX：¥259\n\n**✅ 结论：**\n追求性价比选 XX\n追求功能选 XX\n\n**💡 建议：**\n如果你是新手，先从 XX 入手\n\n#测评对比 #真实体验 #买前必看 #踩雷还是种草',
  fashion: '👗 **今日穿搭｜简约不简单**\n\n身高 165cm | 体重 50kg\n这身真的太显气质了！\n\n**👚 上衣：**\nXX家基础款白衬衫\n版型很正，不会透\n\n**👖 下装：**\n高腰阔腿牛仔裤\n巨显腿长！小个子也能穿\n\n**👟 鞋子：**\n白色帆布鞋\n百搭神器，怎么搭都不会错\n\n**👜 配饰：**\n棕色托特包\n同色系腰带\n\n**📌 穿搭公式：**\n**上紧下松 + 同色系** 永远不会出错\n\n**🏷️ 品牌：**\n上衣：XX\n裤子：XX\n鞋：XX\n\n#穿搭分享 #日常穿搭 #显高穿搭 #简约风格',
  food: '🍽️ **终于去了这家店 真的没让我失望**\n\n被种草了好久！周末终于安排上了\n\n**📍 地址：**\nXX区XX路XX号\n地铁X号线XX站步行5分钟\n\n**🌿 环境：**\n工业风装修，很适合拍照📸\n座位间距大，不拥挤\n\n**🍴 推荐菜：**\n**1. XX招牌菜** ⭐⭐⭐⭐⭐\n入口即化，酱汁绝了\n**2. XX特色菜** ⭐⭐⭐⭐\n味道不错，分量有点小\n**3. XX甜品** ⭐⭐⭐⭐⭐\n必点！不会太甜\n\n**💰 人均：**\n¥120/人\n\n**💡 小贴士：**\n周末建议提前预约\n附近有停车场\n\n#美食探店 #周末去哪吃 #我的私藏美食 #打卡',
  book: '📚 **读完《XX》我悟了 5 个人生道理**\n\n花了三天读完这本书\n真的是 **相见恨晚**\n\n**📖 关于这本书：**\n作者：XXX\n类型：自我成长\n评分：⭐️⭐️⭐️⭐️⭐️\n\n**💡 最触动的 5 个点：**\n\n**1. 关于选择**\n人生没有标准答案\n每个选择都是最好的安排\n\n**2. 关于成长**\n*痛苦是成长的必经之路*\n不要害怕失败\n\n**3. 关于关系**\n高质量的独处 > 低质量的社交\n\n**4. 关于时间**\n把时间花在值得的事情上\n\n**5. 关于幸福**\n幸福不是拥有的多\n而是计较的少\n\n**📝 我的感悟：**\n这本书改变了我很多想法\n强烈推荐给每一个迷茫的人\n\n#读书笔记 #好书推荐 #读书心得 #个人成长',
  tips: '💡 **这10个XX技巧 后悔没早知道**\n\n花了一个月整理的 **干货合集**\n建议先收藏再看！\n\n**📌 技巧清单：**\n\n**1️⃣ 第一个技巧**\n详细说明使用方法\n\n**2️⃣ 第二个技巧**\n这里有一个 *关键点* 要注意\n\n**3️⃣ 第三个技巧**\n搭配XX效果更好\n\n**4️⃣ 第四个技巧**\n很多人不知道的隐藏功能\n\n**5️⃣ 第五个技巧**\n懒人必备，省时省力\n\n**6️⃣ 第六个技巧**\n实现效果翻倍\n\n**7️⃣ 第七个技巧**\n进阶玩法\n\n**8️⃣ 第八个技巧**\n避开这个坑\n\n**9️⃣ 第九个技巧**\n超简单的实现方法\n\n**🔟 第十个技巧**\n坚持一周就能看到效果\n\n**💡 总结：**\n技巧不在多，**坚持最重要**\n选几个适合自己的先做起来\n\n#干货合集 #实用技巧 #生活小妙招 #建议收藏'
};
document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const content = TEMPLATES[btn.dataset.template];
    if (content) {
      inputArea.value = content;
      updatePreview();
      pushHistory(content);
      showToast('✓ 已加载「' + btn.textContent + '」模板');
    }
  });
});

// ===== 草稿 =====
function getDrafts() { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]'); }
function saveDraft() {
  const text = inputArea.value;
  if (!text.trim()) { showToast('没有内容可保存'); return; }
  const drafts = getDrafts();
  drafts.unshift({ text, style: currentStyle, time: Date.now() });
  if (drafts.length > 10) drafts.pop();
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  renderDrafts();
  showToast('✓ 草稿已保存');
  $('saveDraftBtn').style.transform = 'scale(1.1)';
  setTimeout(() => $('saveDraftBtn').style.transform = '', 200);
}
function deleteDraft(index) {
  const d = getDrafts();
  d.splice(index, 1);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(d));
  renderDrafts();
  showToast('已删除草稿');
}
function formatTime(ts) {
  const d = new Date(ts), n = new Date();
  const diff = Math.floor((n - d) / 60000);
  if (diff < 1) return '刚刚';
  if (diff < 60) return diff + '分钟前';
  if (diff < 1440) return Math.floor(diff / 60) + '小时前';
  return (d.getMonth()+1) + '/' + d.getDate();
}
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function renderDrafts() {
  const drafts = getDrafts();
  draftCount.textContent = drafts.length + ' 条';
  if (drafts.length === 0) {
    draftList.innerHTML = '<div class="draft-empty">暂无草稿 · 写点东西保存试试</div>';
    return;
  }
  draftList.innerHTML = drafts.slice(0, 5).map((d, i) => {
    const lines = d.text.trim().split('\n');
    const title = lines[0].replace(/[*#~]/g,'').trim().slice(0, 28);
    const snip = lines.slice(1).join(' ').replace(/[*#~]/g,'').trim().slice(0, 36);
    return '<div class="draft-item" data-index="' + i + '">' +
      '<div class="draft-item-body">' +
        '<div class="draft-item-title">' + escHtml(title || '(空)') + '</div>' +
        '<div class="draft-item-snip">' + escHtml(snip || '') + '</div>' +
      '</div>' +
      '<div class="draft-item-meta">' +
        '<span class="draft-item-time">' + formatTime(d.time) + '</span>' +
        '<button class="draft-item-del" title="删除">✕</button>' +
      '</div></div>';
  }).join('');
  draftList.querySelectorAll('.draft-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.draft-item-del')) return;
      const idx = parseInt(el.dataset.index);
      const d = getDrafts()[idx];
      if (d) { inputArea.value = d.text; updatePreview(); pushHistory(d.text); showToast('✓ 已加载草稿'); }
    });
  });
  draftList.querySelectorAll('.draft-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.closest('.draft-item').dataset.index);
      if (confirm('删除这条草稿？')) deleteDraft(idx);
    });
  });
}
$('saveDraftBtn').addEventListener('click', saveDraft);

// ===== 输入事件 =====
inputArea.addEventListener('input', () => {
  updatePreview();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const t = inputArea.value.trim();
    if (t) {
      localStorage.setItem(AUTOSAVE_KEY, t);
      autoSaveInd.classList.add('show');
      setTimeout(() => autoSaveInd.classList.remove('show'), 2000);
    }
  }, 800);
});

// ===== 复制 =====
copyBtn.addEventListener('click', async () => {
  const text = previewArea.textContent;
  if (!text.trim()) { showToast('没有内容可复制'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('✓ 已复制到剪贴板！');
    copyBtn.style.transform = 'scale(0.95)';
    setTimeout(() => copyBtn.style.transform = '', 150);
  } catch { showToast('复制失败，请手动选中复制'); }
});

// ===== 排版风格 =====
document.querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStyle = btn.dataset.style;
    updatePreview();
  });
});

// ===== 行距 =====
document.querySelectorAll('.spacing-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.spacing-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSpacing = btn.dataset.spacing;
    updatePreview();
  });
});

// ===== 对齐 =====
document.querySelectorAll('.align-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAlign = btn.dataset.align;
    updatePreview();
  });
});

// ===== 深色模式 =====
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.querySelector('.icon-moon').style.display = 'none';
    document.querySelector('.icon-sun').style.display = '';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.querySelector('.icon-moon').style.display = '';
    document.querySelector('.icon-sun').style.display = 'none';
  }
}
themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  localStorage.setItem(THEME_KEY, isDark ? 'light' : 'dark');
  loadTheme();
  themeToggle.style.transform = 'rotate(30deg)';
  setTimeout(() => themeToggle.style.transform = '', 300);
});

// ===== Pro =====
proBtn.addEventListener('click', (e) => { e.preventDefault(); proModal.classList.add('show'); });
proModalClose.addEventListener('click', () => proModal.classList.remove('show'));
proModal.addEventListener('click', (e) => { if (e.target === proModal) proModal.classList.remove('show'); });

// ===== Toast =====
function showToast(msg, type) {
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ' toast-' + type : '');
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ===== 快捷键 =====
document.addEventListener('keydown', (e) => {
  const c = e.ctrlKey || e.metaKey;
  if (c && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if (c && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  if (c && e.key === 'Enter') { e.preventDefault(); copyBtn.click(); }
  if (c && e.key === 's') { e.preventDefault(); saveDraft(); }
});

// ===== 初始化 =====
loadTheme();
renderDrafts();
const autoSaved = localStorage.getItem(AUTOSAVE_KEY);
if (autoSaved) {
  inputArea.value = autoSaved;
  showToast('💡 已恢复上次编辑的内容');
}
updatePreview();
pushHistory(inputArea.value);
setTimeout(() => showToast('✨ 红笔已准备好，开始写文案吧！'), 600);

// ===== 导出图片 =====
async function exportImage() {
  const formatted = formatText(inputArea.value, currentStyle);
  const rendered = renderMarkdown(formatted);
  if (!rendered) { showToast('没有内容可导出'); return; }

  const W = 1080, H = 1440;
  const lh = lineHeightValue(currentSpacing);
  const align = currentAlign === 'left' ? 'start' : currentAlign === 'center' ? 'center' : 'end';

  // 构建图片 HTML（内联样式，用于 SVG foreignObject）
  const style = `
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      width:${W}px; height:${H}px;
      font-family:"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;
      padding:56px 48px 48px;
      background:white;
      line-height:${lh};
      text-align:${align};
      color:#2c2c2c;
      font-size:28px;
      word-wrap:break-word;
      overflow:hidden;
      position:relative;
    }
    .header-bar {
      position:absolute; top:0; left:0; right:0; height:6px;
      background:linear-gradient(90deg,#E84C4C,#d63031);
    }
    .content { height:calc(100vh - 100px); overflow:hidden; }
    strong { font-weight:700; color:#1a1a1a; }
    em { font-style:italic; }
    del { text-decoration:line-through; color:#999; }
    .hashtag { color:#E84C4C; font-weight:600; }
    .footer {
      position:absolute; left:0; right:0; bottom:32px;
      text-align:center; font-size:18px; color:#ccc;
      letter-spacing:1px;
    }
    .footer span { color:#E84C4C; }
  `;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${style}</style></head>
<body>
<div class="header-bar"></div>
<div class="content">${rendered}</div>
<div class="footer">—— <span>红笔</span> · 让你的笔记更好看 ——</div>
</body></html>`;

  try {
    // 方法 1: SVG foreignObject → Blob
    const svgData = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <foreignObject width="100%" height="100%">
          ${html}
        </foreignObject>
      </svg>`
    )}`;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = svgData;
    });

    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) { showToast('导出失败，请重试'); return; }
      // 尝试用 File System Access API 保存
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: '红笔_' + new Date().toISOString().slice(0,10) + '.png',
          types: [{ description: 'PNG 图片', accept: { 'image/png': ['.png'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('✓ 图片已保存');
      } catch {
        // 降级：直接下载
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '红笔_' + Date.now() + '.png';
        a.click();
        URL.revokeObjectURL(url);
        showToast('✓ 图片已导出');
      }
    });
  } catch (e) {
    showToast('导出图片失败，可尝试截图预览区');
    console.error('export error:', e);
  }
}
$('exportBtn').addEventListener('click', exportImage);
