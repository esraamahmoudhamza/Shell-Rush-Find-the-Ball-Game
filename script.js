/* script.js — Final implementation
   - 3-second peek with ball visible under chosen cup
   - cups lower and then shuffle with difficulty speeds
   - after shuffle, player can pick a cup
   - no global redeclare; responsive slot calculation
*/

const DIFFICULTY = {
  easy:   { swaps: 8,  speed: 700, peek: 3000 },
  medium: { swaps: 14, speed: 420, peek: 3000 },
  hard:   { swaps: 24, speed: 260, peek: 3000 },
};

const state = {
  positions: [0,1,2], // logical cup ids occupying visual slots left->right
  ballHolder: 0,      // logical cup id that hides the ball
  isShuffling: false,
  revealed: false,
  score: 0,
  rounds: 0
};

// DOM refs (initialized on DOMContentLoaded)
let cups, slotsEl, ballEl, startBtn, resetBtn, levelSelect, messageEl, scoreEl, roundsEl, speedValEl, confettiEl;

// slots centers (x coords)
let slotsX = [];

function q(selector){ return document.querySelector(selector); }
function qa(selector){ return Array.from(document.querySelectorAll(selector)); }

function computeSlots() {
  if (!slotsEl) return [];
  const rect = slotsEl.getBoundingClientRect();
  const centers = [];
  qa('.cup').forEach(c => {
    const r = c.getBoundingClientRect();
    centers.push(r.left - rect.left + r.width/2);
  });
  return centers;
}

function applyPositions() {
  // ensure slotsX
  if (!slotsX || slotsX.length < 3) slotsX = computeSlots();
  if (!slotsX || slotsX.length < 3) return;

  // place cups visually according to state.positions
  // each cup element has data-id (logical id). we set transform to center on the slot center.
  const parentRect = slotsEl.getBoundingClientRect();
  qa('.cup').forEach(el => {
    const logicalId = Number(el.getAttribute('data-id'));
    const visualIndex = state.positions.indexOf(logicalId); // where this logical cup sits visually
    const centerX = slotsX[visualIndex];
    const offset = centerX - parentRect.width/2;
    el.style.left = `${50 + (offset / parentRect.width) * 100}%`;
    el.style.transform = el.classList.contains('peek') || el.classList.contains('revealed') ? el.style.transform : 'translateX(-50%)';
  });

  // position ball under visual position of ballHolder
  const ballVisual = state.positions.indexOf(state.ballHolder);
  const cx = slotsX[ballVisual];
  const parentW = parentRect.width || 1;
  const percent = 50 + (cx - parentW/2)/parentW*100;
  ballEl.style.left = `${percent}%`;
}

function setMessage(txt) { if (messageEl) messageEl.innerHTML = txt; }
function setScore(n) { state.score = n; if (scoreEl) scoreEl.textContent = n; }
function setRounds(n) { state.rounds = n; if (roundsEl) roundsEl.textContent = n; }
function updateSpeedDisplay() {
  if (!levelSelect || !speedValEl) return;
  const lvl = levelSelect.value;
  speedValEl.textContent = DIFFICULTY[lvl].speed + ' ms';
}

/* peek: raise cups and show ball under chosen logical cup */
function peekPhase() {
  // show ball and lift the cup that hides it
  ballEl.classList.remove('hidden');
  // lift visually by adding .peek to the visual cup
  const visualIndex = state.positions.indexOf(state.ballHolder);
  const el = qa('.cup')[visualIndex];
  if (el) el.classList.add('peek');
  setMessage('Peeking...');

  // after peek duration, remove peek class (lower cup) and hide ball, then start shuffling
  const lvl = levelSelect.value;
  setTimeout(() => {
    if (el) el.classList.remove('peek');
    ballEl.classList.add('hidden');
    setTimeout(() => { startShuffle(DIFFICULTY[lvl].swaps, DIFFICULTY[lvl].speed); }, 220);
  }, DIFFICULTY[lvl].peek);
}

/* shuffle logic: random pair swaps with timing */
function startShuffle(swaps, speed) {
  state.isShuffling = true;
  setMessage('Shuffling...');
  // disable clicking style
  qa('.cup').forEach(c => c.classList.add('disabled'));

  let i = 0;
  function doSwap() {
    if (i >= swaps) {
      // end
      state.isShuffling = false;
      qa('.cup').forEach(c => c.classList.remove('disabled'));
      setMessage('Pick a cup!');
      return;
    }

    // choose two distinct visual indices to swap
    let a = Math.floor(Math.random()*3);
    let b = Math.floor(Math.random()*3);
    while (b === a) b = Math.floor(Math.random()*3);

    // swap logical cups in state.positions at visual indices a and b
    const pos = state.positions.slice();
    const tmp = pos[a]; pos[a] = pos[b]; pos[b] = tmp;
    state.positions = pos;

    // quick peek flair on swapped cups
    const elA = qa('.cup')[a]; const elB = qa('.cup')[b];
    if (elA) { elA.classList.add('peek'); setTimeout(()=>elA.classList.remove('peek'), Math.min(180, speed-40)); }
    if (elB) { elB.classList.add('peek'); setTimeout(()=>elB.classList.remove('peek'), Math.min(180, speed-40)); }

    // apply visual transform
    applyPositions();

    i++;
    // jitter for natural feel
    const jitter = Math.round((Math.random()-0.5) * (speed * 0.25));
    setTimeout(doSwap, Math.max(80, speed + jitter));
  }

  doSwap();
}

/* handle player pick (visual index) */
function onPick(visualIndex) {
  if (state.isShuffling || state.revealed) return;
  state.revealed = true;

  // find which logical cup sits at visualIndex
  const logical = state.positions[visualIndex];

  // reveal ball under correct cup (visual)
  const ballVisual = state.positions.indexOf(state.ballHolder);
  const revealEl = qa('.cup')[ballVisual];
  if (revealEl) revealEl.classList.add('revealed');
  ballEl.classList.remove('hidden');

  // check
  const correct = logical === state.ballHolder;
  if (correct) {
    setMessage('Correct! You found it!');
    setScore(state.score + 1);
    confettiEl.classList.add('show'); setTimeout(()=>confettiEl.classList.remove('show'),900);
    playBeep(880, 0.06);
  } else {
    setMessage('Not this one. Try next round.');
    playBeep(220, 0.12);
  }
  setRounds(state.rounds + 1);

  // after short delay hide reveal and reset revealed flag
  setTimeout(()=> {
    if (revealEl) revealEl.classList.remove('revealed');
    ballEl.classList.add('hidden');
    state.revealed = false;
  }, 900);
}

/* start a round: choose ball holder, show peek, then shuffle */
function startRound() {
  if (state.isShuffling) return;
  // reset visual positions to identity (left->right 0,1,2)
  state.positions = [0,1,2];
  // choose random logical cup to hide ball
  state.ballHolder = Math.floor(Math.random()*3);
  // ensure layout computed
  slotsX = computeSlots();
  applyPositions();
  // show speed
  updateSpeedDisplay();
  // do peek
  peekPhase();
}

/* small beep (synth) for feedback */
function playBeep(freq=440,duration=0.08){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    setTimeout(()=>{ o.stop(); ctx.close(); }, duration*1000+30);
  }catch(e){}
}

/* Setup after DOM ready */
document.addEventListener('DOMContentLoaded', ()=> {
  cups = qa('.cup');
  slotsEl = q('.slots');
  ballEl = q('#ball');
  startBtn = q('#startBtn');
  resetBtn = q('#resetBtn');
  levelSelect = q('#level');
  messageEl = q('#message');
  scoreEl = q('#score');
  roundsEl = q('#rounds');
  speedValEl = q('#speedVal') || document.createElement('span'); // optional
  confettiEl = q('#confetti');

  // initial compute positions
  slotsX = computeSlots();
  // ensure each cup has absolute positioning anchored center
  cups.forEach((el, idx) => {
    el.style.position = 'absolute';
    // initially place cups evenly by using slots centers
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    // click handler
    el.addEventListener('click', ()=> {
      // determine visual index of this element (where it currently sits)
      const logicalId = Number(el.getAttribute('data-id'));
      const visualIndex = state.positions.indexOf(logicalId);
      onPick(visualIndex);
    });
  });

  applyPositions();
  setMessage('Press <strong>Start</strong> to begin');
  setScore(0); setRounds(0);
  updateSpeedDisplay();

  // event listeners
  startBtn.addEventListener('click', startRound);
  resetBtn.addEventListener('click', ()=> { setScore(0); setRounds(0); setMessage('Press <strong>Start</strong> to begin'); });
  levelSelect.addEventListener('change', ()=> updateSpeedDisplay());
  window.addEventListener('resize', ()=> { slotsX = computeSlots(); applyPositions(); });
});
