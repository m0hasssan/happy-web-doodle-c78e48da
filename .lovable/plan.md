
# خطة تحديث نظام أقسام التصنيع

## الملخص
إعادة هيكلة شاملة لنظام الأقسام: دمج "أقسام المعالجة" ضمن "أقسام التصنيع"، وإضافة إعدادات تفصيلية لكل قسم تتحكم في المعادن/العيارات المسموح بها دخولاً وخروجاً، مع صلاحيات تحويل العيار والتصنيف والعدد، وتطبيق منطق "الذهب الصافي الثابت" عند تغيير العيار.

---

## 1) إلغاء أقسام المعالجة

- حذف صفحة `src/pages/processing-sections.tsx` والمسار المرتبط بها في الـ sidebar.
- جميع الأقسام تصبح من النوع `manufacturing` (إزالة التفرقة في الواجهة).
- في قاعدة البيانات: تحويل أي قسم `kind='processing'` إلى `kind='manufacturing'` (بدون حذف بيانات).
- تبسيط دوال الـ trigger التي تفرّق بين النوعين (`apply_movement_inventory`، `reverse_movement_inventory`، `work_order_apply_shrinkage`)، أو الإبقاء على المنطق ذاته مع اعتبار كل الأقسام تدعم منطق المعالجة (تحويل عيار + تحييف).

## 2) جدول إعدادات القسم الجديد

إنشاء جدولين:

```text
section_settings
  section_id (PK, FK → manufacturing_sections)
  allow_karat_change   bool default false
  allow_category_change bool default false
  allow_count_change   bool default false

section_metal_rules
  section_id, metal_id, karat (nullable), direction ('in'|'out'), allowed bool
  PK (section_id, metal_id, COALESCE(karat,''), direction)
```

- `karat IS NULL` يعني "كل العيارات لهذا المعدن في هذا الاتجاه".
- صف لكل (معدن، عيار، اتجاه) عند إنشاء القسم → الافتراضي: مفعّل.
- RLS: قراءة لكل authenticated، تعديل عبر `edit_section`.

## 3) نافذة الإعدادات (UI)

في صفحة `sections.tsx` (قائمة الـ 3 نقاط) وصفحة تفاصيل القسم → بند "إعدادات القسم" يفتح Dialog مكوّن من 4 تبويبات:

1. **المعادن المسموح بدخولها** — Checkboxes لكل معدن من `section_metals`.
2. **المعادن المسموح بخروجها** — نفس القائمة.
3. **العيارات (دخول/خروج)** — جدول لكل معدن × عيار، عمودين Checkbox.
4. **صلاحيات التحويل** — 3 Toggles: تغيير العيار / تغيير التصنيف / تغيير العدد.

حفظ → upsert في `section_metal_rules` و `section_settings`.

## 4) منطق التحويل (Core)

في `src/components/work-order-transfer-dialog.tsx` و `src/pages/section-detail.tsx` (شاشات الإخراج من القسم):

### 4.1 الفلترة الذكية
- قائمة المعادن المعروضة = (المتاح فعلياً في الجرد) ∩ (مسموح بخروجه في `section_metal_rules`).
- قائمة العيارات = (المتاح بعد تحويل النقاوة) ∩ (مسموح بخروجه).
- قائمة التصنيفات = (المتاح فعلياً) — مع قيد إضافي إذا كان `allow_category_change=false` فيجب أن يطابق التصنيف الأصلي للمصدر.

### 4.2 حساب التحويل (الذهب الصافي ثابت)
```text
pure = Σ (weight_in_section × karat/1000)   // كل النقاوة المتاحة في التصنيف
gross_at_target_karat = pure / (target_karat/1000)
```
- إذا `allow_karat_change=false` → يُجبر `target_karat = source_karat` (المتاح للاختيار عيار واحد فقط).
- بعد إجراء الإخراج بالعيار الجديد، تستدعى `work_order_apply_shrinkage` كما هي (تعمل على النقاوة) لتطبق الخسية على الوزن النهائي.

### 4.3 تغيير العدد
- إذا `allow_count_change=true`: المستخدم يحدد العدد الجديد بحرية (مع التحقق `count ≥ 1`).
- إذا `false`: العدد مقفول على القيمة المصدرية.
- العدد لا يؤثر على الوزن المخرج (تنظيمي فقط).

### 4.4 تحديث `process_section_workorder_return`
- إضافة تحقق من القواعد قبل التنفيذ (يطابق المنطق الموجود بالفعل لتحويل العيار بالنقاوة، لكن مع فحص `allow_*` و`section_metal_rules`).
- في حال انتهاك → `RAISE EXCEPTION` برسالة عربية واضحة.

## 5) تحديثات الجداول والحركات

في `src/pages/movements.tsx` وأي جدول يعرض الحركات:

- إضافة عمود **التصنيف**: يعرض `category_path` من `metal_categories` (بصيغة "سبائك ▸ بلدي").
- إضافة عمود **العدد**: يعرض `movements.count` أو `-` إذا `null`.
- نفس الإضافة في جدول حركات الخزنة وحركات القسم وأمر الشغل.

## 6) سلامة البيانات (Audit)

- كل تحويل (تغيير عيار/تصنيف/عدد) يُسجَّل كحركة عادية في `movements` بحقولها الكاملة (`metal_id`, `karat`, `category_id`, `count`, `weight`, `work_order_id`).
- إضافة عمود `source_karat` و`source_category_id` (اختياري) في `movements` لتمييز التحويلات — أو الاكتفاء بأن الحركة المصاحبة (`from_section`) تحمل العيار/التصنيف الأصلي تلقائياً (ما يتم بالفعل).
- لا حاجة لجدول audit منفصل؛ `movements` يكفي.

---

## التفاصيل التقنية (للمراجعة)

### ملفات ستُعدَّل
- `src/pages/sections.tsx` — قائمة الإعدادات + إخفاء التفرقة.
- `src/pages/section-detail.tsx` — شاشات الإخراج بالفلترة الجديدة.
- `src/components/work-order-transfer-dialog.tsx` — تطبيق `allow_*` والفلترة.
- `src/components/app-sidebar.tsx` — حذف رابط "أقسام المعالجة".
- `src/pages/movements.tsx` — أعمدة التصنيف والعدد.
- `src/App.tsx` — حذف route لـ processing-sections.

### ملفات ستُنشأ
- `src/components/section-settings-dialog.tsx` — نافذة الإعدادات بالتبويبات الأربعة.
- `src/lib/section-rules.ts` — هوكس مساعدة لقراءة وتطبيق القواعد.

### ملفات ستُحذف
- `src/pages/processing-sections.tsx`

### Migrations
1. تحويل `kind='processing'` → `'manufacturing'`.
2. إنشاء جدولَي `section_settings` و `section_metal_rules` مع RLS.
3. تحديث دالة `process_section_workorder_return` لتحترم القواعد.
4. trigger يُنشئ صفوف افتراضية في `section_metal_rules` عند إضافة `section_metals`.

### نقاط حذرة
- التوافق مع الأقسام الموجودة → migration يولّد قواعد افتراضية (الكل مسموح + كل الـ toggles مفعّلة) للحفاظ على السلوك الحالي.
- المنطق الحالي لتحويل النقاوة في `work-order-transfer-dialog.tsx` صحيح ويُحتفظ به؛ نضيف فوقه طبقة الـ rules.

هل تعتمد هذه الخطة لأبدأ التنفيذ؟
