## المشكلة
كل ما المستخدم يفتح صفحة محمية (لوحة التحكم / المستخدمين)، الكود بيعمل fetch جديد لجداول `user_roles` و `user_permissions` من السيرفر، وبيعرض رسالة "جارٍ التحقق من الصلاحيات..." لحد ما الـ request يخلص. ده بيحصل لأن الـ hook `usePermissions` مالوش cache مشترك — كل instance بيجيب البيانات من الأول.

## الحل
نحول الصلاحيات لـ **Context على مستوى التطبيق** يتحمّل مرة واحدة بعد تسجيل الدخول، ويفضل محفوظ في الذاكرة (+ نسخة في `localStorage` للتحميل الفوري عند refresh الصفحة).

## التغييرات

### 1. إنشاء `src/contexts/permissions-context.tsx` (جديد)
- Context يحمل: `roles`, `permissions`, `loading`, `isAdmin`, `hasPermission`, `refresh`
- يستمع لتغير `user.id` من `useAuth`:
  - لو فيه user → يقرأ من `localStorage` كـ initial value (loading=false فوراً لو فيه cache)، وفي الخلفية يعمل revalidate من Supabase
  - لو مفيش user → يمسح كل حاجة
- يخزن النتيجة في `localStorage` تحت مفتاح خاص بـ user id
- يوفر `refresh()` للاستعمال بعد تعديل صلاحيات (مثلاً من صفحة المستخدمين)

### 2. تحديث `src/main.tsx` (أو `src/App.tsx`)
- لف الـ `<App />` بـ `<PermissionsProvider>` جوه `<AuthProvider>`

### 3. تحديث `src/hooks/use-permissions.ts`
- يبقى مجرد re-export للـ hook اللي بيقرأ من الـ context (يحافظ على نفس الـ API الحالي عشان مفيش كود تاني يتغير)

### 4. تنظيف صغير في الصفحات
- `src/pages/control-panel.tsx` و `src/pages/users-permissions.tsx`: السلوك يفضل زي ما هو، بس عملياً `loading` هيكون `false` فوراً بعد أول مرة، فرسالة "جارٍ التحقق..." هتختفي في التنقلات اللاحقة.
- بعد عمليات التعديل في `users-permissions.tsx` (إضافة/تعديل صلاحيات) — نستدعي `refresh()` من الـ context عشان لو المسؤول عدّل صلاحيات نفسه يشوف التحديث فوراً.

## السلوك بعد التعديل
- أول دخول بعد login: fetch واحد للـ roles/permissions، ويتخزن في الذاكرة + localStorage.
- التنقل بين الصفحات: **فوري** بدون أي رسالة تحقق ولا requests شبكة.
- Refresh للصفحة: يقرأ من localStorage فوراً (بدون loading)، ويعمل revalidate صامت في الخلفية.
- Logout: يتمسح من الذاكرة و localStorage.

## ملاحظة أمنية
الـ cache في localStorage **للعرض السريع فقط**. الأمان الفعلي محمي بالـ RLS على مستوى قاعدة البيانات — حتى لو حد عبث بالـ localStorage مش هيقدر يوصل لبيانات غير مصرح بيها لأن السيرفر بيرفض الطلبات.