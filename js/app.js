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

// ===== 閹俱倝鏀?闁插秴浠?=====
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
  if (history.index <= 0) { showToast('濞屸剝婀侀崣顖涙寵闁库偓閻?); return; }
  history.index--;
  inputArea.value = history.stack[history.index].join('');
  inputArea.dispatchEvent(new Event('input', { bubbles: true }));
  showToast('閳?瀹稿弶鎸欓柨鈧?);
}
function redo() {
  if (history.index >= history.stack.length - 1) { showToast('濞屸剝婀侀崣顖炲櫢閸嬫氨娈?); return; }
  history.index++;
  inputArea.value = history.stack[history.index].join('');
  inputArea.dispatchEvent(new Event('input', { bubbles: true }));
  showToast('閳?瀹告煡鍣搁崑?);
}

// ===== Markdown 濞撳弶鐓?=====
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

// ===== 閹烘帞澧楀鏇熸惛 =====
function formatText(text, style) {
  if (!text.trim()) return '';
  let r = text.trim().replace(/\n{3,}/g, '\n\n');
  switch (style) {
    case 'clean': r = r.split('\n').map(l => l.trim()).join('\n'); break;
    case 'cute':
      r = r.split('\n\n').map((p, i) => {
        p = p.trim(); if (!p) return '';
        return ['棣冨碍','閴?,'棣冩寗','棣冨钒','棣冨皞','棣冩寙'][i%6] + ' ' + p;
      }).join('\n\n');
      break;
    case 'simple': r = r.split('\n').map(l => l.trim()).join('\n'); r = r.replace(/\n\n\n+/g, '\n\n'); break;
  }
  return r;
}
function lineHeightValue(s) { return { tight:'1.5', normal:'1.9', loose:'2.5' }[s] || '1.9'; }

// ===== 閺囧瓨鏌婃０鍕潔 =====
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
    previewArea.innerHTML = '<div class="preview-placeholder"><svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="margin-bottom:10px;opacity:0.3"><rect x="4" y="4" width="32" height="32" rx="4" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M12 16H28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 22H28" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 28H24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>閹烘帞澧楅弫鍫熺亯娴兼碍妯夌粈鍝勬躬鏉╂瑩鍣?/span></div>';
  }
  const t = raw.trim();
  statChars.textContent = t.length;
  statParagraphs.textContent = t ? t.split('\n\n').filter(p => p.trim()).length : 0;
  statReadTime.textContent = Math.ceil(t.length / 300) + 's';
}

// ===== 閸忓鐖ｉ幓鎺戝弳 =====
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

// ===== 閺嶇厧绱″銉ュ徔 =====
$('boldBtn').addEventListener('click', () => wrapSelection('**','**','閸旂姷鐭栭弬鍥х摟'));
$('italicBtn').addEventListener('click', () => wrapSelection('*','*','閺傛粈缍嬮弬鍥х摟'));
$('strikeBtn').addEventListener('click', () => wrapSelection('~~','~~','閸掔娀娅庣痪?));
$('hashBtn').addEventListener('click', () => wrapSelection('#','','鐠囨繈顣介弽鍥╊劮'));
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('spacingBtn').addEventListener('click', () => {
  inputArea.value = inputArea.value.replace(/\n{2,}/g,'\n\n').replace(/([^\n])\n([^\n])/g,'$1\n\n$2');
  inputArea.focus();
  updatePreview();
  pushHistory(inputArea.value);
  showToast('閴?瀹稿弶娅ら懗钘夊瀻濞?);
});
$('clearFormatBtn').addEventListener('click', () => {
  let t = inputArea.value;
  const before = t;
  t = t.replace(/\*\*(.+?)\*\*/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/~~(.+?)~~/g,'$1').replace(/#([\u4e00-\u9fff\w]+)/g,'$1');
  if (t === before) { showToast('濞屸剝婀侀弽鐓庣础闂団偓鐟曚焦绔婚梽?); return; }
  inputArea.value = t;
  updatePreview();
  pushHistory(t);
  showToast('棣冃?瀹稿弶绔婚梽銈嗗閺堝鐗稿?);
});
$('clearBtn').addEventListener('click', () => {
  if (inputArea.value.trim() && !confirm('绾喖鐣惧〒鍛敄閸忋劑鍎撮崘鍛啇閿?)) return;
  inputArea.value = '';
  updatePreview();
  pushHistory('');
});

// ===== 濡剝婢?=====
const TEMPLATES = {
  recommend: '閴傘倧绗?鐞氼偊妫堕悿顖欑啊閿涗浇绻栨稉鐚塜閹存垹婀￠惃鍕窗閸ョ偠鍠樻稉鈧稉鍥偧\n\n婵劕顬呮禒顒婄磼閺堚偓鏉╂垶瀵查崚鎵畱鏉╂瑤閲淴X閻喓娈戠紒婵呯啊閿涘本鍨滆箛鍛淬€忛崚鍡曢煩缂佹瑤缍樻禒顒婄磼\n\n**棣冨皞 閸忓牐顕╂导妯煎仯閿?*\n1. 妫版粌鈧壈绉存姗堢礉閹峰灝婀幍瀣櫡鐠愩劍鍔呭鈥冲瀻\n2. 閺佸牊鐏夐惇鐔烘畱閹﹨澹嬮敍宀€鏁ゆ禍鍡欘儑娑撯偓濞嗏€虫皑閻栧彉绗傛禍鍝眓3. 娴犻攱鐗告稊鐔风发閸氬牏鎮婇敍灞锯偓褌鐜В鏃囩Т妤傛n\n**棣冩寱 鐏忓繗鍒涙竟顐窗**\n瀵ら缚顔呮径褍顔嶉幖顓㈠帳XX娑撯偓鐠ч鏁ら敍灞炬櫏閺嬫粎鐐曢崐宥忕稏\n\n**棣冩惗 閸忋儲澧滈弬鐟扮础閿?*\n鐠囧嫯顔戦崠楦款潌閸濓讣绱抃n\n#婵傜晫澧块幒銊ㄥ礃 #閹存垹娈戠€规繆妫?#閸婄厧绶遍崗銉﹀ #韫囧懍鎷卞〒鍛礋',
  daily: '閴?**娴犲﹥妫╂禒鐣屾畱瀵偓韫?閸掑棔闊╃紒娆庣稑娴?*\n\n娴犲﹤銇夋径鈺傜毜閻喓娈戞径顏勩偨娴滃棴绱抃n閸戞椽妫挧棰佺啊娑撯偓閸﹀牞绱濊箛鍐╁剰鐡掑懏顥楅敐鐎刵\n**閳解偓閿?娴犲﹥妫╃亸蹇曗€橀獮闈╃窗**\n閸犳繀绨＄搾鍛偨閸犳繄娈戦崪鏍ф殝閳芥槥n閻鍩屾禍鍡楀讲閻栬京娈戦悮顐ゅ皸棣冩儛\n閺€璺哄煂娴滃棙婀″鍛嚒娑斿懐娈戣箛顐︹偓鎺熺厠顩俷\n閻㈢喐妞块惇鐔烘畱闂団偓鐟曚浇绻栨禍娑樼毈鐏忓繒娈戣箛顐＄绾板海澧朶n閺€鎺曟崳閺夈儱姘ㄩ弰顖涘姬濠娾€冲灑缁傚繑鍔呴崨鈧鎸刓n\n#閺冦儱鐖堕崚鍡曢煩 #閻㈢喐妞跨喊搴ｅ #鐏忓繒鈥橀獮?#濞岀粯鍓ょ化?,
  tutorial: '棣冩憠 **閹靛濡搁幍瀣殌娴ｇ嚥X 鐡掑懐鐣濋崡鏇磼**\n\n娑斿澧犳總钘夘樋婵劕顬呴梻顔藉灉閺勵垱鈧簼绠為崑姘辨畱\n娴犲﹤銇夐弶銉ュ毉娑擃亣顕涚紒鍡樻殌缁嬪绱抃n\n**棣冩憫 閸戝棗顦弶鎰灐閿?*\n1. XXXXXX\n2. XXXXXX\n3. XXXXXX\n\n**棣冩噣 濮濄儵顎冮敍?*\n缁楊兛绔村銉窗閸忓牆浠沊X閿涘本鏁為幇蹇庣瑝鐟曚箚X\n缁楊兛绨╁銉窗閻掕泛鎮梄X閿涘矁绻栭柌灞炬箒娑?*鐏忓繑濡у? 閿濈€刵缁楊兛绗佸銉窗閺堚偓閸氬逗X閿涘苯姘ㄧ€瑰本鍨氶崯锔肩磼\n\n**棣冩寱 閸掓帡鍣搁悙鐧哥窗**\n娑撯偓鐎规俺顩︾拋棰佺秶鏉╂瑤绔撮悙鐧哥礉娑撳秶鍔х€硅妲楃紙鏄忔簠閿涗箺n\n#閺佹瑧鈻?#楠炶尪鎻?#鐎涳缚绡勯弬瑙勭《 #鏉炵粯婢楃€涳缚绱?,
  travel: '閴佸牞绗?**閹存垵婀猉X瀵板懍绨?婢?閻喓娈戞稉宥嗗厒閸ョ偛顔嶆禍?*\n\n缂佸牅绨弶銉ょ啊韫囧啫绺捐箛闈涘悍閻ㄥ垕X閿涗箺n閸掑棔闊╂稉鈧稉瀣灉閻ㄥ嫭姊剧悰灞炬暰閻ｃ儻缍朶n\n**棣冩惙 鐠侯垳鍤庨幒銊ㄥ礃閿?*\nDay1: XXX 閳?XXX 閳?XXX\nDay2: XXX 閳?XXX 閳?XXX\nDay3: XXX 閳?XXX 閳?XXX\n\n**棣冨椽 缂囧酣顥ら幒銊ㄥ礃閿?*\nXX鐎瑰墎娈慩XX閻喓娈戠紒婵呯啊閿涗椒绔寸€规俺顩﹂崢浼欑磼\n\n**棣冩懗 閹峰秶鍙庨張杞扮秴閿?*\n鏉╂瑥鍤戞稉顏勬勾閺傜绉寸痪褍鍤悧鍥风磼\n\n**棣冨剑 娴ｅ繐顔栭敍?*\n娴ｅ繐婀猉X閸栬櫣婀￠惃鍕发閺傞€涚┒\n\n韫囶偅鏁归挊蹇氭崳閺夈儻绱濇稉瀣偧閸戝搫褰傞悽顭掔磼\n\n#閺冨懓顢戦弨鑽ゆ殣 #閺冨懏鐖堕幍鎾冲幢 #鐠囩铔嬬亸杈泲 #XX閺冨懓顢?,
  review: '棣冩敵 **XX vs XX 閸掓澘绨抽崫顏冮嚋閸婄厧绶辨稊甯吹**\n\n娑撱倖顑欑純鎴犲娴溠冩惂闁晫鏁ゆ禍鍡曠娑擃亝婀€\n娴犲﹤銇夐弶銉х舶婢堆冾啀閸嬫矮閲?**閻喎鐤勫ù瀣槑**\n\n**棣冩憹 婢舵牞顫囬敍?*\nXX閿涙岸顤侀崐濂哥彯閿涘奔绲剧€硅妲楀▽鐐瘹缁剧nXX閿涙氨锛堥惍鍌濆窛閹扮噦绱濋幍瀣妳閺囨潙銈絓n\n**閳?娴ｈ法鏁ゆ担鎾荤崣閿?*\nXX閿涙碍鎼锋担婊呯暆閸楁洩绱濇担鍡楀閼宠棄鐨痋nXX閿涙艾濮涢懗鎴掕荡鐎靛矉绱?鐎涳缚绡勯幋鎰拱閻ｃ儵鐝?\n\n**棣冩尩 娴犻攱鐗搁敍?*\nXX閿涙?99\nXX閿涙?59\n\n**閴?缂佹捁顔戦敍?*\n鏉╄姤鐪伴幀褌鐜В鏃堚偓?XX\n鏉╄姤鐪伴崝鐔诲厴闁?XX\n\n**棣冩寱 瀵ら缚顔呴敍?*\n婵″倹鐏夋担鐘虫Ц閺傜増澧滈敍灞藉帥娴?XX 閸忋儲澧淺n\n#濞村鐦庣€佃鐦?#閻喎鐤勬担鎾荤崣 #娑旀澘澧犺箛鍛箙 #闊晠娴勬潻妯绘Ц缁夊秷宕?,
  fashion: '棣冩啿 **娴犲﹥妫╃粚鎸庢儗閿濇粎鐣濈痪锔跨瑝缁犫偓閸?*\n\n闊偊鐝?165cm | 娴ｆ捇鍣?50kg\n鏉╂瑨闊╅惇鐔烘畱婢额亝妯夊鏃囧窛娴滃棴绱抃n\n**棣冩喌 娑撳﹨銆傞敍?*\nXX鐎硅泛鐔€绾偓濞嗗墽娅х悰顒冿綖\n閻楀牆鐎峰鍫燁劀閿涘奔绗夋导姘垛偓寤玭\n**棣冩啽 娑撳顥婇敍?*\n妤傛鍙為梼鏃囧悪閻楁稐绮╃憗顦俷瀹搞劍妯夐懙鍧楁毐閿涗礁鐨稉顏勭摍娑旂喕鍏樼粚绺梟\n**棣冩喕 闂夊鐡欓敍?*\n閻у€熷鐢棗绔烽棄濯唍閻х偓鎯岀粊鐐叉珤閿涘本鈧簼绠為幖顓㈠厴娑撳秳绱伴柨姗絥\n**棣冩喐 闁板秹銈伴敍?*\n濡洝澹婇幍妯煎閸栧尲n閸氬矁澹婄化鏄忓彏鐢泜n\n**棣冩惗 缁屾寧鎯岄崗顒€绱￠敍?*\n**娑撳﹦鎻ｆ稉瀣緱 + 閸氬矁澹婄化?* 濮樻瓕绻欐稉宥勭窗閸戞椽鏁奬n\n**棣冨娇閿?閸濅胶澧濋敍?*\n娑撳﹨銆傞敍姝慩\n鐟併倕鐡欓敍姝慩\n闂夊绱癤X\n\n#缁屾寧鎯岄崚鍡曢煩 #閺冦儱鐖剁粚鎸庢儗 #閺勯箖鐝粚鎸庢儗 #缁犫偓缁撅箓顥撻弽?,
  food: '棣冨禂閿?**缂佸牅绨崢璁崇啊鏉╂瑥顔嶆惔?閻喓娈戝▽陇顔€閹存垵銇戦張?*\n\n鐞氼偆顫掗懡澶夌啊婵傛垝绠欓敍浣告噯閺堫偆绮撴禍搴＄暔閹烘帊绗傛禍鍝眓\n**棣冩惙 閸︽澘娼冮敍?*\nXX閸栫X鐠虹柨X閸欑﹥n閸︿即鎼閸欓鍤嶺X缁旀瑦顒炵悰?閸掑棝鎸揬n\n**棣冨岸 閻滎垰顣ㄩ敍?*\n瀹搞儰绗熸搴ゎ棅娣囶噯绱濆鍫モ偓鍌氭値閹峰秶鍙庨鎽砛n鎼囱傜秴闂傜绐涙径褝绱濇稉宥嗗閹割槀n\n**棣冨祱 閹恒劏宕橀懣婊愮窗**\n**1. XX閹锋稓澧濋懣?* 鐚告劏鐡欑尭鎰ㄧ摍鐚告€絥閸忋儱褰涢崡鍐插閿涘矂鍙″Ч浣虹卜娴滃摫n**2. XX閻楃澹婇懣?* 鐚告劏鐡欑尭鎰ㄧ摍\n閸涙娊浜炬稉宥夋晩閿涘苯鍨庨柌蹇旀箒閻愮懓鐨琝n**3. XX閻㈡粌鎼?* 鐚告劏鐡欑尭鎰ㄧ摍鐚告€絥韫囧懐鍋ｉ敍浣风瑝娴兼艾銇婇悽娣簄\n**棣冩尩 娴滃搫娼庨敍?*\n妤?20/娴滅n\n**棣冩寱 鐏忓繗鍒涙竟顐窗**\n閸涖劍婀楦款唴閹绘劕澧犳０鍕\n闂勫嫯绻庨張澶婁粻鏉烇箑婧€\n\n#缂囧酣顥ら幒銏犵暗 #閸涖劍婀崢璇叉憿閸?#閹存垹娈戠粔浣芥缂囧酣顥?#閹垫挸宕?,
  book: '棣冩憥 **鐠囪鐣妴濂╔閵嗗鍨滈幃鐔剁啊 5 娑擃亙姹夐悽鐔间壕閻?*\n\n閼哄彉绨℃稉澶娿亯鐠囪鐣潻娆愭拱娑旑泜n閻喓娈戦弰?**閻╂瓕顫嗛幁銊︽珓**\n\n**棣冩憠 閸忓厖绨潻娆愭拱娑旓讣绱?*\n娴ｆ粏鈧拑绱癤XX\n缁鐎烽敍姘冲殰閹存垶鍨氶梹绺梟鐠囧嫬鍨庨敍姘ｇ摍閿斿繆鐡欓敂蹇婄摍閿斿繆鐡欓敂蹇婄摍閿斿猾n\n**棣冩寱 閺堚偓鐟欙箑濮╅惃?5 娑擃亞鍋ｉ敍?*\n\n**1. 閸忓厖绨柅澶嬪**\n娴滆櫣鏁撳▽鈩冩箒閺嶅洤鍣粵鏃€顢峔n濮ｅ繋閲滈柅澶嬪闁姤妲搁張鈧總鐣屾畱鐎瑰甯揬n\n**2. 閸忓厖绨幋鎰版毐**\n*閻ユ稖瀚ら弰顖涘灇闂€璺ㄦ畱韫囧懐绮℃稊瀣熅*\n娑撳秷顩︾€硅櫕鈧洖銇戠拹顧\n**3. 閸忓厖绨崗宕囬兇**\n妤傛宸濋柌蹇曟畱閻欘剙顦?> 娴ｅ氦宸濋柌蹇曟畱缁€鍙ユ唉\n\n**4. 閸忓厖绨弮鍫曟？**\n閹跺﹥妞傞梻纾嬪С閸︺劌鈧厧绶遍惃鍕皑閹懍绗俓n\n**5. 閸忓厖绨獮鍝ヮ洿**\n楠炲摜顩存稉宥嗘Ц閹枫儲婀侀惃鍕樋\n閼板本妲哥拋陇绶濋惃鍕毌\n\n**棣冩憫 閹存垹娈戦幇鐔稿亐閿?*\n鏉╂瑦婀版稊锔芥暭閸欐ü绨￠幋鎴濈发婢舵碍鍏傚▔鏄瀗瀵櫣鍎撻幒銊ㄥ礃缂佹瑦鐦℃稉鈧稉顏囩碃閼碱偆娈戞禍绡璶\n#鐠囪鍔熺粭鏃囶唶 #婵傛垝鍔熼幒銊ㄥ礃 #鐠囪鍔熻箛鍐ㄧ繁 #娑擃亙姹夐幋鎰版毐',
  tips: '棣冩寱 **鏉?0娑撶寜X閹垛偓瀹?閸氬孩鍊插▽鈩冩－閻儵浜?*\n\n閼哄彉绨℃稉鈧稉顏呮箑閺佸鎮婇惃?**楠炶尪鎻ｉ崥鍫ユ肠**\n瀵ら缚顔呴崗鍫熸暪閽樺繐鍟€閻绱抃n\n**棣冩惗 閹垛偓瀹秆勭閸楁洩绱?*\n\n**1閿斿繆鍎?缁楊兛绔存稉顏呭Η瀹?*\n鐠囷妇绮忕拠瀛樻娴ｈ法鏁ら弬瑙勭《\n\n**2閿斿繆鍎?缁楊兛绨╂稉顏呭Η瀹?*\n鏉╂瑩鍣烽張澶夌娑?*閸忔娊鏁悙? 鐟曚焦鏁為幇寤玭\n**3閿斿繆鍎?缁楊兛绗佹稉顏呭Η瀹?*\n閹碱參鍘X閺佸牊鐏夐弴鏉戙偨\n\n**4閿斿繆鍎?缁楊剙娲撴稉顏呭Η瀹?*\n瀵板牆顦挎禍杞扮瑝閻儵浜鹃惃鍕閽樺繐濮涢懗绲搉\n**5閿斿繆鍎?缁楊兛绨叉稉顏呭Η瀹?*\n閹虫帊姹夎箛鍛槵閿涘瞼娓烽弮鍓佹阜閸旀矐n\n**6閿斿繆鍎?缁楊剙鍙氭稉顏呭Η瀹?*\n鐎圭偟骞囬弫鍫熺亯缂堣鈧硵n\n**7閿斿繆鍎?缁楊兛绔锋稉顏呭Η瀹?*\n鏉╂盯妯侀悳鈺傜《\n\n**8閿斿繆鍎?缁楊剙鍙撴稉顏呭Η瀹?*\n闁灝绱戞潻娆庨嚋閸ф叚n\n**9閿斿繆鍎?缁楊兛绡€娑擃亝濡у?*\n鐡掑懐鐣濋崡鏇犳畱鐎圭偟骞囬弬瑙勭《\n\n**棣冩晸 缁楊剙宕勬稉顏呭Η瀹?*\n閸ф碍瀵旀稉鈧崨銊ユ皑閼崇晫婀呴崚鐗堟櫏閺嬫泛n\n**棣冩寱 閹崵绮ㄩ敍?*\n閹垛偓瀹秆傜瑝閸︺劌顦块敍?*閸ф碍瀵旈張鈧柌宥堫洣**\n闁鍤戞稉顏堚偓鍌氭値閼奉亜绻侀惃鍕帥閸嬫俺鎹ｉ弶顧\n#楠炶尪鎻ｉ崥鍫ユ肠 #鐎圭偟鏁ら幎鈧?#閻㈢喐妞跨亸蹇擃浘閹?#瀵ら缚顔呴弨鎯版'
};
document.querySelectorAll('.template-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const content = TEMPLATES[btn.dataset.template];
    if (content) {
      inputArea.value = content;
      updatePreview();
      pushHistory(content);
      showToast('閴?瀹告彃濮炴潪濮愨偓? + btn.textContent + '閵嗗秵膩閺?);
    }
  });
});

// ===== 閼藉顭?=====
function getDrafts() { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]'); }
function saveDraft() {
  const text = inputArea.value;
  if (!text.trim()) { showToast('濞屸剝婀侀崘鍛啇閸欘垯绻氱€?); return; }
  const drafts = getDrafts();
  drafts.unshift({ text, style: currentStyle, time: Date.now() });
  if (drafts.length > 10) drafts.pop();
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  renderDrafts();
  showToast('閴?閼藉顭堝韫箽鐎?);
  $('saveDraftBtn').style.transform = 'scale(1.1)';
  setTimeout(() => $('saveDraftBtn').style.transform = '', 200);
}
function deleteDraft(index) {
  const d = getDrafts();
  d.splice(index, 1);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(d));
  renderDrafts();
  showToast('瀹告彃鍨归梽銈堝磸缁?);
}
function formatTime(ts) {
  const d = new Date(ts), n = new Date();
  const diff = Math.floor((n - d) / 60000);
  if (diff < 1) return '閸掓艾鍨?;
  if (diff < 60) return diff + '閸掑棝鎸撻崜?;
  if (diff < 1440) return Math.floor(diff / 60) + '鐏忓繑妞傞崜?;
  return (d.getMonth()+1) + '/' + d.getDate();
}
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function renderDrafts() {
  const drafts = getDrafts();
  draftCount.textContent = drafts.length + ' 閺?;
  if (drafts.length === 0) {
    draftList.innerHTML = '<div class="draft-empty">閺嗗倹妫ら懡澶岊焾 璺?閸愭瑧鍋ｆ稉婊嗐偪娣囨繂鐡ㄧ拠鏇＄槸</div>';
    return;
  }
  draftList.innerHTML = drafts.slice(0, 5).map((d, i) => {
    const lines = d.text.trim().split('\n');
    const title = lines[0].replace(/[*#~]/g,'').trim().slice(0, 28);
    const snip = lines.slice(1).join(' ').replace(/[*#~]/g,'').trim().slice(0, 36);
    return '<div class="draft-item" data-index="' + i + '">' +
      '<div class="draft-item-body">' +
        '<div class="draft-item-title">' + escHtml(title || '(缁?') + '</div>' +
        '<div class="draft-item-snip">' + escHtml(snip || '') + '</div>' +
      '</div>' +
      '<div class="draft-item-meta">' +
        '<span class="draft-item-time">' + formatTime(d.time) + '</span>' +
        '<button class="draft-item-del" title="閸掔娀娅?>閴?/button>' +
      '</div></div>';
  }).join('');
  draftList.querySelectorAll('.draft-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.draft-item-del')) return;
      const idx = parseInt(el.dataset.index);
      const d = getDrafts()[idx];
      if (d) { inputArea.value = d.text; updatePreview(); pushHistory(d.text); showToast('閴?瀹告彃濮炴潪鍊熷磸缁?); }
    });
  });
  draftList.querySelectorAll('.draft-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.closest('.draft-item').dataset.index);
      if (confirm('閸掔娀娅庢潻娆愭蒋閼藉顭堥敍?)) deleteDraft(idx);
    });
  });
}
$('saveDraftBtn').addEventListener('click', saveDraft);

// ===== 鏉堟挸鍙嗘禍瀣╂ =====
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

// ===== 婢跺秴鍩?=====
copyBtn.addEventListener('click', async () => {
  const text = previewArea.textContent;
  if (!text.trim()) { showToast('濞屸剝婀侀崘鍛啇閸欘垰顦查崚?); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('閴?瀹告彃顦查崚璺哄煂閸擃亣鍒涢弶鍖＄磼');
    copyBtn.style.transform = 'scale(0.95)';
    setTimeout(() => copyBtn.style.transform = '', 150);
  } catch { showToast('婢跺秴鍩楁径杈Е閿涘矁顕幍瀣З闁鑵戞径宥呭煑'); }
});

// ===== 閹烘帞澧楁搴㈢壐 =====
document.querySelectorAll('.style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStyle = btn.dataset.style;
    updatePreview();
  });
});

// ===== 鐞涘矁绐?=====
document.querySelectorAll('.spacing-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.spacing-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSpacing = btn.dataset.spacing;
    updatePreview();
  });
});

// ===== 鐎靛綊缍?=====
document.querySelectorAll('.align-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAlign = btn.dataset.align;
    updatePreview();
  });
});

// ===== 濞ｈ精澹婂Ο鈥崇础 =====
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

// ===== 韫囶偅宓庨柨?=====
document.addEventListener('keydown', (e) => {
  const c = e.ctrlKey || e.metaKey;
  if (c && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if (c && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  if (c && e.key === 'Enter') { e.preventDefault(); copyBtn.click(); }
  if (c && e.key === 's') { e.preventDefault(); saveDraft(); }
});

// ===== 閸掓繂顫愰崠?=====
loadTheme();
renderDrafts();
const autoSaved = localStorage.getItem(AUTOSAVE_KEY);
if (autoSaved) {
  inputArea.value = autoSaved;
  showToast('棣冩寱 瀹稿弶浠径宥勭瑐濞嗭紕绱潏鎴犳畱閸愬懎顔?);
}
updatePreview();
pushHistory(inputArea.value);
setTimeout(() => showToast('閴?缁俱垻鐟鎻掑櫙婢跺洤銈介敍灞界磻婵鍟撻弬鍥攳閸氀嶇磼'), 600);

// ===== 鐎电厧鍤崶鍓у =====
async function exportImage() {
  const formatted = formatText(inputArea.value, currentStyle);
  const rendered = renderMarkdown(formatted);
  if (!rendered) { showToast('濞屸剝婀侀崘鍛啇閸欘垰顕遍崙?); return; }

  const W = 1080, H = 1440;
  const lh = lineHeightValue(currentSpacing);
  const align = currentAlign === 'left' ? 'start' : currentAlign === 'center' ? 'center' : 'end';

  // 閺嬪嫬缂撻崶鍓у HTML閿涘牆鍞撮懕鏃€鐗卞蹇ョ礉閻劋绨?SVG foreignObject閿?  const style = `
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
<div class="footer">閳ユ柡鈧?<span>缁俱垻鐟?/span> 璺?鐠佲晙缍橀惃鍕應鐠佺増娲挎總鐣屾箙 閳ユ柡鈧?/div>
</body></html>`;

  try {
    // 閺傝纭?1: SVG foreignObject 閳?Blob
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
      if (!blob) { showToast('鐎电厧鍤径杈Е閿涘矁顕柌宥堢槸'); return; }
      // 鐏忔繆鐦悽?File System Access API 娣囨繂鐡?      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: '缁俱垻鐟猒' + new Date().toISOString().slice(0,10) + '.png',
          types: [{ description: 'PNG 閸ュ墽澧?, accept: { 'image/png': ['.png'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('閴?閸ュ墽澧栧韫箽鐎?);
      } catch {
        // 闂勫秶楠囬敍姘辨纯閹恒儰绗呮潪?        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '缁俱垻鐟猒' + Date.now() + '.png';
        a.click();
        URL.revokeObjectURL(url);
        showToast('閴?閸ュ墽澧栧鎻掝嚤閸?);
      }
    });
  } catch (e) {
    showToast('鐎电厧鍤崶鍓у婢惰精瑙﹂敍灞藉讲鐏忔繆鐦幋顏勬禈妫板嫯顫嶉崠?);
    console.error('export error:', e);
  }
}
$('exportBtn').addEventListener('click', exportImage);
// ===== Pro / 娴ｈ法鏁ゅ▎鈩冩殶缁崵绮?=====
const USAGE_KEY = 'hongbi_usage';
const PRO_KEY = 'hongbi_pro';
const DAILY_LIMIT = 3;
const usageRemaining = $('usageRemaining');
const usageUpgradeBtn = $('usageUpgradeBtn');
const proStatus = $('proStatus');
const proCodeInput = $('proCodeInput');
const proActivateBtn = $('proActivateBtn');
const proActivated = $('proActivated');
const proPayment = $('proPayment');

// 閺堝鏅ュ┑鈧ú鑽ょ垳閸掓銆冮敍鍫濈磻閸欐垼鈧懎褰插ǎ璇插閿?const ACTIVATION_CODES = {
  'TEST-HONGBI': 'test',     // 濞村鐦悽?  'PRO-2024-HB': 'premium'   // 妫板嫬鏁惍?};

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyUsage() {
  const data = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
  const today = getTodayStr();
  if (data.date !== today) return 0;
  return data.count || 0;
}

function incrementUsage() {
  const data = JSON.parse(localStorage.getItem(USAGE_KEY) || '{}');
  data.date = getTodayStr();
  data.count = (data.count || 0) + 1;
  localStorage.setItem(USAGE_KEY, JSON.stringify(data));
  updateUsageUI();
}

function isPro() {
  const pro = JSON.parse(localStorage.getItem(PRO_KEY) || '{}');
  if (!pro.active) return false;
  // 濡偓閺屻儲妲搁崥锕佺箖閺堢噦绱?0婢垛晪绱?  const expiry = new Date(pro.expiry || 0);
  return expiry > new Date();
}

function setPro(days) {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (days || 30));
  localStorage.setItem(PRO_KEY, JSON.stringify({ active: true, expiry: expiry.toISOString(), activated: Date.now() }));
  updateUsageUI();
  updateProModalUI();
}

function activatePro(code) {
  const upper = code.toUpperCase().trim();
  if (ACTIVATION_CODES[upper]) {
    setPro(30);
    showToast('棣冨竴 Pro 瀹稿弶绺哄ú浼欑磼閹扮喕闃块弨顖涘瘮閿?, 'success');
    proPayment.style.display = 'none';
    proActivated.style.display = 'block';
    proActivated.textContent = '閴?Pro 瀹稿弶绺哄ú浼欑礉閺堝鏅ラ張?30 婢垛晪绱掗幇鐔婚樋閺€顖涘瘮閿?;
    return true;
  }
  showToast('濠碘偓濞茶崵鐖滈弮鐘虫櫏閿涘矁顕Λ鈧弻銉ユ倵闁插秷鐦?, 'warning');
  return false;
}

function canUse() {
  if (isPro()) return true;
  return getDailyUsage() < DAILY_LIMIT;
}

// ===== 娴ｈ法鏁ゅ▎鈩冩殶 UI =====
function updateUsageUI() {
  if (isPro()) {
    usageRemaining.textContent = '閳?;
    usageRemaining.style.color = 'var(--primary)';
    usageUpgradeBtn.textContent = 'Pro 瀹稿弶绺哄ú?閴?;
    usageUpgradeBtn.style.color = '#4CAF50';
    return;
  }
  const remaining = DAILY_LIMIT - getDailyUsage();
  usageRemaining.textContent = Math.max(0, remaining);
  usageRemaining.style.color = 'var(--text)';
  usageUpgradeBtn.textContent = '閸楀洨楠?Pro 閳?;
  usageUpgradeBtn.style.color = 'var(--primary)';
}

function updateProModalUI() {
  if (isPro()) {
    proStatus.innerHTML = '<span class="pro-status-badge pro-status-pro">Pro 瀹稿弶绺哄ú?閴?/span>';
    proPayment.style.display = 'none';
    proCodeInput.style.display = 'none';
    proActivateBtn.style.display = 'none';
    proActivated.style.display = 'block';
    proActivated.textContent = '閴?Pro 瀹稿弶绺哄ú浼欑礉閹扮喕闃块弨顖涘瘮閿?;
  } else {
    proStatus.innerHTML = '<span class="pro-status-badge pro-status-free">閸忓秷鍨傞悧?/span>';
    proPayment.style.display = '';
    proCodeInput.style.display = '';
    proActivateBtn.style.display = '';
    proActivated.style.display = 'none';
  }
}

function checkUsageThen(action) {
  if (canUse()) {
    action();
    if (!isPro()) incrementUsage();
  } else {
    showToast('娴犲﹥妫╅崗宥堝瀭濞嗏剝鏆熷鑼暏鐎瑰矉绱濋崡鍥╅獓 Pro 娑撳秹妾哄▎鈩冩殶閿?, 'warning');
    setTimeout(() => proModal.classList.add('show'), 500);
  }
}

// ===== 娣囶喗鏁兼径宥呭煑閹稿鎸?=====
const originalCopyHandler = copyBtn._listeners ? copyBtn._listeners.click : null;
copyBtn.addEventListener('click', async function(e) {
  // 闂冪粯顒涢崢鐔告降閻?handler 闁插秴顦查幍褑顢戦敍宀€鏁ら弬鎵畱 checkUsageThen 閸栧懓锛?  e.stopImmediatePropagation();
  checkUsageThen(async () => {
    const text = previewArea.textContent;
    if (!text.trim()) { showToast('濞屸剝婀侀崘鍛啇閸欘垰顦查崚?); return; }
    try {
      await navigator.clipboard.writeText(text);
      showToast('閴?瀹告彃顦查崚璺哄煂閸擃亣鍒涢弶鍖＄磼' + (isPro() ? '' : '閿涘牆澧挎担?' + Math.max(0, DAILY_LIMIT - getDailyUsage()) + ' 濞嗏槄绱?));
      copyBtn.style.transform = 'scale(0.95)';
      setTimeout(() => copyBtn.style.transform = '', 150);
    } catch { showToast('婢跺秴鍩楁径杈Е閿涘矁顕幍瀣З闁鑵戞径宥呭煑'); }
  });
}, true);

// ===== 娣囶喗鏁肩€电厧鍤?=====
const originalExportHandler = null;
// 閸?exportImage 瀵偓婢舵潙濮炲Λ鈧弻?// 鏉╂瑤绔村銉ф纯閹恒儰鎱ㄩ弨?exportImage 閸戣姤鏆熷В鏃囩窛妤硅崵鍎查敍宀€鏁ら崠鍛邦棅閺傜懓绱?
// ===== 濠碘偓濞茶崵鐖滈幓鎰唉 =====
proActivateBtn.addEventListener('click', () => {
  const code = proCodeInput.value.trim();
  if (!code) { showToast('鐠囩柉绶崗銉︾负濞茶崵鐖?); return; }
  activatePro(code);
});

proCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') proActivateBtn.click();
});

// ===== 閸楀洨楠囬幐澶愭尦 =====
usageUpgradeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (isPro()) return;
  proModal.classList.add('show');
});

// ===== 閺囧瓨鏌?exportImage 閸旂姳濞囬悽銊︻梾閺?=====
// 婢跺洣鍞ら崢鐔峰毐閺?const _originalExport = window.exportImage || async function(){};
// 闁插秴鍟?window.exportImage = async function() {
  checkUsageThen(async () => {
    const formatted = formatText(inputArea.value, currentStyle);
    const rendered = renderMarkdown(formatted);
    if (!rendered) { showToast('濞屸剝婀侀崘鍛啇閸欘垰顕遍崙?); return; }

    const W = 1080, H = 1440;
    const lh = lineHeightValue(currentSpacing);
    const align = currentAlign === 'left' ? 'start' : currentAlign === 'center' ? 'center' : 'end';

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
      .header-bar { position:absolute; top:0; left:0; right:0; height:6px;
        background:linear-gradient(90deg,#E84C4C,#d63031); }
      .content { height:calc(100vh - 120px); overflow:hidden; }
      strong { font-weight:700; color:#1a1a1a; }
      em { font-style:italic; }
      del { text-decoration:line-through; color:#999; }
      .hashtag { color:#E84C4C; font-weight:600; }
      .footer { position:absolute; left:0; right:0; bottom:32px;
        text-align:center; font-size:18px; color:#ccc; letter-spacing:1px; }
      .footer span { color:#E84C4C; }
      .watermark { position:absolute; bottom:60px; right:48px;
        font-size:14px; color:rgba(0,0,0,0.08); }
    `;

    const footerHtml = isPro()
      ? '<div class="footer">閳ユ柡鈧?<span>缁俱垻鐟?/span> 璺?鐠佲晙缍橀惃鍕應鐠佺増娲挎總鐣屾箙 閳ユ柡鈧?/div>'
      : '<div class="footer">閳ユ柡鈧?<span>缁俱垻鐟?/span> 璺?鐠佲晙缍橀惃鍕應鐠佺増娲挎總鐣屾箙 閳ユ柡鈧?/div><div class="watermark">閸忓秷鍨傞悧?璺?閸楀洨楠?Pro 閸樼粯鎸夐崡?/div>';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${style}</style></head><body><div class="header-bar"></div><div class="content">${rendered}</div>${footerHtml}</body></html>`;

    try {
      const svgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`
      );
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
        if (!blob) { showToast('鐎电厧鍤径杈Е'); return; }
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: '缁俱垻鐟猒' + new Date().toISOString().slice(0,10) + '.png',
            types: [{ description:'PNG 閸ュ墽澧?, accept:{'image/png':['.png']} }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = '缁俱垻鐟猒' + Date.now() + '.png';
          a.click();
          URL.revokeObjectURL(url);
        }
        showToast('閴?閸ュ墽澧栧鎻掝嚤閸? + (isPro() ? '' : '閿涘牆澧挎担?' + Math.max(0, DAILY_LIMIT - getDailyUsage()) + ' 濞嗏槄绱?));
      });
    } catch(e) {
      showToast('鐎电厧鍤径杈Е閿涘苯褰茬亸婵婄槸閹搭亜娴?);
      console.error(e);
    }
  });
};

// ===== Pro 瀵湱鐛ラ幍鎾崇磻閺冭埖娲块弬?=====
const _origProOpen = proBtn._origProOpen;
proBtn.addEventListener('click', (e) => {
  e.preventDefault();
  updateProModalUI();
  proModal.classList.add('show');
});

// ===== 閸掓繂顫愰崠鏍﹀▏閻劍顐奸弫鐗堟▔缁€?=====
updateUsageUI();
updateProModalUI();
// ===== 导出按钮拦截（使用次数检查） =====
$('exportBtn').addEventListener('click', function(e) {
  if (!canUse() && !isPro()) {
    e.stopImmediatePropagation();
    showToast('今日免费次数已用完，升级 Pro 不限次数！', 'warning');
    setTimeout(() => proModal.classList.add('show'), 500);
  } else if (!isPro()) {
    // 免费用户使用前扣减
    incrementUsage();
    updateUsageUI();
  }
}, true);
