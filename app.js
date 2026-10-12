/* IT07 Practice – exam-style multiple choice. Progress is saved in localStorage. */
const Q = window.QUESTIONS;
const BYID = Object.fromEntries(Q.map(q => [q.id, q]));
const $ = id => document.getElementById(id);
const SKEY = 'it07-practice-session-v1', PKEY = 'it07-practice-prefs-v1';

const IC = {
  check:'<path d="M20 6 9 17l-5-5"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>', arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', left:'<path d="M19 12H5M11 6l-6 6 6 6"/>',
  cap:'<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  flag:'<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>', info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  zoom:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  redo:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', home:'<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="M15.5 13.9 17 22l-5-3-5 3 1.5-8.1"/>', target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
document.querySelectorAll('i[data-ic]').forEach(el => { el.outerHTML = ic(el.dataset.ic); });

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fixedLast = t => /^(all\b|none of)/i.test(t);
const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const PART = {L:'LMS · Lecturer set', A:'Practice · Part 1 · Google Workspace & Data', N:'Practice · Part 2 · Notes', C:'Practice · Part 3 · Digital Life & CODE.ORG'};
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

let deck = [], cur = 0, mode = 'practice', t0 = 0, tick = null, elapsed = 0, lastWrong = [], phase = 'home';
function view(id) { phase = id; ['home','exam','result'].forEach(v => $(v).classList.toggle('hidden', v !== id)); }
function ui(on) { ['timer','ans','finish','quit','saved'].forEach(i => $(i).classList.toggle('hidden', !on)); $('palBtn').classList.toggle('hidden', !on); }

/* ---------- persistence ---------- */
function save() {
  if (phase === 'home') return;
  store.set(SKEY, { phase, ids: deck.map(d => d.q.id), opts: deck.map(d => d.opts), picks: deck.map(d => d.pick), flags: deck.map(d => d.flag), cur, mode, elapsed });
}
function restore() {
  const s = store.get(SKEY);
  if (!s || !Array.isArray(s.ids) || !s.ids.every(id => BYID[id])) return false;
  deck = s.ids.map((id, i) => ({ q: BYID[id], opts: s.opts[i], pick: s.picks[i], flag: !!s.flags[i] }));
  if (!deck.length || deck.some(d => !d.opts || !d.opts.includes(d.q.a))) return false;
  mode = s.mode || 'practice'; cur = Math.min(s.cur || 0, deck.length - 1); elapsed = s.elapsed || 0;
  if (s.phase === 'result') { buildGrid(); showResult(); return true; }
  runTimer(); view('exam'); ui(true); buildGrid(); render(); return true;
}
function savePrefs() {
  store.set(PKEY, { sets: ['L','A','N','C'].filter(s => $('s' + s).checked), shuf: $('oShuf').checked, w: $('oW').checked,
    pic: $('oPic').checked, miss: $('oMiss').checked, mode: document.querySelector('input[name=mode]:checked').value, count: +$('oCount').value });
}
function loadPrefs() {
  const p = store.get(PKEY); if (!p) return;
  ['L','A','N','C'].forEach(s => $('s' + s).checked = p.sets.includes(s));
  $('oShuf').checked = !!p.shuf; $('oW').checked = !!p.w; $('oPic').checked = p.pic !== false; $('oMiss').checked = !!p.miss;
  const m = document.querySelector(`input[name=mode][value=${p.mode}]`); if (m) m.checked = true;
  prefCount = p.count;
}
let prefCount = null;

/* ---------- home ---------- */
const qualifies = q => (!q.img ? !q.miss || $('oMiss').checked : $('oPic').checked) && (!$('oW').checked || q.set !== 'L' || q.w);
function pool() {
  const secs = ['L','A','N','C'].filter(s => $('s' + s).checked);
  return Q.filter(q => secs.includes(q.sec) && qualifies(q));
}
function refresh(reset) {
  const cnt = s => Q.filter(q => q.sec === s && qualifies(q)).length;
  ['L','A','N','C'].forEach(s => $('c' + s).textContent = cnt(s));
  $('pL').textContent = cnt('L') + ' questions'; $('pP').textContent = (cnt('A') + cnt('N') + cnt('C')) + ' questions'; $('pAll').textContent = (cnt('L') + cnt('A') + cnt('N') + cnt('C')) + ' questions';
  $('wN').textContent = `(${Q.filter(q => q.w).length})`;
  $('picN').textContent = `(${Q.filter(q => q.img).length})`; $('missN').textContent = `(${Q.filter(q => q.miss).length})`;
  const n = pool().length, r = $('oCount');
  r.max = Math.max(n, 1);
  if (prefCount != null) { r.value = Math.min(prefCount, n); prefCount = null; } else if (reset || +r.value > n) r.value = n;
  $('oOut').textContent = r.value; $('go').disabled = n === 0;
  const on = ['L','A','N','C'].filter(s => $('s' + s).checked).join('');
  document.querySelectorAll('.presets button').forEach(b => b.classList.toggle('on', ({lms:'L', pdf:'ANC', all:'LANC'})[b.dataset.preset] === on));
}
['sL','sA','sN','sC','oPic','oMiss','oW'].forEach(id => $(id).addEventListener('change', () => { refresh(true); savePrefs(); }));
['oShuf'].forEach(id => $(id).addEventListener('change', savePrefs));
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', savePrefs));
$('oCount').addEventListener('input', () => { $('oOut').textContent = $('oCount').value; savePrefs(); });
document.querySelectorAll('.presets button').forEach(b => b.onclick = () => {
  const m = {lms:['L'], pdf:['A','N','C'], all:['L','A','N','C']}[b.dataset.preset];
  ['L','A','N','C'].forEach(s => $('s' + s).checked = m.includes(s));
  refresh(true); savePrefs();
});

/* ---------- exam ---------- */
function makeItem(q) {
  let o = [q.a, ...q.d];
  const numeric = o.every(t => /^(Number |Picture )?\d+$|^(Picture )?[A-F]$/.test(t));
  o = numeric ? o.slice().sort((x, y) => x.localeCompare(y, undefined, {numeric: true})) : [...shuffle(o.filter(t => !fixedLast(t))), ...o.filter(fixedLast)];
  return {q, opts: o, pick: null, flag: false};
}
function runTimer() {
  clearInterval(tick); t0 = Date.now() - elapsed * 1000; $('tm').textContent = fmt(elapsed);
  tick = setInterval(() => { elapsed = Math.floor((Date.now() - t0) / 1000); $('tm').textContent = fmt(elapsed); if (elapsed % 5 === 0) save(); }, 1000);
}
function start(list) {
  deck = list.map(makeItem); cur = 0; mode = document.querySelector('input[name=mode]:checked').value; elapsed = 0;
  runTimer(); view('exam'); ui(true); buildGrid(); render(); save();
}
$('go').onclick = () => {
  let list = pool(); if (!list.length) return;
  if ($('oShuf').checked) list = shuffle(list);
  start(list.slice(0, Math.max(1, +$('oCount').value)));
};
function buildGrid() {
  $('grid').innerHTML = deck.map((_, i) => `<button data-i="${i}">${i + 1}</button>`).join('');
  $('grid').onclick = e => { const b = e.target.closest('button'); if (b) { go(+b.dataset.i); $('pal').classList.remove('open'); } };
  $('legend').innerHTML = mode === 'exam'
    ? '<span><i style="background:var(--red);border-color:var(--red)"></i>Answered</span><span><i></i>Not answered</span><span><i style="box-shadow:inset 0 -4px 0 #e0a100"></i>Marked</span>'
    : '<span><i style="background:var(--ok);border-color:var(--ok)"></i>Correct</span><span><i style="background:var(--bad);border-color:var(--bad)"></i>Wrong</span><span><i></i>Not answered</span><span><i style="box-shadow:inset 0 -4px 0 #e0a100"></i>Marked</span>';
}
function paint() {
  $('ansT').textContent = `${deck.filter(d => d.pick !== null).length}/${deck.length}`;
  [...$('grid').children].forEach((b, i) => {
    const d = deck[i]; b.className = '';
    if (d.pick !== null) b.classList.add(mode === 'exam' ? 'done' : (d.opts[d.pick] === d.q.a ? 'ok' : 'bad'));
    if (d.flag) b.classList.add('flagged');
    if (i === cur) b.classList.add('cur');
  });
}
function go(i) { cur = Math.max(0, Math.min(deck.length - 1, i)); render(); save(); }
function render() {
  const d = deck[cur], q = d.q;
  $('qno').textContent = `Question ${cur + 1} of ${deck.length}`;
  $('part').textContent = PART[q.sec] + (q.sec === 'N' ? '' : ' · #' + q.n);
  $('tags').innerHTML = (q.w ? ` <span class="tag">${ic('alert')} Missed before</span>` : '') + (q.unsure ? ` <span class="tag warn">${ic('info')} Answer unconfirmed</span>` : '');
  $('num').textContent = cur + 1;
  $('qt').textContent = q.q || '';
  $('flag').classList.toggle('on', d.flag);
  const p = $('pic');
  if (q.img) {
    const src = encodeURI(q.img);
    p.className = 'pic'; p.innerHTML = `<img alt="Question picture" src="${src}"><span class="zm">${ic('zoom')} Enlarge</span>`;
    p.querySelector('img').onerror = () => { p.className = 'nopic'; p.onclick = null; p.innerHTML = ic('image') + '<span>The picture file could not be loaded.</span>'; };
    p.onclick = () => { $('lb').querySelector('img').src = src; $('lb').classList.remove('hidden'); };
  } else if (q.miss) {
    p.className = 'nopic'; p.onclick = null; p.innerHTML = ic('image') + '<span>The picture for this question is missing in the source, so it cannot be shown.</span>';
  } else { p.className = ''; p.innerHTML = ''; p.onclick = null; }
  const box = $('opts'); box.innerHTML = '';
  d.opts.forEach((o, k) => {
    const b = document.createElement('button'); b.className = 'opt'; b.dataset.k = k;
    b.innerHTML = `<span class="k">${String.fromCharCode(65 + k)}</span><span>${esc(o)}</span>`;
    b.onclick = () => choose(k); box.appendChild(b);
  });
  style();
  $('prev').disabled = cur === 0;
  $('next').innerHTML = cur === deck.length - 1 ? 'Finish ' + ic('check') : 'Next ' + ic('arrow');
  $('qbody').scrollTop = 0; paint();
  const g = $('grid').children[cur]; g && g.scrollIntoView({block: 'nearest'});
}
function style() {
  const d = deck[cur], lock = mode === 'practice' && d.pick !== null;
  [...$('opts').children].forEach((b, k) => {
    b.className = 'opt'; b.disabled = lock;
    if (d.pick === k) b.classList.add('sel');
    if (lock) { if (d.opts[k] === d.q.a) { b.classList.remove('sel'); b.classList.add('ok'); } else if (d.pick === k) { b.classList.remove('sel'); b.classList.add('bad'); } }
  });
  const n = $('note');
  if ((lock || mode === 'exam') && d.q.note && lock) { n.innerHTML = ic('info') + '<span></span>'; n.lastChild.textContent = d.q.note; n.classList.remove('hidden'); } else n.classList.add('hidden');
  $('mid').textContent = lock ? (d.opts[d.pick] === d.q.a ? 'Correct' : 'Wrong · answer: ' + d.q.a) : '';
}
function choose(k) {
  const d = deck[cur];
  if (mode === 'practice' && d.pick !== null) return;
  d.pick = (mode === 'exam' && d.pick === k) ? null : k;
  style(); paint(); save();
}
$('flag').onclick = () => { deck[cur].flag = !deck[cur].flag; $('flag').classList.toggle('on', deck[cur].flag); paint(); save(); };
$('prev').onclick = () => go(cur - 1);
$('next').onclick = () => { if (cur === deck.length - 1) finishExam(); else go(cur + 1); };
$('finish').onclick = finishExam;
$('quit').onclick = () => { if (confirm('Quit this exam? Your saved answers will be cleared.')) { clearInterval(tick); store.del(SKEY); ui(false); view('home'); } };
$('palBtn').onclick = () => $('pal').classList.toggle('open');
$('lb').onclick = () => $('lb').classList.add('hidden');
addEventListener('keydown', e => {
  if (!$('lb').classList.contains('hidden')) { $('lb').classList.add('hidden'); return; }
  if ($('exam').classList.contains('hidden')) return;
  const k = e.key.toUpperCase();
  if (/^[A-F]$/.test(k) && deck[cur].opts[k.charCodeAt(0) - 65] !== undefined) choose(k.charCodeAt(0) - 65);
  else if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1);
});
addEventListener('beforeunload', () => { if (phase === 'exam') { elapsed = Math.floor((Date.now() - t0) / 1000); } save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

/* ---------- result ---------- */
function finishExam() {
  const left = deck.filter(d => d.pick === null).length;
  if (left && !confirm(`${left} question(s) not answered. Finish now?`)) return;
  clearInterval(tick); elapsed = Math.floor((Date.now() - t0) / 1000);
  view('result'); save(); showResult();
}
function showResult() {
  const n = deck.length, ok = deck.filter(d => d.pick !== null && d.opts[d.pick] === d.q.a).length;
  const skip = deck.filter(d => d.pick === null).length, bad = n - ok - skip, pct = Math.round(ok / n * 100), pass = pct >= 60;
  ui(false); view('result');
  $('pct').textContent = pct + '%'; $('rOk').textContent = ok; $('rBad').textContent = bad; $('rSkip').textContent = skip;
  $('verdict').className = 'verdict ' + (pass ? 'pass' : 'fail');
  $('verdict').innerHTML = ic(pass ? 'award' : 'target') + (pass ? 'Passed' : 'Not passed yet (60% needed)');
  $('rtime').textContent = `${ok} of ${n} correct · time ${fmt(elapsed)}`;
  lastWrong = deck.filter(d => !(d.pick !== null && d.opts[d.pick] === d.q.a));
  $('redo').classList.toggle('hidden', !lastWrong.length);
  $('revT').textContent = lastWrong.length ? `Review · ${lastWrong.length} to improve` : 'Review';
  $('review').innerHTML = lastWrong.length ? lastWrong.map(d => `<div class="rev"><div class="m">${PART[d.q.sec]}${d.q.sec === 'N' ? '' : ' · #' + d.q.n}</div>
      <b>${esc(d.q.q || 'Picture question')}</b><br>
      ${d.pick === null ? '<span class="no">Not answered</span>' : 'Your answer: <span class="no">' + esc(d.opts[d.pick]) + '</span>'}<br>
      Correct answer: <span class="yes">${esc(d.q.a)}</span></div>`).join('') : '<div class="rev"><b>No mistakes. Well done.</b></div>';
}
$('again').onclick = () => { store.del(SKEY); view('home'); };
$('redo').onclick = () => { if (lastWrong.length) start(shuffle(lastWrong.map(d => d.q))); };

/* ---------- boot ---------- */
loadPrefs();
refresh(false);
$('kTotal').textContent = Q.length;
if (!restore()) { ui(false); view('home'); }
