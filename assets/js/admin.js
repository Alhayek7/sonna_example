/* صفحة الإدارة */
(function () {
  const { $, $$, esc } = U;
  U.nav("admin"); U.footer();

  let A = { cfg: null, parts: [], checks: [], view: "day", day: 1 };
  let editing = null, ePhoto = null;
  const key = (p, d) => p + ":" + d;
  const cmap = () => new Map(A.checks.map(c => [key(c.participant_id, c.day), c]));
  const approved = () => A.parts.filter(p => p.status === "approved");
  const pById = id => A.parts.find(p => p.id === id);

  /* ---------------- الدخول ---------------- */
  async function boot() {
    if (await API.isAdmin()) { $("#login").hidden = true; $("#app").hidden = false; await load(true); }
    else { $("#login").hidden = false; $("#app").hidden = true; }
  }
  $("#lf").addEventListener("submit", async e => {
    e.preventDefault(); const b = $("#lb"); b.disabled = true; $("#lmsg").innerHTML = "";
    try { await API.adminLogin($("#lu").value, $("#lp").value); $("#lp").value = ""; await boot(); }
    catch (er) { $("#lmsg").innerHTML = `<div class="alert err">${esc(er.message)}</div>`; }
    b.disabled = false;
  });
  $("#logout").onclick = async () => { await API.adminLogout(); location.reload(); };

  /* ---------------- تحميل ---------------- */
  async function load(first) {
    try {
      const r = await API.getAdmin();
      A.cfg = r.config; A.parts = r.participants; A.checks = r.checkins;
      const di = U.dayInfo(A.cfg);
      if (first || !A.day) A.day = Math.min(Math.max(di.dayNo, 1), di.total);
      renderAll();
    } catch (e) { U.toast(U.friendlyError(e), "err"); }
  }
  $("#refresh").onclick = () => load().then(() => U.toast("تم التحديث", "ok"));
  const safe = fn => async (...a) => { try { await fn(...a); } catch (e) { U.toast(U.friendlyError(e), "err"); await load(); } };

  /* ---------------- الرسم العام ---------------- */
  function renderAll() {
    const di = U.dayInfo(A.cfg), ap = approved();
    const pend = A.checks.filter(c => c.status === "pending"), reg = A.parts.filter(p => p.status === "pending");
    $("#dayLine").textContent = di.state === "running" ? `اليوم ${di.dayNo} من ${di.total} · ${U.fmtDate(new Date())}` : di.state === "before" ? `يبدأ ${U.fmtDate(di.start)}` : "انتهى التحدي";
    const doneToday = ap.filter(p => A.checks.some(c => c.participant_id === p.id && c.day === di.dayNo && c.status === "approved")).length;
    $("#kpis").innerHTML = [
      ["👥", ap.length, "مشارك معتمد"], ["✅", doneToday, "أنجزوا اليوم"], ["⏳", pend.length, "روابط بانتظار الاعتماد"], ["📨", reg.length, "طلبات تسجيل جديدة"],
      ["🎬", A.checks.filter(c => c.status === "approved").length, "إجمالي الإنجازات"]
    ].map(k => `<div class="card3d kpi" data-tilt="6"><span>${k[0]} ${k[2]}</span><b>${k[1]}</b></div>`).join("");
    $("#cPend").hidden = !pend.length; $("#cPend").textContent = pend.length;
    $("#cReg").hidden = !reg.length; $("#cReg").textContent = reg.length;
    $("#daySel").innerHTML = Array.from({ length: di.total }, (_, i) => i + 1).map(d => `<option value="${d}" ${d === A.day ? "selected" : ""}>اليوم ${d}${d === di.dayNo ? " ← اليوم" : ""}</option>`).join("");
    renderTrack(); renderPend(); renderPeople(); fillSettings();
  }

  /* ---------------- المتابعة ---------------- */
  $("#vDay").onclick = () => { A.view = "day"; renderTrack(); };
  $("#vGrid").onclick = () => { A.view = "grid"; renderTrack(); };
  $("#daySel").onchange = e => { A.day = Number(e.target.value); renderTrack(); };
  $("#allDay").onclick = safe(async () => bulkDay(A.day));

  async function bulkDay(day) {
    const m = cmap(), rows = approved().filter(p => !(m.get(key(p.id, day)) || {}).status || m.get(key(p.id, day)).status !== "approved").map(p => ({ participant_id: p.id, day, reel_url: (m.get(key(p.id, day)) || {}).reel_url || null }));
    if (!rows.length) return U.toast("الجميع معتمد لهذا اليوم بالفعل");
    if (!confirm(`تحديد ${rows.length} مشارك كمنجزين لليوم ${day}؟`)) return;
    await API.bulkApprove(rows); await load(); U.toast("تم التحديد ✅", "ok");
  }

  function renderTrack() {
    $("#vDay").className = "btn sm " + (A.view === "day" ? "primary" : "ghost");
    $("#vGrid").className = "btn sm " + (A.view === "grid" ? "primary" : "ghost");
    $("#dayCtl").hidden = A.view !== "day"; $("#gridHint").hidden = A.view !== "grid";
    const ap = approved(), body = $("#trackBody");
    if (!ap.length) { body.innerHTML = `<div class="empty"><div class="em">👥</div>لا يوجد مشاركون معتمدون. اعتمد طلبات التسجيل من تبويب «المشاركون».</div>`; return; }
    A.view === "day" ? renderDay(ap, body) : renderGrid(ap, body);
  }

  function renderDay(ap, body) {
    const m = cmap(), d = A.day;
    body.innerHTML = `<div class="dayview">` + ap.map(p => {
      const c = m.get(key(p.id, d)), on = c && c.status === "approved";
      return `<div class="dv-row" data-p="${p.id}">
        <div class="who"><img src="${esc(U.photo(p))}" alt=""><div style="min-width:0"><b>${esc(p.name)}</b><small>${esc(p.job_title)}${c && c.status === "pending" ? ' · <span class="pill p">بانتظار الاعتماد</span>' : ""}</small></div></div>
        <button class="big-toggle ${on ? "on" : ""}" type="button" data-tg aria-pressed="${!!on}" aria-label="تبديل إنجاز ${esc(p.name)}"></button>
        <div class="url"><input class="input input-ltr" data-url placeholder="رابط الريلز (اختياري)" value="${esc((c && c.reel_url) || "")}"></div></div>`;
    }).join("") + `</div>`;
  }

  function renderGrid(ap, body) {
    const di = U.dayInfo(A.cfg), m = cmap();
    let h = `<div class="gridwrap"><table class="tg"><thead><tr><th class="nm">المشارك</th>`;
    for (let d = 1; d <= di.total; d++) h += `<th class="dh ${d === di.dayNo ? "cur" : ""}" data-day="${d}" title="تحديد الجميع لليوم ${d}">${d}</th>`;
    h += `<th class="tot">الإجمالي</th></tr></thead><tbody>`;
    ap.forEach(p => {
      let n = 0, cells = "";
      for (let d = 1; d <= di.total; d++) {
        const c = m.get(key(p.id, d)), st = c ? c.status : "";
        if (st === "approved") n++;
        cells += `<td><button type="button" class="cell ${st === "approved" ? "ok" : st === "pending" ? "pend" : ""} ${d > di.dayNo ? "future" : ""}" data-p="${p.id}" data-d="${d}" title="${esc(p.name)} — اليوم ${d}">${st === "approved" ? "✓" : st === "pending" ? "…" : ""}${c && c.reel_url ? '<i class="lk"></i>' : ""}</button></td>`;
      }
      h += `<tr><td class="nm"><div class="who"><img src="${esc(U.photo(p))}" alt=""><div><b>${esc(p.name)}</b><small>@${esc(p.instagram)}</small></div></div></td>${cells}<td class="tot">${n}/${di.total}</td></tr>`;
    });
    body.innerHTML = h + `</tbody></table></div>`;
  }

  /* تبديل الخلية */
  async function toggle(pid, d) {
    const c = cmap().get(key(pid, d));
    if (c && c.status === "approved") { await API.removeCheckin(pid, d); A.checks = A.checks.filter(x => !(x.participant_id === pid && x.day === d)); }
    else { await API.setCheckin(pid, d, { status: "approved", reel_url: c ? c.reel_url : null }); if (c) c.status = "approved"; else A.checks.push({ participant_id: pid, day: d, status: "approved", reel_url: null }); }
  }
  $("#trackBody").addEventListener("click", safe(async e => {
    const cell = e.target.closest(".cell"), tg = e.target.closest("[data-tg]"), dh = e.target.closest("th.dh");
    if (cell) { await toggle(cell.dataset.p, Number(cell.dataset.d)); renderAll(); }
    else if (tg) { await toggle(tg.closest("[data-p]").dataset.p, A.day); renderAll(); }
    else if (dh) await bulkDay(Number(dh.dataset.day));
  }));
  const askUrl = safe(async (pid, d) => {
    const c = cmap().get(key(pid, d)), v = prompt("رابط الريلز لهذا اليوم (اتركه فارغاً للحذف):", (c && c.reel_url) || "");
    if (v === null) return;
    if (v.trim() && !U.isReelUrl(v.trim())) return U.toast("الرابط يجب أن يكون من إنستغرام", "err");
    await API.setCheckin(pid, d, { status: c ? c.status : "approved", reel_url: v.trim() || null }); await load();
  });
  $("#trackBody").addEventListener("contextmenu", e => { const c = e.target.closest(".cell"); if (c) { e.preventDefault(); askUrl(c.dataset.p, Number(c.dataset.d)); } });
  let lp; $("#trackBody").addEventListener("touchstart", e => { const c = e.target.closest(".cell"); if (c) lp = setTimeout(() => askUrl(c.dataset.p, Number(c.dataset.d)), 650); }, { passive: true });
  ["touchend", "touchmove", "touchcancel"].forEach(ev => $("#trackBody").addEventListener(ev, () => clearTimeout(lp), { passive: true }));
  $("#trackBody").addEventListener("change", safe(async e => {
    const inp = e.target.closest("[data-url]"); if (!inp) return;
    const pid = inp.closest("[data-p]").dataset.p, v = inp.value.trim(), c = cmap().get(key(pid, A.day));
    if (v && !U.isReelUrl(v)) { U.toast("الرابط يجب أن يكون من إنستغرام", "err"); return; }
    if (!c && !v) return;
    await API.setCheckin(pid, A.day, { status: c ? c.status : "approved", reel_url: v || null }); await load(); U.toast("تم حفظ الرابط", "ok");
  }));

  /* ---------------- بانتظار الاعتماد ---------------- */
  function renderPend() {
    const l = A.checks.filter(c => c.status === "pending").sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    $("#apprAll").hidden = !l.length;
    $("#pendList").innerHTML = l.length ? l.map(c => { const p = pById(c.participant_id); if (!p) return ""; return `<div class="li" data-id="${c.id}">
      <div class="who"><img src="${esc(U.photo(p))}" alt=""><div><b>${esc(p.name)} <span class="pill p">اليوم ${c.day}</span></b><small>${c.reel_url ? `<a href="${esc(c.reel_url)}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:800;direction:ltr;display:inline-block">فتح الريلز ↗</a>` : "بدون رابط"}</small></div></div>
      <div class="acts"><button class="btn sm primary" data-ap type="button">✔ اعتماد</button><button class="btn sm danger" data-rj type="button">✕ رفض</button></div></div>`; }).join("")
      : `<div class="empty"><div class="em">🎉</div>لا توجد روابط بانتظار الاعتماد.</div>`;
  }
  $("#pendList").addEventListener("click", safe(async e => {
    const li = e.target.closest(".li"); if (!li) return; const id = li.dataset.id;
    if (e.target.closest("[data-ap]")) { await API.approveCheckinIds([id]); U.toast("تم الاعتماد ✅", "ok"); }
    else if (e.target.closest("[data-rj]")) { if (!confirm("رفض هذا الرابط وحذفه؟")) return; await API.deleteCheckinIds([id]); }
    else return; await load();
  }));
  $("#apprAll").onclick = safe(async () => {
    const ids = A.checks.filter(c => c.status === "pending").map(c => c.id); if (!ids.length || !confirm(`اعتماد ${ids.length} رابط؟`)) return;
    await API.approveCheckinIds(ids); await load(); U.toast("تم اعتماد الكل ✅", "ok");
  });

  /* ---------------- المشاركون ---------------- */
  const person = (p, acts) => `<div class="li" data-id="${p.id}"><div class="who"><img src="${esc(U.photo(p))}" alt=""><div><b>${esc(p.name)}</b><small>${esc(p.job_title)} · <span style="direction:ltr;display:inline-block">@${esc(p.instagram)}</span></small></div></div><div class="acts">${acts}</div></div>`;
  function renderPeople() {
    const reg = A.parts.filter(p => p.status === "pending"), ap = approved(), rj = A.parts.filter(p => p.status === "rejected");
    $("#regList").innerHTML = reg.length ? reg.map(p => person(p, `<button class="btn sm primary" data-a="approve" type="button">✔ قبول</button><button class="btn sm danger" data-a="reject" type="button">✕ رفض</button><button class="btn sm ghost" data-a="edit" type="button">تعديل</button>`)).join("") : `<div class="empty" style="padding:26px">لا توجد طلبات جديدة.</div>`;
    $("#apprList").innerHTML = ap.length ? ap.map(p => person(p, `<button class="btn sm ghost" data-a="edit" type="button">✎ تعديل</button><button class="btn sm ghost" data-a="reject" type="button">إيقاف</button><button class="btn sm danger" data-a="del" type="button">🗑 حذف</button>`)).join("") : `<div class="empty" style="padding:26px">لا يوجد مشاركون معتمدون بعد.</div>`;
    $("#rejT").hidden = !rj.length;
    $("#rejList").innerHTML = rj.map(p => person(p, `<button class="btn sm primary" data-a="approve" type="button">استرجاع</button><button class="btn sm danger" data-a="del" type="button">🗑 حذف</button>`)).join("");
  }
  $("#p-people").addEventListener("click", safe(async e => {
    const b = e.target.closest("[data-a]"); if (!b) return; const id = b.closest(".li").dataset.id, p = pById(id), a = b.dataset.a;
    if (a === "approve") { await API.updateParticipant(id, { status: "approved" }); U.toast("تم القبول ✅", "ok"); }
    else if (a === "reject") await API.updateParticipant(id, { status: "rejected" });
    else if (a === "del") { if (!confirm(`حذف ${p.name} نهائيًا مع كل إنجازاته؟`)) return; await API.deleteParticipant(id); }
    else if (a === "edit") return openEdit(p);
    await load();
  }));

  function openEdit(p) {
    editing = p || null; ePhoto = null; $("#eMsg").innerHTML = "";
    $("#eTitle").textContent = p ? "تعديل مشارك" : "إضافة مشارك";
    $("#eName").value = p ? p.name : ""; $("#eIg").value = p ? p.instagram : ""; $("#eJob").value = p ? p.job_title : "";
    $("#ePv").innerHTML = p ? `<img src="${esc(U.photo(p))}" alt="">` : "📷"; $("#ePhoto").value = "";
    U.openModal($("#eModal"));
  }
  $("#addP").onclick = () => openEdit(null);
  $("#ePhoto").addEventListener("change", async e => {
    try { ePhoto = await U.resizeImage(e.target.files[0]); $("#ePv").innerHTML = `<img src="${ePhoto.dataUrl}" alt="">`; } catch (er) { U.toast(er.message, "err"); }
  });
  $("#eForm").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#eName").value.trim(), ig = U.igHandle($("#eIg").value), job = $("#eJob").value.trim(), bad = t => ($("#eMsg").innerHTML = `<div class="alert err">${t}</div>`);
    if (name.length < 2 || job.length < 2) return bad("الاسم والتخصص مطلوبان.");
    if (!U.igValid(ig)) return bad("حساب إنستغرام غير صالح.");
    const btn = $("#eBtn"); btn.disabled = true;
    try {
      if (editing) {
        const f = { name, instagram: ig, job_title: job };
        if (ePhoto) { if (API.mode === "demo") f.photo_url = ePhoto.dataUrl; else { const path = `${editing.id}-${Date.now()}.jpg`; const up = await API.sb.storage.from("avatars").upload(path, ePhoto.blob, { contentType: "image/jpeg" }); if (up.error) throw up.error; f.photo_url = API.sb.storage.from("avatars").getPublicUrl(path).data.publicUrl; } }
        await API.updateParticipant(editing.id, f);
      } else await API.addParticipantAdmin({ name, instagram: ig, job_title: job, photoBlob: ePhoto && ePhoto.blob });
      U.closeModal($("#eModal")); await load(); U.toast("تم الحفظ ✅", "ok");
    } catch (er) { const m = U.friendlyError(er); bad(m === "dup" ? "حساب إنستغرام هذا مسجّل مسبقًا." : esc(m)); }
    btn.disabled = false;
  });

  /* ---------------- الإعدادات ---------------- */
  function fillSettings() {
    if (document.activeElement && document.activeElement.closest("#setForm")) return;
    const c = A.cfg; $("#sT").value = c.title || ""; $("#sS").value = String(c.start_date).slice(0, 10); $("#sN").value = c.total_days;
    $("#sPc").value = c.prize_cash || ""; $("#sPn").value = c.prize_count || 5; $("#sA").value = c.announcement || "";
    $("#sReg").checked = c.registration_open !== false; $("#sSub").checked = c.submissions_open !== false;
  }
  $("#setForm").addEventListener("submit", safe(async e => {
    e.preventDefault();
    const total = Number($("#sN").value);
    if (!$("#sS").value || !(total >= 1 && total <= 120)) return U.toast("تحقق من التاريخ وعدد الأيام", "err");
    await API.saveConfig({ title: $("#sT").value.trim() || "تحدي الـ 30 يومًا", start_date: $("#sS").value, total_days: total, prize_cash: $("#sPc").value.trim(), prize_count: Number($("#sPn").value) || 5, announcement: $("#sA").value.trim(), registration_open: $("#sReg").checked, submissions_open: $("#sSub").checked });
    await load(); U.toast("تم حفظ الإعدادات ✅", "ok");
  }));
  $("#csv").onclick = () => {
    const r = U.compute(A.cfg, approved(), A.checks.filter(c => c.status === "approved"));
    const rows = [["الترتيب", "الاسم", "إنستغرام", "التخصص", "الأيام المنجزة", "السلسلة الحالية", "أفضل سلسلة"], ...r.list.map(p => [p.rank, p.name, "@" + p.instagram, p.job_title, p.count, p.streak, p.best])];
    const csv = "﻿" + rows.map(x => x.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "results.csv"; a.click();
  };

  /* ---------------- تبويبات ---------------- */
  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.classList.toggle("on", x === t)); $$(".panel").forEach(p => p.classList.toggle("on", p.id === "p-" + t.dataset.t));
  });

  API.subscribe(U.debounce(() => { if (!$("#app").hidden && !(document.activeElement && document.activeElement.matches("input,textarea"))) load(); }, 800));
  boot();
})();
