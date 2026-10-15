/* صفحة الطلبة (الرئيسية) */
(function () {
  const { $, $$, esc } = U;
  U.nav("home"); U.footer();
  U.parallax($("#stage"));

  const PAGE = 24;
  let S = { cfg: null, parts: [], checks: [], data: null, shown: PAGE };

  $("#legend").innerHTML = U.BADGES.map(b => `<div class="card3d bl" data-tilt="9"><div class="e">${b.e}</div><b>${b.n}</b><span>${b.d}</span></div>`).join("");

  /* ---------------- تحميل ---------------- */
  async function load() {
    try {
      const r = await API.getPublic();
      S.cfg = r.config; S.parts = r.participants; S.checks = r.checkins;
      S.data = U.compute(S.cfg, S.parts, S.checks);
      render();
    } catch (e) {
      console.error(e);
      $("#grid").innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="em">⚠️</div>تعذر تحميل البيانات. تأكد من إعدادات Supabase ثم أعد تحميل الصفحة.<br><small>${esc(e.message || "")}</small></div>`;
    }
  }

  /* ---------------- الرسم ---------------- */
  function segs(p, di) {
    const cols = di.total <= 30 ? 15 : 20;
    let h = `<div class="segs" style="--cols:${cols}">`;
    for (let d = 1; d <= di.total; d++) {
      let c = "";
      if (p.days.has(d)) c = "done";
      else if (di.state !== "before" && d === di.dayNo) c = "today";
      else if (d < di.dayNo) c = "miss";
      h += `<i class="seg ${c}" title="اليوم ${d}"></i>`;
    }
    return h + "</div>";
  }
  const ringSvg = (pct, done) => `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#E2E9F6" stroke-width="5"/><circle cx="50" cy="50" r="46" fill="none" stroke="${done ? "#F5B63A" : "#2E6BFF"}" stroke-width="5" stroke-linecap="round" stroke-dasharray="289.03" stroke-dashoffset="${(289.03 * (1 - pct / 100)).toFixed(1)}"/></svg>`;

  function card(p, i) {
    const di = S.data.di;
    return `<article class="card3d pcard" data-tilt="8" data-id="${p.id}" style="animation-delay:${Math.min(i, 12) * 40}ms" tabindex="0" role="button" aria-label="${esc(p.name)}">
      <div class="top">
        <div class="pav">${ringSvg(p.pct, p.count >= di.total)}<img src="${esc(U.photo(p))}" alt="" loading="lazy"><span class="rk ${p.rank <= 3 ? "g" : ""}">${p.rank <= 3 ? ["🥇", "🥈", "🥉"][p.rank - 1] : p.rank}</span></div>
        <div style="min-width:0"><h3>${esc(p.name)}</h3><div class="jb">${esc(p.job_title)}</div><span class="ig">@${esc(p.instagram)}</span></div>
      </div>
      <div class="meta"><b>${p.count}<small> / ${di.total} يوم</small></b>
        <span class="flame ${p.streak ? "" : "off"}">🔥 ${p.streak} ${p.streak === 1 ? "يوم" : "أيام"}</span></div>
      ${segs(p, di)}
      <div class="badges">${p.badges.map(b => `<span class="bdg ${b.id === "d30" ? "gold" : ""}">${b.e} ${b.n}</span>`).join("") || `<span class="bdg" style="opacity:.55">🌱 في بداية الطريق</span>`}${p.doneToday ? `<span class="bdg" style="background:#E8F8F0;color:#0d6b43;border-color:#bdebd3">✅ أنجز اليوم</span>` : ""}</div>
    </article>`;
  }

  function render() {
    const { di, list, totalReels, doneToday, activeStreaks } = S.data;

    /* الهيرو */
    const pill = $("#statusPill span:last-child");
    const arc = $("#ringArc");
    if (di.state === "running") {
      pill.textContent = `التحدي جارٍ — اليوم ${di.dayNo} من ${di.total} · متبقٍ ${di.left} يوم`;
      $("#discLbl").textContent = "اليوم"; $("#discNum").textContent = di.dayNo; $("#discSub").textContent = `من ${di.total}`;
      arc.style.strokeDashoffset = 276.46 * (1 - di.dayNo / di.total);
    } else if (di.state === "before") {
      pill.textContent = `يبدأ التحدي ${U.fmtDate(di.start)} · بعد ${di.toStart} يوم`;
      $("#discLbl").textContent = "يبدأ بعد"; $("#discNum").textContent = di.toStart; $("#discSub").textContent = "يوم";
      arc.style.strokeDashoffset = 276.46;
    } else {
      pill.textContent = "انتهى التحدي — شكرًا لكل من صنع أثره 🎉";
      $("#discLbl").textContent = "اكتمل"; $("#discNum").textContent = "🏁"; $("#discSub").textContent = `${di.total} يوم`;
      arc.style.strokeDashoffset = 0;
    }
    $("#chipReels").textContent = totalReels; $("#chipPeople").textContent = list.length;
    $("#prizeCash").textContent = S.cfg.prize_cash || "100$";

    /* الشريط */
    const items = [`📣 ${S.cfg.announcement || ""}`, `🔥 ${activeStreaks} مشاركين في سلسلة متتالية`, `🎬 ${totalReels} ريلز تم اعتماده حتى الآن`, `🏆 ${S.cfg.prize_cash || "100$"} + عضوية استوديو النقاء لـ ${S.cfg.prize_count || 5} فائزين`, `✨ لا تكسر السلسلة — انشر اليوم!`];
    const one = items.map(t => `<span>${esc(t)}</span>`).join("");
    $("#ticker").innerHTML = one + one;

    /* الإحصاءات */
    const k = { people: list.length, reels: totalReels, streaks: activeStreaks, left: di.state === "before" ? di.total : di.left };
    $$("#stats [data-k]").forEach(el => U.countUp(el, k[el.dataset.k]));

    /* اليوم */
    const stack = $("#todayStack");
    if (di.state === "running") {
      $("#todayTitle").textContent = `اليوم ${di.dayNo}: ${doneToday.length} من ${list.length} أنجزوا`;
      $("#todaySub").textContent = doneToday.length ? "أبطال اليوم — استمروا!" : "كن أول من يسجّل إنجاز اليوم 🚀";
      stack.innerHTML = doneToday.slice(0, 14).map(p => `<img class="a" src="${esc(U.photo(p))}" alt="${esc(p.name)}" title="${esc(p.name)}">`).join("") + (doneToday.length > 14 ? `<span class="more">+${doneToday.length - 14}</span>` : "");
    } else {
      $("#todayTitle").textContent = di.state === "before" ? "التحدي لم يبدأ بعد" : "انتهى التحدي";
      $("#todaySub").textContent = di.state === "before" ? "سجّل الآن لتكون جاهزًا ليوم الانطلاق." : "شكرًا لمشاركتكم. ترقّبوا إعلان الفائزين.";
      stack.innerHTML = "";
    }

    renderPodium(); renderFilters(); renderGrid();
  }

  function renderPodium() {
    const { list, di } = S.data, el = $("#podium");
    if (!list.length) { el.innerHTML = `<div class="empty" style="width:100%;direction:rtl"><div class="em">🏆</div>لا يوجد مشاركون معتمدون بعد.<br>كن أول من يعتلي المنصة!</div>`; return; }
    const slot = (p, r) => p ? `<div class="pod r${r}" data-id="${p.id}"><div class="who">${r === 1 ? '<div class="crown">👑</div>' : ""}<img class="av" src="${esc(U.photo(p))}" alt=""><div class="nm">${esc(p.name)}</div><div class="jb">${esc(p.job_title)}</div></div>
      <div class="block"><div class="n">${r}</div><div class="c">${p.count} يوم · 🔥 ${p.streak}</div></div></div>` : `<div class="pod r${r}"><div class="block" style="opacity:.25"><div class="n">${r}</div></div></div>`;
    el.innerHTML = slot(list[1], 2) + slot(list[0], 1) + slot(list[2], 3);
  }

  function renderFilters() {
    const sel = $("#jobF"), cur = sel.value;
    const jobs = [...new Set(S.parts.map(p => p.job_title.trim()))].sort((a, b) => a.localeCompare(b, "ar"));
    sel.innerHTML = `<option value="">كل التخصصات</option>` + jobs.map(j => `<option ${j === cur ? "selected" : ""}>${esc(j)}</option>`).join("");
  }

  function filtered() {
    const q = $("#q").value.trim().toLowerCase(), job = $("#jobF").value, sort = $("#sortF").value;
    let l = S.data.list.filter(p => (!job || p.job_title.trim() === job) && (!q || (p.name + " " + p.instagram + " " + p.job_title).toLowerCase().includes(q)));
    if (sort === "streak") l = [...l].sort((a, b) => b.streak - a.streak || a.rank - b.rank);
    if (sort === "today") l = [...l].sort((a, b) => Number(b.doneToday) - Number(a.doneToday) || a.rank - b.rank);
    if (sort === "new") l = [...l].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return l;
  }

  function renderGrid() {
    const l = filtered(), grid = $("#grid");
    if (!l.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="em">${S.data.list.length ? "🔎" : "🌱"}</div>${S.data.list.length ? "لا توجد نتائج مطابقة." : "لم ينضم أحد بعد. <a href='register.html' style='color:var(--blue);font-weight:800'>سجّل الآن</a>"}</div>`;
      $("#moreBtn").hidden = true; return;
    }
    grid.innerHTML = l.slice(0, S.shown).map(card).join("");
    $("#moreBtn").hidden = l.length <= S.shown;
  }

  /* ---------------- تفاعلات ---------------- */
  const reset = () => { S.shown = PAGE; renderGrid(); };
  $("#q").addEventListener("input", U.debounce(reset, 200));
  $("#jobF").addEventListener("change", reset); $("#sortF").addEventListener("change", reset);
  $("#moreBtn").onclick = () => { S.shown += PAGE; renderGrid(); };

  const open = e => {
    const t = e.target.closest("[data-id]"); if (!t) return;
    if (e.type === "keydown" && e.key !== "Enter") return;
    openParticipant(t.dataset.id);
  };
  $("#grid").addEventListener("click", open); $("#grid").addEventListener("keydown", open);
  $("#podium").addEventListener("click", open);

  function openParticipant(id) {
    const p = S.data.list.find(x => x.id === id); if (!p) return;
    const di = S.data.di; let g = "";
    for (let d = 1; d <= di.total; d++) {
      const url = S.data.links.get(p.id + ":" + d);
      const c = p.days.has(d) ? "done" : d === di.dayNo ? "today" : d < di.dayNo ? "miss" : "";
      g += p.days.has(d) && url && U.isReelUrl(url) ? `<a class="dg ${c}" href="${esc(url)}" target="_blank" rel="noopener" title="مشاهدة ريلز اليوم ${d}">${d}</a>` : `<div class="dg ${c}">${d}</div>`;
    }
    $("#pBody").innerHTML = `<button class="x" data-close type="button" aria-label="إغلاق">✕</button>
      <div class="pd-head"><img src="${esc(U.photo(p))}" alt=""><div><h3 style="margin:0">${esc(p.name)}</h3><div class="sub" style="margin:2px 0">${esc(p.job_title)}</div>
        <a class="ig" style="color:var(--blue);font-weight:800;direction:ltr;display:inline-block" href="${U.igUrl(p.instagram)}" target="_blank" rel="noopener">@${esc(p.instagram)} ↗</a></div></div>
      <div class="pd-nums"><div><b>#${p.rank}</b><span>الترتيب</span></div><div><b>${p.count}/${di.total}</b><span>أيام منجزة</span></div><div><b>🔥 ${p.streak}</b><span>سلسلة حالية</span></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${p.badges.map(b => `<span class="bdg ${b.id === "d30" ? "gold" : ""}">${b.e} ${b.n}</span>`).join("") || '<span class="bdg">🌱 في بداية الطريق</span>'}</div>
      <h4 style="margin:18px 0 0;color:var(--navy)">تقدّم الأيام <small style="color:var(--muted);font-weight:700">(اضغط على اليوم لمشاهدة الريلز)</small></h4>
      <div class="daygrid">${g}</div>
      <div class="alert info" style="margin:0">أفضل سلسلة: ${p.best} يوم · نسبة الإنجاز ${p.pct}%</div>`;
    U.openModal($("#pModal"));
  }

  /* ---------------- إرسال ريلز ---------------- */
  function openSubmit() {
    const di = S.data ? S.data.di : null, msg = $("#sMsg"); msg.innerHTML = "";
    if (!S.data || !S.data.list.length) { U.toast("لا يوجد مشاركون معتمدون بعد", "err"); return; }
    $("#sWho").innerHTML = `<option value="">— اختر اسمك —</option>` + [...S.data.list].sort((a, b) => a.name.localeCompare(b.name, "ar")).map(p => `<option value="${p.id}">${esc(p.name)} (@${esc(p.instagram)})</option>`).join("");
    let opts = ""; const max = di.state === "running" ? di.dayNo : di.state === "ended" ? di.total : 0;
    for (let d = max; d >= 1; d--) opts += `<option value="${d}">اليوم ${d}${d === di.dayNo ? " (اليوم)" : ""}</option>`;
    $("#sDay").innerHTML = opts || `<option value="">—</option>`;
    if (di.state === "before") msg.innerHTML = `<div class="alert info">التحدي لم يبدأ بعد. سيفتح الإرسال يوم ${esc(U.fmtDate(di.start))}.</div>`;
    if (S.cfg.submissions_open === false) msg.innerHTML = `<div class="alert err">الإرسال مغلق حاليًا من قِبل الإدارة.</div>`;
    U.openModal($("#sModal"));
  }
  $("#openSubmit").onclick = $("#openSubmit2").onclick = openSubmit;

  $("#sForm").addEventListener("submit", async e => {
    e.preventDefault();
    const pid = $("#sWho").value, day = Number($("#sDay").value), url = $("#sUrl").value.trim(), msg = $("#sMsg");
    const bad = t => (msg.innerHTML = `<div class="alert err">${t}</div>`);
    if (!pid) return bad("اختر اسمك من القائمة.");
    if (!day) return bad("لا توجد أيام متاحة للإرسال الآن.");
    if (!U.isReelUrl(url)) return bad("الصق رابط إنستغرام صحيحًا (يبدأ بـ https://www.instagram.com/...).");
    const p = S.data.list.find(x => x.id === pid);
    if (p && p.days.has(day)) return bad("هذا اليوم معتمد لك مسبقًا 👏");
    const btn = $("#sBtn"); btn.disabled = true; btn.textContent = "جارٍ الإرسال…";
    try {
      await API.submitReel({ participant_id: pid, day, reel_url: url });
      U.closeModal($("#sModal")); $("#sUrl").value = ""; U.confetti(); U.toast("وصل! سيعتمده المشرف قريبًا ✅", "ok");
    } catch (er) {
      const f = U.friendlyError(er); bad(f === "dup" ? "تم إرسال هذا اليوم مسبقًا وهو بانتظار الاعتماد." : esc(f));
    } finally { btn.disabled = false; btn.textContent = "إرسال للاعتماد"; }
  });

  /* ---------------- تحديث حي ---------------- */
  API.subscribe(U.debounce(load, 800));
  setInterval(() => { if (!document.hidden) load(); }, 60000);
  load();
})();
