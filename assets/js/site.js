(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('hero')) return;
  var hero = $('hero'), cv = $('rope'), ctx = cv.getContext('2d'), sealBtn = $('seal'), hint = $('hint');
  var letter = $('letter'), clip = $('letterClip'), paper = $('paper'), reseal = $('reseal');
  var nameEl = $('name'), nameText = $('nameText');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var N = 30, BI = 17;
  var W = 0, H = 0, dpr = 1, seg = 20, R = 48, y0 = 100;
  var pts = [], broken = false, split = false, u = 0, running = false, drag = null, tailA = 0;
  var T = { lo: [127, 26, 34], hi: [191, 69, 64] };

  function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function readTheme() {
    var s = getComputedStyle(document.documentElement);
    var g = function (n) { return s.getPropertyValue(n).trim(); };
    try { T = { lo: hex(g('--ribbon-lo')), hi: hex(g('--ribbon-hi')) }; } catch (e) {}
    if (reduce && pts.length) render();
  }
  function col(s, k) {
    var c = [0, 1, 2].map(function (i) { return Math.min(255, Math.round((T.lo[i] + (T.hi[i] - T.lo[i]) * s) * (k || 1))); });
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  function fitName() {
    if (W < 700) { nameEl.style.fontSize = ''; nameEl.style.left = ''; return; }
    nameEl.style.fontSize = '100px';
    var w = nameText.getBoundingClientRect().width;
    if (!w) return;
    var pad = Math.max(20, Math.min(48, W * 0.03));
    nameEl.style.fontSize = (100 * (W - 2 * pad) / w) + 'px';
    nameEl.style.left = pad + 'px';
  }

  function layout() {
    var r = hero.getBoundingClientRect();
    if (!r.width) return;
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.max(34, Math.min(62, W * 0.045));
    y0 = H * 0.3;
    var span = W + 40, sag = H * 0.2;
    seg = (span + 8 * sag * sag / (3 * span)) / (N - 1);
    sealBtn.style.width = (R * 5.8) + 'px'; sealBtn.style.height = (R * 3) + 'px';
    fitName();
    init();
    if (broken) split = true;
    if (reduce) { for (var k = 0; k < 400; k++) step(0); render(); }
  }

  function init() {
    pts = [];
    for (var i = 0; i < N; i++) {
      var x = -20 + i * (W + 40) / (N - 1);
      pts.push({ x: x, y: y0, px: x, py: y0, w: i === BI ? 0.3 : 1, pin: i === 0 || i === N - 1 });
    }
    split = false;
  }

  function step(t) {
    var g = 0.5, damp = 0.992, i, p;
    for (i = 0; i < N; i++) {
      p = pts[i];
      if (p.pin) continue;
      var vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
      p.px = p.x; p.py = p.y;
      var wind = reduce ? 0 : Math.sin(t * 0.0011 + i * 0.3) * 0.012;
      p.x += vx + wind; p.y += vy + g;
    }
    for (var it = 0; it < 14; it++) {
      for (i = 0; i < N - 1; i++) {
        if (split && i === BI) continue;
        var a = pts[i], b = pts[i + 1];
        var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4, k = (d - seg) / d;
        var wa = a.pin ? 0 : a.w, wb = b.pin ? 0 : b.w, s = wa + wb;
        if (!s) continue;
        a.x += dx * k * wa / s; a.y += dy * k * wa / s;
        b.x -= dx * k * wb / s; b.y -= dy * k * wb / s;
      }
    }
    for (i = 0; i < N; i++) {
      p = pts[i];
      if (!p.pin && p.y > H - 8) { p.y = H - 8; p.px += (p.x - p.px) * 0.25; }
    }
  }

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }
  function ease(x) { x = clamp01(x); return x * x * (3 - 2 * x); }
  function satin(g, dark) {
    var d = dark || 1;
    g.addColorStop(0, col(0.14, 0.96 * d)); g.addColorStop(0.26, col(0.55, d)); g.addColorStop(0.4, col(1, 1.12 * d));
    g.addColorStop(0.55, col(0.5, d)); g.addColorStop(1, col(0.1, 0.9 * d));
    return g;
  }

  function wing(L, Hh) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.14, -Hh * 0.95, L * 0.52, -Hh * 1.5, L * 0.9, -Hh * 1.02);
    ctx.bezierCurveTo(L * 1.14, -Hh * 0.6, L * 1.1, Hh * 0.4, L * 0.84, Hh * 0.55);
    ctx.bezierCurveTo(L * 0.52, Hh * 0.62, L * 0.2, Hh * 0.3, 0, 0);
    ctx.closePath();
  }
  function tailPath(side, tl, tw, curl) {
    var K = 22, left = [], right = [], i, f;
    var P = [[0, 0], [side * tl * 0.03 * curl, tl * 0.5], [side * tl * 0.46 * curl, tl * 0.62], [side * (tl * 0.58 * curl + tl * 0.08 * (1 - curl)), tl]];
    function bz(t) {
      var m = 1 - t;
      return [m*m*m*P[0][0] + 3*m*m*t*P[1][0] + 3*m*t*t*P[2][0] + t*t*t*P[3][0],
              m*m*m*P[0][1] + 3*m*m*t*P[1][1] + 3*m*t*t*P[2][1] + t*t*t*P[3][1]];
    }
    for (i = 0; i <= K; i++) {
      f = i / K;
      var a = bz(Math.max(0, f - 0.02)), b = bz(Math.min(1, f + 0.02));
      var dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
      var w = tw * (0.34 + 0.66 * Math.sin(Math.min(1, f * 1.1) * Math.PI * 0.5)) / 2;
      var c = bz(f);
      left.push([c[0] - dy / dl * w, c[1] + dx / dl * w]);
      right.push([c[0] + dy / dl * w, c[1] - dx / dl * w]);
    }
    var e = bz(1), a2 = bz(0.97), ndx = e[0] - a2[0], ndy = e[1] - a2[1], nl = Math.hypot(ndx, ndy) || 1;
    var notch = [e[0] - ndx / nl * tw * 0.7, e[1] - ndy / nl * tw * 0.7];
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (i = 1; i <= K; i++) ctx.lineTo(left[i][0], left[i][1]);
    ctx.lineTo(notch[0], notch[1]);
    for (i = K; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
  }
  function drawBow(p, rot, t) {
    var pull = ease(u / 0.5);
    var shrinkR = ease((u - 0.05) / 0.4), shrinkL = ease((u - 0.2) / 0.4);
    var knotS = 1 - ease((u - 0.3) / 0.3);
    var tailFade = 1 - ease((u - 0.45) / 0.17);
    var vx = p.x - p.px;
    tailA += (Math.max(-0.5, Math.min(0.5, -vx * 0.05)) - tailA) * 0.12;
    var L = R * 2.9, Hh = R * 1.15, tl = R * 3.4, tw = R * 0.55;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = tailFade;
    [-1, 1].forEach(function (side) {
      var isR = side === 1;
      var len = tl * (isR ? 1 + pull * 1.6 : 1 + pull * 0.2);
      var curl = isR ? 1 - pull * 0.75 : 1 - pull * 0.25;
      ctx.save();
      ctx.rotate(tailA * 0.8 + (isR ? pull * 0.38 : -pull * 0.06));
      tailPath(side, len, tw, curl);
      var g = ctx.createLinearGradient(-side * tw * 1.2, 0, side * tw * 1.6, len * 0.5);
      satin(g);
      ctx.shadowColor = 'rgba(40,5,8,.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8;
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.restore();
    });
    ctx.globalAlpha = 1;
    ctx.rotate(rot);
    [-1, 1].forEach(function (side) {
      var k = 1 - (side === 1 ? shrinkR : shrinkL);
      if (k < 0.02) return;
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(-0.4 * k);
      var l = L * (0.35 + 0.65 * k), h = Hh * k;
      wing(l, h);
      ctx.ellipse(l * 0.55, -h * 0.3, l * 0.25, Math.max(0.01, h * 0.34), -0.18, 0, Math.PI * 2);
      var g = ctx.createLinearGradient(l * 0.05, -h * 1.4, l * 0.95, h * 0.6);
      satin(g);
      ctx.shadowColor = 'rgba(40,5,8,.3)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 8;
      ctx.fillStyle = g; ctx.fill('evenodd');
      ctx.shadowColor = 'transparent';
      ctx.restore();
    });
    if (knotS > 0.02) {
      var kw = R * 0.46 * knotS, kh = R * 0.62 * knotS;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-kw / 2, -kh / 2, kw, kh, kw * 0.45); else ctx.rect(-kw / 2, -kh / 2, kw, kh);
      var kg = ctx.createLinearGradient(-kw / 2, 0, kw / 2, 0);
      satin(kg, 0.95);
      ctx.shadowColor = 'rgba(40,5,8,.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      ctx.fillStyle = kg; ctx.fill();
      ctx.shadowColor = 'transparent';
    }
    ctx.restore();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    if (!pts.length) return;
    var i, p, hw = R * 0.36, L = [], Rr = [], sh = [];
    for (i = 0; i < N; i++) {
      p = pts[i];
      var ia = Math.max(0, i - 1), ib = Math.min(N - 1, i + 1);
      if (split) { if (i === BI) ib = i; if (i === BI + 1) ia = i; }
      var a = pts[ia], b = pts[ib];
      var tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
      var nx = -ty / tl, ny = tx / tl;
      L.push([p.x + nx * hw, p.y + ny * hw]); Rr.push([p.x - nx * hw, p.y - ny * hw]);
      sh.push(0.5 + 0.1 * Math.sin(i * 0.35 + 0.8));
    }
    function band(a0, b0, nEnd, nStart) {
      var j, n1 = null, n0 = null;
      if (nEnd) {
        var ex = pts[b0].x - pts[b0 - 1].x, ey = pts[b0].y - pts[b0 - 1].y, el = Math.hypot(ex, ey) || 1;
        n1 = [pts[b0].x - ex / el * hw * 1.6, pts[b0].y - ey / el * hw * 1.6];
      }
      if (nStart) {
        var sx = pts[a0 + 1].x - pts[a0].x, sy = pts[a0 + 1].y - pts[a0].y, sl = Math.hypot(sx, sy) || 1;
        n0 = [pts[a0].x + sx / sl * hw * 1.6, pts[a0].y + sy / sl * hw * 1.6];
      }
      ctx.save();
      ctx.shadowColor = 'rgba(40,5,8,.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 10;
      ctx.beginPath(); ctx.moveTo(L[a0][0], L[a0][1]);
      for (j = a0 + 1; j <= b0; j++) ctx.lineTo(L[j][0], L[j][1]);
      if (n1) ctx.lineTo(n1[0], n1[1]);
      for (j = b0; j >= a0; j--) ctx.lineTo(Rr[j][0], Rr[j][1]);
      if (n0) ctx.lineTo(n0[0], n0[1]);
      ctx.closePath(); ctx.fillStyle = col(0.5); ctx.fill();
      ctx.restore();
      for (j = a0 + (nStart ? 1 : 0); j < b0 - (nEnd ? 1 : 0); j++) {
        ctx.beginPath();
        ctx.moveTo(L[j][0], L[j][1]); ctx.lineTo(L[j + 1][0], L[j + 1][1]);
        ctx.lineTo(Rr[j + 1][0], Rr[j + 1][1]); ctx.lineTo(Rr[j][0], Rr[j][1]);
        ctx.closePath();
        var c = col((sh[j] + sh[j + 1]) / 2);
        ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 0.8; ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(L[a0][0], L[a0][1]);
      for (j = a0 + 1; j <= b0; j++) ctx.lineTo(L[j][0], L[j][1]);
      if (n1) ctx.lineTo(n1[0], n1[1]);
      for (j = b0; j >= a0; j--) ctx.lineTo(Rr[j][0], Rr[j][1]);
      if (n0) ctx.lineTo(n0[0], n0[1]);
      ctx.closePath();
      ctx.beginPath(); ctx.moveTo(L[a0][0], L[a0][1]);
      for (j = a0 + 1; j <= b0; j++) ctx.lineTo(L[j][0], L[j][1]);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,215,205,.28)'; ctx.stroke();
    }
    if (split) { band(0, BI, true, false); band(BI + 1, N - 1, false, true); }
    else band(0, N - 1, false, false);

    var bp = pts[BI], a2 = pts[BI - 1], b2 = pts[BI + 1];
    if (!split) drawBow(bp, Math.atan2(b2.y - a2.y, b2.x - a2.x) * 0.8, t);
    sealBtn.style.transform = 'translate(' + (bp.x - R * 2.9) + 'px,' + (bp.y - R * 1.5) + 'px)';
    hint.style.transform = 'translate(' + (bp.x - 44) + 'px,' + (bp.y - R * 2.7) + 'px)';
  }
  function render() { draw(performance.now()); }

  var last = 0, acc = 0, released = false;
  function frame(t) {
    if (!running) return;
    var dt = Math.min(64, t - (last || t)); last = t; acc += dt;
    var n = 0;
    while (acc >= 16.667 && n < 4) { step(t); acc -= 16.667; n++; }
    if (broken && u < 1) u = Math.min(1, u + dt / 2000);
    if (broken && u > 0.62 && !released) {
      released = true; split = true;
      pts[BI].px = pts[BI].x + 3; pts[BI].py = pts[BI].y - 2;
      pts[BI + 1].px = pts[BI + 1].x - 3; pts[BI + 1].py = pts[BI + 1].y - 2;
    }
    draw(t);
    requestAnimationFrame(frame);
  }
  function start() { if (running || reduce) return; running = true; last = 0; requestAnimationFrame(frame); }

  function crack() {
    if (broken) return;
    broken = true; released = false; u = reduce ? 1 : 0;
    sealBtn.hidden = true; hint.hidden = true; sealBtn.setAttribute('aria-expanded', 'true');
    if (reduce) { split = true; for (var k = 0; k < 400; k++) step(0); render(); }
    openLetter(true);
  }
  function openLetter(open) {
    letter.classList.toggle('open', open);
    clip.inert = !open;
    if (open) {
      setTimeout(function () {
        paper.focus({ preventScroll: true });
        paper.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }, 700);
    }
  }
  reseal.addEventListener('click', function () {
    broken = false; u = 0; released = false;
    init();
    sealBtn.hidden = false; hint.hidden = false; sealBtn.setAttribute('aria-expanded', 'false');
    openLetter(false);
    hero.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    sealBtn.focus({ preventScroll: true });
    if (reduce) { for (var k = 0; k < 400; k++) step(0); render(); }
  });

  sealBtn.addEventListener('click', function (e) { if (reduce || e.detail === 0) crack(); });
  sealBtn.addEventListener('pointerdown', function (e) {
    if (reduce || broken) return;
    e.preventDefault();
    sealBtn.setPointerCapture(e.pointerId);
    var pr = hero.getBoundingClientRect(), p = pts[BI];
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, vx: 0, vy: 0, moved: false,
             ox: p.x - (e.clientX - pr.left), oy: p.y - (e.clientY - pr.top) };
    p.pin = true;
  });
  sealBtn.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    drag.vx = e.clientX - drag.lx; drag.vy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
    if (!drag.moved) return;
    var pr = hero.getBoundingClientRect();
    var tx = e.clientX - pr.left + drag.ox, ty = e.clientY - pr.top + drag.oy;
    var ends = [[pts[0].x, pts[0].y, seg * BI * 0.97], [pts[N - 1].x, pts[N - 1].y, seg * (N - 1 - BI) * 0.97]];
    for (var r2 = 0; r2 < 2; r2++) ends.forEach(function (c) {
      var dx = tx - c[0], dy = ty - c[1], dd = Math.hypot(dx, dy);
      if (dd > c[2]) { tx = c[0] + dx / dd * c[2]; ty = c[1] + dy / dd * c[2]; }
    });
    ty = Math.max(24, Math.min(H - 24, ty));
    var p = pts[BI]; p.x = tx; p.y = ty; p.px = tx; p.py = ty;
  });
  function release(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    var p = pts[BI]; p.pin = false;
    var moved = drag.moved, vx = drag.vx, vy = drag.vy;
    drag = null;
    if (moved) { p.px = p.x - vx * 0.9; p.py = p.y - vy * 0.9; }
    else if (!cancelled) crack();
  }
  sealBtn.addEventListener('pointerup', function (e) { release(e, false); });
  sealBtn.addEventListener('pointercancel', function (e) { release(e, true); });

  var lm = null;
  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || drag || reduce || !pts.length) return;
    var pr = hero.getBoundingClientRect(), x = e.clientX - pr.left, y = e.clientY - pr.top;
    if (lm) {
      var vx = x - lm.x, vy = y - lm.y;
      for (var i = 1; i < N - 1; i++) {
        var p = pts[i], d = Math.hypot(p.x - x, p.y - y);
        if (d < 80) { var f = (1 - d / 80) * 0.1; p.x += vx * f * 0.4; p.y += vy * f; }
      }
    }
    lm = { x: x, y: y };
  });
  hero.addEventListener('pointerleave', function () { lm = null; });

  var peek = $('peek');
  Array.prototype.forEach.call(document.querySelectorAll('.row'), function (r) {
    r.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      peek.style.setProperty('--plate', r.dataset.plate);
      peek.style.setProperty('--plate-fg', r.dataset.fg);
      $('peekTitle').textContent = r.dataset.title;
      $('peekNote').textContent = r.dataset.note;
      peek.classList.add('on');
    });
    r.addEventListener('pointermove', function (e) {
      peek.style.transform = 'translate3d(' + (e.clientX + 28) + 'px,' + (e.clientY - 70) + 'px,0)';
    });
    r.addEventListener('pointerleave', function () { peek.classList.remove('on'); });
  });

  readTheme();
  layout();
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(hero); else window.addEventListener('resize', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitName(); if (reduce) render(); });
  start();
})();

(function () {
  Array.prototype.forEach.call(document.querySelectorAll('.copy'), function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-copy'), done = function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); };
      try { navigator.clipboard.writeText(t).then(done, done); } catch (e) { done(); }
    });
  });
})();

(function () {
  var btn = document.querySelector('.menu-btn'), nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  function set(open) { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.textContent = open ? 'Close' : 'Menu'; }
  btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); } });
})();
