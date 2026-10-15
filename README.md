# تحدي الـ 30 يومًا | صناع الأثر الرقمي

موقع ثابت (HTML/CSS/JS) + قاعدة بيانات Supabase، ويُنشر مجانًا على GitHub Pages.

الصفحات: `index.html` (الطلبة) · `register.html` (التسجيل) · `admin.html` (الإدارة)

## 1) إعداد Supabase (5 دقائق)
1. أنشئ مشروعًا على supabase.com.
2. SQL Editor ▸ New query ▸ الصق محتوى `supabase/schema.sql` كاملًا ▸ Run.
3. Authentication ▸ Users ▸ Add user ▸ Create new user:
   البريد `admin@sanaa.app` (اسم المستخدم = admin) + كلمة مرور قوية، وفعّل **Auto Confirm User**.
4. في SQL Editor شغّل:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'admin@sanaa.app' on conflict do nothing;
   ```
5. Authentication ▸ Providers ▸ Email: عطّل "Allow new users to sign up" حتى لا يُنشئ أحد حسابًا.
6. Project Settings ▸ API: انسخ **Project URL** و **anon public key**.

## 2) ربط الموقع
افتح `assets/js/config.js` وضع القيمتين في `SUPABASE_URL` و `SUPABASE_ANON_KEY`.
(لا تضع مفتاح service_role أبدًا.) مفتاح anon آمن للنشر لأن سياسات RLS تحمي البيانات.

## 3) النشر على GitHub Pages
1. أنشئ مستودعًا جديدًا وارفع كل الملفات.
2. Settings ▸ Pages ▸ Source: Deploy from a branch ▸ `main` / root ▸ Save.
3. الرابط: `https://USERNAME.github.io/REPO/`

## 4) الاستخدام
- الإدارة: `/admin.html` ← اسم المستخدم `admin`. اضبط تاريخ البداية من «الإعدادات».
- يوميًا: «المتابعة اليومية» ← عرض اليوم ← اضغط المفتاح لكل مشارك، أو «تحديد الكل».
- المشاركون يرسلون رابط الريلز من الصفحة الرئيسية، فيصلك في «بانتظار الاعتماد» وتعتمده بضغطة.
- طلبات التسجيل الجديدة تعتمدها من «المشاركون».

## ملاحظات
- بدون إعداد Supabase يعمل الموقع بوضع تجريبي محلي (دخول الإدارة: admin / admin123) لمعاينة التصميم فقط.
- لتغيير اسم المستخدم غيّر البريد في Supabase و `ADMIN_EMAIL_DOMAIN` إن لزم.
