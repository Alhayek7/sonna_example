/* طبقة البيانات: Supabase عند توفر الإعدادات، وإلا وضع تجريبي محلي (localStorage) */
(function () {
  const C = window.APP_CONFIG;
  const live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  const API = { mode: live ? "supabase" : "demo" };
  window.API = API;

  const uuid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16);
    }));
  API.uuid = uuid;

  const DEFAULT_CONFIG = {
    id: 1, title: "تحدي الـ 30 يومًا", start_date: new Date().toISOString().slice(0, 10), total_days: 30,
    registration_open: true, submissions_open: true,
    announcement: "الاستمرارية هي السر — انشر ريلز اليوم واصنع أثرك!",
    prize_cash: "100$", prize_count: 5
  };

  /* ============================ Supabase ============================ */
  if (live) {
    let sb = null;
    API.ready = (async function () {
      if (!window.supabase) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
          s.onload = res; s.onerror = () => rej(new Error("تعذر تحميل مكتبة Supabase"));
          document.head.appendChild(s);
        });
      }
      sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      API.sb = sb;
    })();

    const must = r => { if (r.error) throw r.error; return r.data; };

    API.getPublic = async () => {
      await API.ready;
      const [cfg, ps, cs] = await Promise.all([
        sb.from("config").select("*").eq("id", 1).maybeSingle(),
        sb.from("participants").select("*").eq("status", "approved").order("created_at"),
        sb.from("checkins").select("id,participant_id,day,status,reel_url,created_at").eq("status", "approved").range(0, 9999)
      ]);
      return { config: must(cfg) || DEFAULT_CONFIG, participants: must(ps), checkins: must(cs) };
    };

    API.register = async ({ name, instagram, job_title, photoBlob }) => {
      await API.ready;
      const id = uuid();
      let photo_url = null;
      if (photoBlob) {
        const path = `${id}.jpg`;
        const up = await sb.storage.from("avatars").upload(path, photoBlob, { contentType: "image/jpeg", upsert: false });
        if (up.error) throw up.error;
        photo_url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const r = await sb.from("participants").insert({ id, name, instagram, job_title, photo_url, status: "pending" });
      if (r.error) throw r.error;
      return true;
    };

    API.submitReel = async ({ participant_id, day, reel_url }) => {
      await API.ready;
      const r = await sb.from("checkins").insert({ participant_id, day, reel_url, status: "pending" });
      if (r.error) throw r.error;
      return true;
    };

    API.subscribe = cb => {
      API.ready.then(() => {
        sb.channel("public-feed-" + Math.random().toString(36).slice(2))
          .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, cb)
          .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, cb)
          .on("postgres_changes", { event: "*", schema: "public", table: "config" }, cb)
          .subscribe();
      });
    };

    /* ---- الإدارة ---- */
    API.adminLogin = async (username, password) => {
      await API.ready;
      const email = username.includes("@") ? username : `${username.trim().toLowerCase()}@${C.ADMIN_EMAIL_DOMAIN}`;
      const r = await sb.auth.signInWithPassword({ email, password });
      if (r.error) throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة");
      if (!(await API.isAdmin())) { await sb.auth.signOut(); throw new Error("هذا الحساب ليس مديراً للتحدي"); }
      return true;
    };
    API.isAdmin = async () => {
      await API.ready;
      const { data } = await sb.auth.getSession();
      if (!data.session) return false;
      const r = await sb.from("admins").select("user_id").eq("user_id", data.session.user.id).maybeSingle();
      return !!r.data;
    };
    API.adminLogout = async () => { await API.ready; await sb.auth.signOut(); };
    API.getAdmin = async () => {
      await API.ready;
      const [cfg, ps, cs] = await Promise.all([
        sb.from("config").select("*").eq("id", 1).maybeSingle(),
        sb.from("participants").select("*").order("created_at"),
        sb.from("checkins").select("*").range(0, 9999)
      ]);
      return { config: must(cfg) || DEFAULT_CONFIG, participants: must(ps), checkins: must(cs) };
    };
    API.setCheckin = async (participant_id, day, { status = "approved", reel_url = null } = {}) => {
      const r = await sb.from("checkins").upsert({ participant_id, day, status, reel_url }, { onConflict: "participant_id,day" });
      if (r.error) throw r.error;
    };
    API.bulkApprove = async (rows) => {
      const r = await sb.from("checkins").upsert(rows.map(x => ({ ...x, status: "approved" })), { onConflict: "participant_id,day", ignoreDuplicates: false });
      if (r.error) throw r.error;
    };
    API.removeCheckin = async (participant_id, day) => {
      const r = await sb.from("checkins").delete().eq("participant_id", participant_id).eq("day", day);
      if (r.error) throw r.error;
    };
    API.approveCheckinIds = async ids => {
      const r = await sb.from("checkins").update({ status: "approved" }).in("id", ids);
      if (r.error) throw r.error;
    };
    API.deleteCheckinIds = async ids => {
      const r = await sb.from("checkins").delete().in("id", ids);
      if (r.error) throw r.error;
    };
    API.updateParticipant = async (id, fields) => {
      const r = await sb.from("participants").update(fields).eq("id", id);
      if (r.error) throw r.error;
    };
    API.deleteParticipant = async id => {
      const r = await sb.from("participants").delete().eq("id", id);
      if (r.error) throw r.error;
    };
    API.saveConfig = async cfg => {
      const r = await sb.from("config").upsert({ ...cfg, id: 1, updated_at: new Date().toISOString() });
      if (r.error) throw r.error;
    };
    API.addParticipantAdmin = async ({ name, instagram, job_title, photoBlob }) => {
      const id = uuid(); let photo_url = null;
      if (photoBlob) {
        const up = await sb.storage.from("avatars").upload(`${id}.jpg`, photoBlob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        photo_url = sb.storage.from("avatars").getPublicUrl(`${id}.jpg`).data.publicUrl;
      }
      const r = await sb.from("participants").insert({ id, name, instagram, job_title, photo_url, status: "approved" });
      if (r.error) throw r.error;
    };
    return;
  }

  /* ============================ وضع تجريبي ============================ */
  const KEY = "sanaa_demo_v1";
  const AUTH = "sanaa_demo_admin";
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

  function avatar(name, hue) {
    const ch = (name || "؟").trim().charAt(0);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${hue},80%,62%)'/><stop offset='1' stop-color='hsl(${(hue + 40) % 360},75%,40%)'/></linearGradient></defs><rect width='240' height='240' fill='url(#g)'/><text x='50%' y='56%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='110' font-weight='700' fill='white'>${ch}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function seed() {
    const start = new Date(); start.setDate(start.getDate() - 11);
    const people = [
      ["ليان الحايك", "layan.designs", "مصممة جرافيك", 12, 1.0],
      ["أحمد الخطيب", "ahmad.creates", "صانع محتوى", 12, 0.95],
      ["سارة عودة", "sara.writes", "كاتبة محتوى", 12, 0.9],
      ["محمد النتشة", "m.natsheh", "مونتير فيديو", 12, 0.85],
      ["رنا أبو سنينة", "rana.abs", "مسوّقة رقمية", 12, 0.8],
      ["يوسف دعنا", "yousef.d", "مصور فوتوغرافي", 12, 0.72],
      ["هديل القواسمي", "hadeel.q", "مصممة UI/UX", 12, 0.66],
      ["خالد الجعبري", "khaled.jab", "مطوّر مواقع", 12, 0.6],
      ["دانا البطش", "dana.b", "مدرّبة تطوير ذات", 12, 0.5],
      ["عمر الشريف", "omar.sh", "مذيع بودكاست", 12, 0.42],
      ["آية زيدان", "aya.zaidan", "طالبة تسويق", 12, 0.35],
      ["إبراهيم رجبي", "ibrahim.r", "مبرمج", 12, 0.25]
    ];
    const participants = [], checkins = [];
    let seedN = 7;
    const rnd = () => ((seedN = (seedN * 9301 + 49297) % 233280) / 233280);
    people.forEach((p, i) => {
      const id = uuid();
      participants.push({ id, name: p[0], instagram: p[1], job_title: p[2], photo_url: avatar(p[0], (i * 53 + 210) % 360), status: "approved", created_at: new Date(Date.now() - (12 - i) * 36e5).toISOString() });
      for (let d = 1; d <= p[3]; d++) if (rnd() < p[4]) checkins.push({ id: uuid(), participant_id: id, day: d, status: "approved", reel_url: `https://instagram.com/reel/demo${i}${d}`, created_at: new Date().toISOString() });
    });
    participants.push({ id: uuid(), name: "تجريبي بانتظار المراجعة", instagram: "pending.user", job_title: "مصمم", photo_url: avatar("ت", 20), status: "pending", created_at: new Date().toISOString() });
    checkins.push({ id: uuid(), participant_id: participants[3].id, day: 12, status: "pending", reel_url: "https://instagram.com/reel/pendingdemo", created_at: new Date().toISOString() });
    return { config: { ...DEFAULT_CONFIG, start_date: iso(start) }, participants, checkins };
  }

  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); if (v) return v; } catch (e) {} const s = seed(); save(s); return s; };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { throw new Error("امتلأ مخزن المتصفح التجريبي"); } };
  const delay = v => new Promise(r => setTimeout(() => r(v), 120));
  API.ready = Promise.resolve();
  API.resetDemo = () => { localStorage.removeItem(KEY); location.reload(); };

  const blobToDataUrl = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });

  API.getPublic = async () => {
    const s = load();
    return delay({
      config: s.config,
      participants: s.participants.filter(p => p.status === "approved"),
      checkins: s.checkins.filter(c => c.status === "approved")
    });
  };
  API.register = async ({ name, instagram, job_title, photoBlob }) => {
    const s = load();
    if (s.participants.some(p => p.instagram.toLowerCase() === instagram.toLowerCase())) { const e = new Error("dup"); e.code = "23505"; throw e; }
    const photo_url = photoBlob ? await blobToDataUrl(photoBlob) : null;
    s.participants.push({ id: uuid(), name, instagram, job_title, photo_url, status: "pending", created_at: new Date().toISOString() });
    save(s); return delay(true);
  };
  API.submitReel = async ({ participant_id, day, reel_url }) => {
    const s = load();
    if (s.checkins.some(c => c.participant_id === participant_id && c.day === day)) { const e = new Error("dup"); e.code = "23505"; throw e; }
    s.checkins.push({ id: uuid(), participant_id, day, status: "pending", reel_url, created_at: new Date().toISOString() });
    save(s); return delay(true);
  };
  API.subscribe = cb => { window.addEventListener("storage", e => { if (e.key === KEY) cb(); }); };

  API.adminLogin = async (u, p) => {
    if (u.trim().toLowerCase() === "admin" && p === "admin123") { sessionStorage.setItem(AUTH, "1"); return true; }
    throw new Error("اسم المستخدم أو كلمة المرور غير صحيحة (التجريبي: admin / admin123)");
  };
  API.isAdmin = async () => sessionStorage.getItem(AUTH) === "1";
  API.adminLogout = async () => sessionStorage.removeItem(AUTH);
  API.getAdmin = async () => { const s = load(); return delay({ config: s.config, participants: s.participants, checkins: s.checkins }); };
  API.setCheckin = async (pid, day, { status = "approved", reel_url = null } = {}) => {
    const s = load(); const c = s.checkins.find(x => x.participant_id === pid && x.day === day);
    if (c) { c.status = status; c.reel_url = reel_url; } else s.checkins.push({ id: uuid(), participant_id: pid, day, status, reel_url, created_at: new Date().toISOString() });
    save(s);
  };
  API.bulkApprove = async rows => { for (const r of rows) await API.setCheckin(r.participant_id, r.day, { status: "approved", reel_url: r.reel_url || null }); };
  API.removeCheckin = async (pid, day) => { const s = load(); s.checkins = s.checkins.filter(c => !(c.participant_id === pid && c.day === day)); save(s); };
  API.approveCheckinIds = async ids => { const s = load(); s.checkins.forEach(c => { if (ids.includes(c.id)) c.status = "approved"; }); save(s); };
  API.deleteCheckinIds = async ids => { const s = load(); s.checkins = s.checkins.filter(c => !ids.includes(c.id)); save(s); };
  API.updateParticipant = async (id, f) => { const s = load(); Object.assign(s.participants.find(p => p.id === id) || {}, f); save(s); };
  API.deleteParticipant = async id => { const s = load(); s.participants = s.participants.filter(p => p.id !== id); s.checkins = s.checkins.filter(c => c.participant_id !== id); save(s); };
  API.saveConfig = async cfg => { const s = load(); s.config = { ...s.config, ...cfg }; save(s); };
  API.addParticipantAdmin = async ({ name, instagram, job_title, photoBlob }) => {
    const s = load(); const photo_url = photoBlob ? await blobToDataUrl(photoBlob) : avatar(name, Math.floor(Math.random() * 360));
    s.participants.push({ id: uuid(), name, instagram, job_title, photo_url, status: "approved", created_at: new Date().toISOString() }); save(s);
  };
  API.avatar = avatar;
})();
