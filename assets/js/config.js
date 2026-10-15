/* =====================================================================
   إعدادات الموقع — عدّل هذا الملف فقط
   ضع رابط مشروع Supabase ومفتاح anon (العام). لا تضع مفتاح service_role أبداً.
   إذا تُركت القيم فارغة يعمل الموقع بوضع «تجريبي» محلي لمعاينة التصميم.
   ===================================================================== */
window.APP_CONFIG = {
  SUPABASE_URL: "",       // مثال: https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "",  // مفتاح anon public

  // اسم المستخدم للمدير يتحول داخلياً إلى بريد بهذا النطاق
  // (admin  →  admin@sanaa.app) ويجب أن يطابق المستخدم المُنشأ في Supabase Auth
  ADMIN_EMAIL_DOMAIN: "sanaa.app",

  // رابط حساب المنصة في إنستغرام
  INSTAGRAM_URL: "https://instagram.com/sonna3athr",
  INSTAGRAM_HANDLE: "sonna3athr",

  // الحد الأقصى لحجم الصورة بعد الضغط (بكسل)
  AVATAR_SIZE: 480
};
