/* أدوات مشتركة */
(function () {
  const C = window.APP_CONFIG;
  const U = (window.U = {});

  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  U.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ---------- التواريخ وأيام التحدي ---------- */
  const midnight = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const parseDate = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
  U.parseDate = parseDate;
  U.fmtDate = d => d.toLocaleDateString("ar", { day: "numeric", month: "long", year: "numeric", numberingSystem: "latn" });
  U.dayInfo = function (cfg) {
    const start = parseDate(cfg.start_date), total = cfg.total_days || 30;
    const diff = Math.round((midnight(new Date()) - start) / 864e5);
    const dayNo = diff + 1;
    const state = dayNo < 1 ? "before" : dayNo > total ? "ended" : "running";
    return { start, total, dayNo, state, cur: Math.min(Math.max(dayNo, 0), total), left: Math.max(total - dayNo, 0), toStart: Math.max(-diff, 0), endDate: new Date(start.getTime() + (total - 1) * 864e5) };
  };

  /* ---------- الإحصاءات والترتيب ---------- */
  U.BADGES = [
    { id: "start", e: "🚀", n: "بداية قوية", d: "3 أيام متتالية", test: p => p.best >= 3 },
    { id: "d7", e: "⭐", n: "7 أيام", d: "أنجز 7 أيام", test: p => p.count >= 7 },
    { id: "fire", e: "🔥", n: "شعلة متقدة", d: "سلسلة 7 أيام متتالية", test: p => p.best >= 7 },
    { id: "d15", e: "💎", n: "15 يومًا", d: "أنجز 15 يومًا", test: p => p.count >= 15 },
    { id: "d30", e: "👑", n: "بطل الـ 30", d: "أكمل التحدي كاملاً", test: (p, total) => p.count >= total }
  ];
  U.compute = function (cfg, participants, checkins) {
    const di = U.dayInfo(cfg), total = di.total;
    const byP = new Map(participants.map(p => [p.id, new Set()]));
    const links = new Map();
    checkins.forEach(c => { if (c.status === "approved" && byP.has(c.participant_id)) { byP.get(c.participant_id).add(c.day); links.set(c.participant_id + ":" + c.day, c.reel_url); } });
    const eff = Math.min(Math.max(di.dayNo, 0), total);
    const list = participants.map(p => {
      const days = byP.get(p.id);
      let best = 0, run = 0;
      for (let d = 1; d <= total; d++) { if (days.has(d)) { run++; best = Math.max(best, run); } else run = 0; }
      let streak = 0, d = days.has(eff) ? eff : eff - 1;
      while (d >= 1 && days.has(d)) { streak++; d--; }
      const count = [...days].filter(x => x <= total).length;
      const o = { ...p, days, count, best, streak, doneToday: days.has(di.dayNo), pct: Math.round((count / total) * 100) };
      o.badges = U.BADGES.filter(b => b.test(o, total));
      return o;
    });
    list.sort((a, b) => b.count - a.count || b.streak - a.streak || b.best - a.best || new Date(a.created_at) - new Date(b.created_at));
    list.forEach((p, i) => (p.rank = i + 1));
    const totalReels = list.reduce((s, p) => s + p.count, 0);
    return { di, list, totalReels, doneToday: list.filter(p => p.doneToday), activeStreaks: list.filter(p => p.streak >= 2).length, links };
  };

  /* ---------- إنستغرام ---------- */
  U.igHandle = v => {
    v = String(v || "").trim();
    const m = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
    if (m) v = m[1];
    return v.replace(/^@+/, "").replace(/[/?#].*$/, "").trim();
  };
  U.igValid = h => /^[A-Za-z0-9._]{2,30}$/.test(h);
  U.igUrl = h => `https://instagram.com/${encodeURIComponent(h)}`;
  U.isReelUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) && /(^|\.)instagram\.com$/i.test(x.hostname); } catch (e) { return false; } };

  U.photo = p => p.photo_url || (window.API.avatar ? window.API.avatar(p.name, 215) :
    "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' fill='#2E6BFF'/><text x='50%' y='58%' text-anchor='middle' dominant-baseline='middle' font-size='56' fill='white' font-family='sans-serif'>${U.esc((p.name || "؟").charAt(0))}</text></svg>`));

  /* ---------- الصور ---------- */
  U.resizeImage = (file, size = C.AVATAR_SIZE || 480) => new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej(new Error("اختر ملف صورة صالحاً"));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), cv = document.createElement("canvas");
      cv.width = cv.height = size;
      const cx = cv.getContext("2d");
      cx.fillStyle = "#fff"; cx.fillRect(0, 0, size, size);
      cx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      cv.toBlob(b => b ? res({ blob: b, dataUrl: cv.toDataURL("image/jpeg", 0.85) }) : rej(new Error("تعذر معالجة الصورة")), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("تعذر قراءة الصورة")); };
    img.src = url;
  });

  /* ---------- رسائل ---------- */
  U.toast = (msg, type = "") => {
    let box = U.$(".toasts"); if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
    const t = document.createElement("div"); t.className = "toast " + type; t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; t.style.transition = ".3s"; setTimeout(() => t.remove(), 300); }, 3400);
  };
  U.friendlyError = e => {
    const m = (e && (e.message || e.error_description)) || "";
    if (e && (e.code === "23505" || /duplicate|unique/i.test(m))) return "dup";
    if (/row-level security|violates|permission/i.test(m)) return "التسجيل أو الإرسال مغلق حالياً أو غير مسموح.";
    if (/Failed to fetch|NetworkError|network/i.test(m)) return "تعذر الاتصال بالإنترنت، حاول مرة أخرى.";
    return m || "حدث خطأ غير متوقع";
  };

  /* ---------- نوافذ ---------- */
  U.openModal = el => { el.classList.add("open"); document.body.style.overflow = "hidden"; };
  U.closeModal = el => { el.classList.remove("open"); if (!U.$(".modal.open")) document.body.style.overflow = ""; };
  document.addEventListener("click", e => {
    const m = e.target.closest(".modal");
    if (e.target.classList && e.target.classList.contains("modal")) U.closeModal(e.target);
    if (e.target.closest("[data-close]") && m) U.closeModal(m);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") U.$$(".modal.open").forEach(U.closeModal); });

  /* ---------- أرقام متحركة ---------- */
  U.countUp = (el, to, ms = 900) => {
    const from = Number(el.dataset.v || 0); el.dataset.v = to;
    if (from === to || matchMedia("(prefers-reduced-motion:reduce)").matches) { el.textContent = to; return; }
    const t0 = performance.now();
    const tick = t => { const k = Math.min((t - t0) / ms, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };

  /* ---------- إمالة ثلاثية الأبعاد ---------- */
  if (matchMedia("(hover:hover)").matches && !matchMedia("(prefers-reduced-motion:reduce)").matches) {
    let cur = null;
    document.addEventListener("pointermove", e => {
      const el = e.target.closest && e.target.closest("[data-tilt]");
      if (cur && cur !== el) { cur.style.removeProperty("--tx"); cur.style.removeProperty("--ty"); cur.classList.remove("is-tilting"); }
      cur = el; if (!el) return;
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const k = parseFloat(el.dataset.tilt) || 7;
      el.classList.add("is-tilting");
      el.style.setProperty("--ty", ((x - 0.5) * -2 * k).toFixed(2) + "deg");
      el.style.setProperty("--tx", ((y - 0.5) * 2 * k).toFixed(2) + "deg");
      el.style.setProperty("--gx", (x * 100).toFixed(0) + "%"); el.style.setProperty("--gy", (y * 100).toFixed(0) + "%");
    }, { passive: true });
    document.addEventListener("pointerleave", () => { if (cur) { cur.style.removeProperty("--tx"); cur.style.removeProperty("--ty"); cur = null; } }, true);
  }

  /* مشهد الهيرو يتبع المؤشر / حركة الجهاز */
  U.parallax = stage => {
    if (!stage || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const set = (x, y) => { stage.style.setProperty("--ry", (-16 + x * 22).toFixed(1) + "deg"); stage.style.setProperty("--rx", (10 - y * 16).toFixed(1) + "deg"); };
    const host = stage.parentElement;
    host.addEventListener("pointermove", e => { const r = host.getBoundingClientRect(); stage.classList.add("is-moving"); set((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5); });
    host.addEventListener("pointerleave", () => { stage.classList.remove("is-moving"); stage.style.removeProperty("--ry"); stage.style.removeProperty("--rx"); });
  };

  /* ---------- قصاصات احتفال ---------- */
  U.confetti = (n = 140) => {
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const cv = document.createElement("canvas"); cv.className = "confetti"; document.body.appendChild(cv);
    const cx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
    const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
    const cols = ["#2E6BFF", "#0F2C66", "#F5B63A", "#FF6B2C", "#7FB0FF", "#17B26A"];
    const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.62, vx: (Math.random() - 0.5) * 16 * dpr, vy: (-Math.random() * 18 - 6) * dpr, s: (Math.random() * 8 + 5) * dpr, r: Math.random() * 6, vr: Math.random() * 0.4 - 0.2, c: cols[(Math.random() * cols.length) | 0] }));
    let f = 0;
    (function loop() {
      cx.clearRect(0, 0, W, H);
      ps.forEach(p => { p.vy += 0.5 * dpr; p.x += p.vx; p.y += p.vy; p.r += p.vr; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.6); cx.restore(); });
      if (++f < 140) requestAnimationFrame(loop); else cv.remove();
    })();
  };

  /* ---------- هيكل الصفحة ---------- */
  U.nav = function (active) {
    const host = U.$("#nav"); if (!host) return;
    host.outerHTML = `
    ${window.API.mode === "demo" ? `<div class="demo-banner">⚠️ وضع تجريبي: البيانات محفوظة في متصفحك فقط. اربط Supabase من <code>assets/js/config.js</code> للنشر الفعلي. <button type="button" id="resetDemo">إعادة ضبط البيانات التجريبية</button></div>` : ""}
    <header class="nav">
      <a class="brand" href="index.html"><img src="assets/logo-navy.png" alt="شعار صناع الأثر الرقمي"><span><b>صناع الأثر الرقمي</b><small>تحدي الـ 30 يومًا</small></span></a>
      <nav class="nav-links" aria-label="التنقل">
        <a href="index.html" class="${active === "home" ? "on" : ""}">المتصدرون</a>
        <a href="register.html" class="${active === "reg" ? "on cta" : "cta"}">سجّل الآن</a>
        <a href="admin.html" class="hide-s ${active === "admin" ? "on" : ""}">الإدارة</a>
      </nav>
    </header>`;
    const r = U.$("#resetDemo"); if (r) r.onclick = () => confirm("سيتم حذف كل البيانات التجريبية. متابعة؟") && window.API.resetDemo();
  };
  U.footer = function () {
    const host = U.$("#foot"); if (!host) return;
    host.outerHTML = `<footer class="foot"><div class="wrap foot-in">
      <div style="display:flex;gap:16px;align-items:center"><img src="assets/logo-navy.png" alt=""><p><b style="color:var(--navy)">برنامج صناع الأثر الرقمي</b><br>مبادرة مؤسسة المرقاة للتعليم والتدريب</p></div>
      <p>تابعنا على إنستغرام: <a class="ig-link" href="${C.INSTAGRAM_URL}" target="_blank" rel="noopener">@${C.INSTAGRAM_HANDLE}</a><br>جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
    </div></footer>`;
  };
})();
