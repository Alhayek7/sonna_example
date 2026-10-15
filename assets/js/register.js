/* صفحة التسجيل */
(function () {
  const { $, esc } = U;
  U.nav("reg"); U.footer();
  let photo = null;

  API.getPublic().then(r => {
    if (r.config.registration_open === false) { $("#closed").hidden = false; $("#form").hidden = true; }
  }).catch(() => {});

  $("#photo").addEventListener("change", async e => {
    const f = e.target.files[0]; $("#eph").textContent = "";
    if (!f) return;
    try {
      photo = await U.resizeImage(f);
      $("#pv").innerHTML = `<img src="${photo.dataUrl}" alt="">`;
      const im = $("#pvImg"); im.src = photo.dataUrl; im.style.objectFit = "cover"; im.style.padding = "0";
    } catch (er) { photo = null; $("#eph").textContent = er.message; }
  });
  $("#name").addEventListener("input", e => ($("#pvName").textContent = e.target.value.trim() || "اسمك هنا"));
  $("#job").addEventListener("input", e => ($("#pvJob").textContent = e.target.value.trim() || "تخصصك الوظيفي"));
  $("#ig").addEventListener("input", e => ($("#pvIg").textContent = "@" + (U.igHandle(e.target.value) || "username")));

  $("#form").addEventListener("submit", async e => {
    e.preventDefault();
    if ($("#hp").value) return; // فخ للروبوتات
    const name = $("#name").value.trim().replace(/\s+/g, " "), ig = U.igHandle($("#ig").value), job = $("#job").value.trim();
    ["eph", "enm", "eig", "ejb"].forEach(i => ($("#" + i).textContent = ""));
    let ok = true;
    if (!photo) { $("#eph").textContent = "الصورة الشخصية مطلوبة."; ok = false; }
    if (name.length < 2) { $("#enm").textContent = "اكتب اسمك الكامل."; ok = false; }
    if (!U.igValid(ig)) { $("#eig").textContent = "حساب إنستغرام غير صالح (حروف إنجليزية وأرقام ونقطة وشرطة سفلية فقط)."; ok = false; }
    if (job.length < 2) { $("#ejb").textContent = "اكتب تخصصك الوظيفي."; ok = false; }
    if (!ok) return;

    const btn = $("#btn"); btn.disabled = true; btn.textContent = "جارٍ الإرسال…"; $("#msg").innerHTML = "";
    try {
      await API.register({ name, instagram: ig, job_title: job, photoBlob: photo.blob });
      $("#formCard").innerHTML = `<div class="success"><div class="big">🎉</div><h2>وصل طلبك يا ${esc(name.split(" ")[0])}!</h2>
        <p style="color:var(--muted);max-width:420px;margin:0 auto 22px">طلبك الآن قيد المراجعة. فور اعتماده ستظهر بطاقتك في لوحة المتصدرين، وتستطيع بدء تسجيل ريلز كل يوم.</p>
        <a class="btn primary" href="index.html">الذهاب إلى لوحة التحدي</a></div>`;
      U.confetti(180);
    } catch (er) {
      const f = U.friendlyError(er);
      $("#msg").innerHTML = `<div class="alert err">${f === "dup" ? "هذا الحساب مسجّل مسبقًا. إن كان حسابك فتواصل مع الإدارة." : esc(f)}</div>`;
      btn.disabled = false; btn.textContent = "🚀 أرسل طلب التسجيل";
    }
  });
})();
