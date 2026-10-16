(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const pad = (n) => String(n).padStart(2, '0');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('kd.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('kd.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가: 무시 */ }
    },
  };

  // 남은 시간: 올림 처리해서 0:00 이 끝나는 순간에만 보이게
  function fmtLeft(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  function fmtHMS(ms) {
    const t = Math.floor(ms / 1000);
    return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
  }
  function fmtKo(ms) {
    const m = Math.floor(ms / 60000);
    return `${Math.floor(m / 60)}시간 ${m % 60}분`;
  }

  // ---------- 소리 ----------
  const audio = {
    ctx: null,
    get() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, at, dur, gain = 0.3, type = 'sine') {
      const c = this.get();
      if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(c.destination);
      o.start(at);
      o.stop(at + dur + 0.02);
    },
    chime(times = 3) {
      const c = this.get();
      if (!c) return;
      let t = c.currentTime + 0.05;
      for (let i = 0; i < times; i++) {
        this.tone(880, t, 0.6, 0.25);
        this.tone(1318.5, t + 0.14, 0.7, 0.18);
        t += 0.95;
      }
    },
  };

  // ---------- 카운트다운 (뽀모도로, 수업 타이머 공용) ----------
  class Countdown {
    constructor(onEnd) { this.onEnd = onEnd; this.total = 0; this.remaining = 0; this.endAt = 0; this.running = false; }
    set(ms) { this.running = false; this.total = ms; this.remaining = ms; }
    start() { if (this.running || this.remaining <= 0) return; this.endAt = Date.now() + this.remaining; this.running = true; }
    pause() { if (!this.running) return; this.remaining = Math.max(0, this.endAt - Date.now()); this.running = false; }
    add(ms) { this.total += ms; if (this.running) this.endAt += ms; else this.remaining += ms; }
    left() { return this.running ? Math.max(0, this.endAt - Date.now()) : this.remaining; }
    tick() {
      if (this.running && Date.now() >= this.endAt) {
        this.running = false;
        this.remaining = 0;
        this.onEnd();
      }
    }
  }

  // 숫자 입력칸 공통 처리
  function readNum(input, lo, hi, fallback) {
    const v = parseInt(input.value, 10);
    const n = Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
    input.value = n;
    return n;
  }

  // ---------- 뽀모도로 ----------
  const pomodoro = (() => {
    const el = $('#tool-pomodoro');
    const cfg = Object.assign({ focus: 25, short: 5, long: 15, every: 4, auto: true }, store.get('pomo', {}));
    const labels = { focus: '집중', short: '짧은 휴식', long: '긴 휴식' };
    const timeEl = $('.pomo-time', el), bar = $('.pomo-bar i', el), roundEl = $('.pomo-round', el);
    const toggleBtn = $('[data-act="toggle"]', el);
    let mode = 'focus', done = 0;
    const cd = new Countdown(finish);

    function setMode(m, autostart) {
      mode = m;
      cd.set(cfg[m] * 60000);
      el.dataset.mode = m;
      $$('[data-mode]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
      if (autostart) cd.start();
      render();
    }
    function finish() {
      audio.chime(mode === 'focus' ? 3 : 2);
      if (mode === 'focus') {
        done++;
        setMode(done % cfg.every === 0 ? 'long' : 'short', cfg.auto);
      } else {
        setMode('focus', cfg.auto);
      }
    }
    function toggle() { audio.get(); cd.running ? cd.pause() : cd.start(); render(); }
    function render() {
      const left = cd.left();
      timeEl.textContent = fmtLeft(left);
      bar.style.transform = `scaleX(${cd.total ? 1 - left / cd.total : 0})`;
      toggleBtn.textContent = cd.running ? '일시정지' : (left < cd.total ? '계속' : '시작');
      if (!done) roundEl.textContent = `집중 ${cfg.every}번마다 긴 휴식`;
      else if (mode === 'long') roundEl.textContent = `${done}번 집중했어요. 길게 쉬세요`;
      else roundEl.textContent = `${done}번 집중했어요. 긴 휴식까지 ${cfg.every - (done % cfg.every)}번`;
    }

    $$('[data-mode]', el).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode, false)));
    toggleBtn.addEventListener('click', toggle);
    $('[data-act="reset"]', el).addEventListener('click', () => setMode(mode, false));
    $('[data-act="skip"]', el).addEventListener('click', () => {
      if (mode === 'focus') setMode('short', false); else setMode('focus', false);
    });

    const limits = { focus: [1, 120], short: [1, 60], long: [1, 60], every: [2, 8] };
    $$('[data-cfg]', el).forEach((inp) => {
      const k = inp.dataset.cfg;
      if (inp.type === 'checkbox') inp.checked = cfg[k]; else inp.value = cfg[k];
      inp.addEventListener('change', () => {
        cfg[k] = inp.type === 'checkbox' ? inp.checked : readNum(inp, ...limits[k], cfg[k]);
        store.set('pomo', cfg);
        // 시작 전이면 바뀐 시간을 바로 반영
        if (!cd.running && cd.left() === cd.total && k === mode) setMode(mode, false);
        render();
      });
    });

    setMode('focus', false);
    return {
      tick() { cd.tick(); render(); },
      toggle,
      title() { return cd.running ? `${fmtLeft(cd.left())} ${labels[mode]}` : null; },
    };
  })();

  // ---------- 공부 타이머 ----------
  const study = (() => {
    const el = $('#tool-study');
    const timeEl = $('.study-time', el), totalEl = $('.study-total b', el), subjEl = $('.study-subject', el);
    const listEl = $('.subjects', el), toggleBtn = $('[data-act="toggle"]', el);
    const form = $('.subject-add', el), nameInput = $('input', form);
    const MAX = 8;

    const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const fresh = (names) => ({ subjects: names.map((n, i) => ({ id: 's' + i, name: n, ms: 0 })), active: 's0' });

    let day = today();
    let data = store.get('study.' + day, null) || fresh(store.get('study.names', ['국어', '영어', '수학']));
    let startedAt = 0; // 0 이면 멈춤
    let lastSave = 0;

    const cur = () => data.subjects.find((s) => s.id === data.active) || data.subjects[0];
    const live = () => (startedAt ? Date.now() - startedAt : 0);
    function save() {
      store.set('study.' + day, data);
      store.set('study.names', data.subjects.map((s) => s.name));
    }
    function commit() {
      if (!startedAt || !cur()) return;
      const now = Date.now();
      cur().ms += now - startedAt;
      startedAt = now;
      save();
    }
    function toggle() {
      if (startedAt) { commit(); startedAt = 0; } else if (cur()) { startedAt = Date.now(); }
      el.classList.toggle('running', !!startedAt);
      render();
    }
    function select(id) {
      commit();
      data.active = id;
      save();
      renderList();
      render();
    }
    function remove(id) {
      if (data.subjects.length <= 1) return;
      if (id === data.active) { commit(); startedAt = 0; el.classList.remove('running'); }
      data.subjects = data.subjects.filter((s) => s.id !== id);
      if (!data.subjects.some((s) => s.id === data.active)) data.active = data.subjects[0].id;
      save();
      renderList();
      render();
    }

    function renderList() {
      listEl.textContent = '';
      data.subjects.forEach((s) => {
        const wrap = document.createElement('span');
        wrap.className = 'subject';
        wrap.setAttribute('aria-current', String(s.id === data.active));
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.innerHTML = '<span></span><small></small>';
        pick.firstChild.textContent = s.name;
        pick.addEventListener('click', () => select(s.id));
        wrap.append(pick);
        if (data.subjects.length > 1) {
          const del = document.createElement('button');
          del.type = 'button';
          del.textContent = '×';
          del.setAttribute('aria-label', `${s.name} 삭제`);
          del.addEventListener('click', () => remove(s.id));
          wrap.append(del);
        }
        wrap.dataset.id = s.id;
        listEl.append(wrap);
      });
      nameInput.disabled = data.subjects.length >= MAX;
      nameInput.placeholder = nameInput.disabled ? `과목은 ${MAX}개까지` : '과목 추가';
    }

    function render() {
      const c = cur();
      const extra = live();
      subjEl.textContent = c ? c.name : '';
      timeEl.textContent = fmtHMS((c ? c.ms : 0) + extra);
      totalEl.textContent = fmtKo(data.subjects.reduce((a, s) => a + s.ms, 0) + extra);
      toggleBtn.textContent = startedAt ? '일시정지' : '시작';
      $$('.subject', listEl).forEach((w) => {
        const s = data.subjects.find((x) => x.id === w.dataset.id);
        if (s) $('small', w).textContent = fmtHMS(s.ms + (s.id === data.active ? extra : 0)).slice(0, 5);
      });
    }

    toggleBtn.addEventListener('click', toggle);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name || data.subjects.length >= MAX) return;
      const s = { id: 's' + Date.now(), name, ms: 0 };
      data.subjects.push(s);
      nameInput.value = '';
      select(s.id);
    });
    $('[data-act="clear"]', el).addEventListener('click', () => {
      if (!confirm('오늘 공부 기록을 모두 지울까요?')) return;
      startedAt = 0;
      el.classList.remove('running');
      data.subjects.forEach((s) => { s.ms = 0; });
      save();
      render();
    });
    window.addEventListener('pagehide', commit);
    document.addEventListener('visibilitychange', () => { if (document.hidden) commit(); });

    renderList();
    render();
    return {
      tick() {
        if (today() !== day) {
          // 자정: 지금까지 잰 시간은 어제로, 과목은 그대로 새 날로
          commit();
          day = today();
          const active = data.active;
          data = fresh(data.subjects.map((s) => s.name));
          data.active = data.subjects[Math.max(0, data.subjects.findIndex((s) => s.id === active))]?.id || 's0';
          if (startedAt) startedAt = Date.now();
          save();
          renderList();
        }
        if (startedAt && Date.now() - lastSave > 10000) { commit(); lastSave = Date.now(); }
        render();
      },
      toggle,
      title() { return startedAt ? `${fmtHMS(cur().ms + live())} ${cur().name}` : null; },
    };
  })();

  // ---------- 메트로놈 ----------
  const metronome = (() => {
    const el = $('#tool-metronome');
    const cfg = Object.assign({ bpm: 100, beats: 4, accent: true }, store.get('metro', {}));
    const bpmEl = $('.metro-bpm', el), nameEl = $('.metro-name b', el), dotsEl = $('.beat-dots', el);
    const range = $('input[type="range"]', el), toggleBtn = $('[data-act="toggle"]', el);
    const arm = $('.metro-arm', el), weight = $('.metro-weight', el), accentBox = $('[data-cfg="accent"]', el);
    const SWING = 24;

    let playing = false, timer = 0, nextTime = 0, beat = 0, count = 0, queue = [], last = null, taps = [];

    const tempoName = (b) =>
      b < 60 ? 'Largo' : b < 66 ? 'Larghetto' : b < 76 ? 'Adagio' : b < 108 ? 'Andante'
        : b < 120 ? 'Moderato' : b < 156 ? 'Allegro' : b < 176 ? 'Vivace' : b < 200 ? 'Presto' : 'Prestissimo';

    function setBpm(v) {
      cfg.bpm = clamp(Math.round(v), 30, 250);
      bpmEl.textContent = cfg.bpm;
      nameEl.textContent = tempoName(cfg.bpm);
      range.value = cfg.bpm;
      // 실제 메트로놈처럼 빠를수록 추가 아래로
      weight.setAttribute('y', String(60 + ((cfg.bpm - 30) / 220) * 110));
      store.set('metro', cfg);
    }
    function setBeats(n) {
      cfg.beats = n;
      beat = 0;
      $$('[data-beats]', el).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.beats === n)));
      dotsEl.textContent = '';
      for (let i = 0; i < n; i++) {
        const d = document.createElement('i');
        if (i === 0 && cfg.accent) d.className = 'accent';
        dotsEl.append(d);
      }
      store.set('metro', cfg);
    }

    function schedule() {
      const c = audio.ctx;
      while (nextTime < c.currentTime + 0.12) {
        const acc = cfg.accent && beat === 0;
        audio.tone(acc ? 1760 : 1175, nextTime, 0.045, acc ? 0.5 : 0.32, 'triangle');
        queue.push({ beat, count, time: nextTime });
        nextTime += 60 / cfg.bpm;
        beat = (beat + 1) % cfg.beats;
        count++;
      }
    }
    function draw() {
      if (!playing) return;
      const t = audio.ctx.currentTime;
      while (queue.length && queue[0].time <= t) {
        last = queue.shift();
        $$('i', dotsEl).forEach((d, i) => d.classList.toggle('on', i === last.beat));
      }
      if (last) {
        const p = clamp((t - last.time) / (60 / cfg.bpm), 0, 1);
        const side = last.count % 2 ? 1 : -1;
        arm.style.transform = `rotate(${side * SWING * Math.cos(Math.PI * p)}deg)`;
      }
      requestAnimationFrame(draw);
    }
    function start() {
      const c = audio.get();
      if (!c) return;
      playing = true;
      beat = 0; count = 0; queue = []; last = null;
      nextTime = c.currentTime + 0.08;
      schedule();
      timer = setInterval(schedule, 25);
      requestAnimationFrame(draw);
    }
    function stop() {
      playing = false;
      clearInterval(timer);
      arm.style.transform = '';
      $$('i', dotsEl).forEach((d) => d.classList.remove('on'));
    }
    function toggle() { playing ? stop() : start(); toggleBtn.textContent = playing ? '정지' : '시작'; }

    toggleBtn.addEventListener('click', toggle);
    range.addEventListener('input', () => setBpm(+range.value));
    $('[data-act="minus"]', el).addEventListener('click', () => setBpm(cfg.bpm - 1));
    $('[data-act="plus"]', el).addEventListener('click', () => setBpm(cfg.bpm + 1));
    $('[data-act="tap"]', el).addEventListener('click', () => {
      const now = performance.now();
      if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
      taps.push(now);
      taps = taps.slice(-5);
      if (taps.length >= 2) setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
    });
    $$('[data-beats]', el).forEach((b) => b.addEventListener('click', () => setBeats(+b.dataset.beats)));
    accentBox.checked = cfg.accent;
    accentBox.addEventListener('change', () => { cfg.accent = accentBox.checked; setBeats(cfg.beats); });

    setBpm(cfg.bpm);
    setBeats(cfg.beats);
    return {
      toggle,
      title() { return playing ? `${cfg.bpm} BPM` : null; },
    };
  })();

  // ---------- 시계 공통 ----------
  function clockOpts(el, key) {
    const cfg = Object.assign({ h24: true, sec: true }, store.get(key, {}));
    $$('[data-cfg]', el).forEach((inp) => {
      inp.checked = cfg[inp.dataset.cfg];
      inp.addEventListener('change', () => { cfg[inp.dataset.cfg] = inp.checked; store.set(key, cfg); });
    });
    return cfg;
  }
  function hours(d, h24) {
    const h = d.getHours();
    return h24 ? h : (h % 12 || 12);
  }
  const ampm = (d) => (d.getHours() < 12 ? '오전' : '오후');

  // ---------- 전체화면 시계 ----------
  const clock = (() => {
    const el = $('#tool-clock');
    const cfg = clockOpts(el, 'clock');
    const dateEl = $('.clock-date', el), apEl = $('.clock-ap', el), hmEl = $('.clock-hm', el), sEl = $('.clock-s', el);
    const dateFmt = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    return {
      tick(active) {
        if (!active) return;
        const d = new Date();
        dateEl.textContent = dateFmt.format(d);
        apEl.textContent = cfg.h24 ? '' : ampm(d);
        hmEl.textContent = `${cfg.h24 ? pad(hours(d, true)) : hours(d, false)}:${pad(d.getMinutes())}`;
        sEl.textContent = cfg.sec ? pad(d.getSeconds()) : '';
      },
    };
  })();

  // ---------- 플립 시계 ----------
  const flip = (() => {
    const el = $('#tool-flip');
    const cfg = clockOpts(el, 'flip');
    const wrap = $('.flipclock', el), apEl = $('.flip-ap', el), sr = $('.flip-sr', el);
    const groups = { h: $('[data-g="h"]', el), m: $('[data-g="m"]', el), s: $('[data-g="s"]', el) };
    const cards = {};

    function makeCard() {
      const c = document.createElement('div');
      c.className = 'flip';
      c.innerHTML = '<span class="half top"><b></b></span><span class="half bottom"><b></b></span>'
        + '<span class="flap front"><b></b></span><span class="flap back"><b></b></span>';
      const [top, bottom, front, back] = $$('b', c);
      let value = null, timer = 0;
      c.set = (v) => {
        if (v === value) return;
        const old = value == null ? v : value;
        value = v;
        top.textContent = v; back.textContent = v;
        front.textContent = old; bottom.textContent = old;
        clearTimeout(timer);
        c.classList.remove('go');
        if (old !== v) {
          void c.offsetWidth; // 애니메이션 다시 시작
          c.classList.add('go');
          timer = setTimeout(() => { bottom.textContent = v; c.classList.remove('go'); }, 620);
        }
      };
      return c;
    }
    Object.entries(groups).forEach(([g, box]) => {
      cards[g] = [makeCard(), makeCard()];
      box.append(...cards[g]);
    });

    return {
      tick(active) {
        if (!active) return;
        const d = new Date();
        const h = pad(hours(d, cfg.h24)), m = pad(d.getMinutes()), s = pad(d.getSeconds());
        groups.s.hidden = !cfg.sec;
        wrap.classList.toggle('with-sec', cfg.sec);
        [[h, 'h'], [m, 'm'], [s, 's']].forEach(([v, g]) => { cards[g][0].set(v[0]); cards[g][1].set(v[1]); });
        apEl.textContent = cfg.h24 ? '' : ampm(d);
        sr.textContent = `${h}시 ${m}분`;
      },
    };
  })();

  // ---------- 수업 타이머 ----------
  const classroom = (() => {
    const el = $('#tool-classroom');
    const timeEl = $('.class-time', el), msgEl = $('.class-msg', el), sector = $('.disc-left', el);
    const toggleBtn = $('[data-act="toggle"]', el);
    const mIn = $('[data-f="m"]', el), sIn = $('[data-f="s"]', el);
    let preset = store.get('class.ms', 5 * 60000);
    const cd = new Countdown(() => {
      el.dataset.state = 'done';
      audio.chime(4);
      render();
    });

    // 눈금 60개
    const ticks = $('.disc-ticks', el);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, major = i % 5 === 0;
      const r1 = major ? 80 : 86, r2 = 92;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 100 + r1 * Math.sin(a)); line.setAttribute('y1', 100 - r1 * Math.cos(a));
      line.setAttribute('x2', 100 + r2 * Math.sin(a)); line.setAttribute('y2', 100 - r2 * Math.cos(a));
      if (major) line.setAttribute('class', 'major');
      ticks.append(line);
    }

    function arc(f) {
      if (f <= 0) return '';
      if (f >= 0.9999) return 'M100 22a78 78 0 1 1 0 156a78 78 0 1 1 0-156z';
      const r = 78, a = f * Math.PI * 2;
      const x = 100 + r * Math.sin(a), y = 100 - r * Math.cos(a);
      return `M100 100L100 ${100 - r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
    }
    function set(ms) {
      preset = clamp(ms, 1000, 180 * 60000);
      store.set('class.ms', preset);
      cd.set(preset);
      delete el.dataset.state;
      mIn.value = Math.floor(preset / 60000);
      sIn.value = Math.floor((preset % 60000) / 1000);
      render();
    }
    function toggle() {
      audio.get();
      if (el.dataset.state === 'done') { set(preset); return; }
      cd.running ? cd.pause() : cd.start();
      render();
    }
    function render() {
      const left = cd.left();
      timeEl.textContent = fmtLeft(left);
      sector.setAttribute('d', arc(cd.total ? left / cd.total : 0));
      const done = el.dataset.state === 'done';
      if (!done) {
        if (cd.running && left <= Math.min(60000, cd.total * 0.2)) el.dataset.state = 'warn';
        else if (el.dataset.state === 'warn' && left > 60000) delete el.dataset.state;
      }
      msgEl.textContent = done ? '시간이 다 됐어요' : (cd.running ? '진행 중' : (left < cd.total ? '멈춤' : ''));
      toggleBtn.textContent = done ? '다시 설정' : (cd.running ? '일시정지' : (left < cd.total ? '계속' : '시작'));
    }

    toggleBtn.addEventListener('click', toggle);
    $('[data-act="reset"]', el).addEventListener('click', () => set(preset));
    $('[data-act="add"]', el).addEventListener('click', () => {
      if (el.dataset.state === 'done') { cd.set(60000); delete el.dataset.state; cd.start(); } else cd.add(60000);
      render();
    });
    $$('[data-min]', el).forEach((b) => b.addEventListener('click', () => set(+b.dataset.min * 60000)));
    $('.custom', el).addEventListener('submit', (e) => {
      e.preventDefault();
      const m = readNum(mIn, 0, 180, 5), s = readNum(sIn, 0, 59, 0);
      set((m * 60 + s) * 1000 || 60000);
    });

    set(preset);
    return {
      tick() { cd.tick(); render(); },
      toggle,
      title() { return cd.running ? `${fmtLeft(cd.left())} 수업 타이머` : null; },
    };
  })();

  // ---------- 탭 ----------
  const tools = { pomodoro, study, metronome, clock, flip, classroom };
  const names = {
    pomodoro: '뽀모도로 타이머', study: '공부 타이머', metronome: '메트로놈',
    clock: '전체화면 시계', flip: '플립 시계', classroom: '수업 타이머',
  };
  const tabs = $$('.tabs [role="tab"]');
  let active = 'pomodoro';

  function show(id, focus) {
    if (!tools[id]) id = 'pomodoro';
    active = id;
    tabs.forEach((t) => {
      const on = t.dataset.tool === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
      if (on) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    $$('.tool').forEach((p) => { p.hidden = p.id !== 'tool-' + id; });
    $$('.about').forEach((a) => { a.hidden = a.dataset.for !== id; });
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    store.set('tab', id);
    loop();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.dataset.tool));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      show(tabs[(i + d + tabs.length) % tabs.length].dataset.tool, true);
    });
  });
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  // ---------- 매 틱 ----------
  function loop() {
    Object.entries(tools).forEach(([id, t]) => t.tick && t.tick(id === active));
    // 화면에 없는 도구라도 돌아가는 중이면 탭 제목에 표시
    const running = [active, ...Object.keys(tools)].map((id) => tools[id].title && tools[id].title()).find(Boolean);
    const title = running ? `${running} | 켜둠` : `${names[active]} | 켜둠`;
    if (document.title !== title) document.title = title;
  }
  setInterval(loop, 250);

  // ---------- 전체화면 ----------
  const stage = $('#stage'), fsBtn = $('#fs');
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  let idleTimer = 0;
  function poke() {
    stage.classList.remove('idle');
    clearTimeout(idleTimer);
    if (stage.classList.contains('is-full')) idleTimer = setTimeout(() => stage.classList.add('idle'), 2500);
  }
  function setFull(on) {
    stage.classList.toggle('is-full', on);
    fsBtn.setAttribute('aria-label', on ? '전체화면 끝내기' : '전체화면');
    poke();
  }
  function toggleFull() {
    if (stage.classList.contains('pseudo')) { stage.classList.remove('pseudo'); setFull(false); return; }
    if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const req = stage.requestFullscreen || stage.webkitRequestFullscreen;
    if (req) req.call(stage).catch?.(() => { stage.classList.add('pseudo'); setFull(true); });
    else { stage.classList.add('pseudo'); setFull(true); } // 아이폰 사파리 등
  }
  fsBtn.addEventListener('click', toggleFull);
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) =>
    document.addEventListener(ev, () => setFull(!!fsEl())));
  ['mousemove', 'pointerdown', 'keydown'].forEach((ev) => stage.addEventListener(ev, poke));

  // ---------- 단축키 ----------
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space' && tag !== 'BUTTON' && tag !== 'SUMMARY' && tools[active].toggle) {
      e.preventDefault();
      tools[active].toggle();
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFull();
    } else if (e.key === 'Escape' && stage.classList.contains('pseudo')) {
      toggleFull();
    }
  });

  // ---------- 화면 켜두기 ----------
  const wakeBtn = $('#wake');
  if ('wakeLock' in navigator) {
    let lock = null, want = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } catch (e) { want = false; }
      wakeBtn.setAttribute('aria-pressed', String(want && !!lock));
    };
    wakeBtn.hidden = false;
    wakeBtn.addEventListener('click', () => {
      want = !want;
      if (want) acquire(); else { lock && lock.release(); wakeBtn.setAttribute('aria-pressed', 'false'); }
    });
    document.addEventListener('visibilitychange', () => { if (want && !document.hidden && !lock) acquire(); });
  }

  // ---------- 테마 ----------
  const themeBtn = $('#theme');
  const themes = ['auto', 'light', 'dark'], themeNames = { auto: '자동', light: '밝게', dark: '어둡게' };
  let theme = store.get('theme', 'auto');
  function applyTheme() {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    themeBtn.textContent = `테마: ${themeNames[theme] || '자동'}`;
  }
  themeBtn.addEventListener('click', () => {
    theme = themes[(themes.indexOf(theme) + 1) % themes.length];
    store.set('theme', theme);
    applyTheme();
  });
  applyTheme();

  show(location.hash.slice(1) || store.get('tab', 'pomodoro'));
})();
