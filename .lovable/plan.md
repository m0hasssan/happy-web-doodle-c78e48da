# تحديث ضخم: التصنيفات الهرمية (شجرة)

## ملخص التغيير
نحوّل `metal_categories` من قائمة مسطّحة إلى شجرة هرمية بأي عمق. يصبح اختيار التصنيف عند الدخول/الخروج إلزامياً على **العقدة النهائية (leaf)** فقط، وعرض المخزون يتفصّل لكل تصنيف نهائي على حدة. خاصية "يحتاج عدد" تبقى لكل عقدة مع قيد: لو الأب يطلب عدد فكل الأبناء يجب أن يطلبوا عدد، ولو الأب لا يطلب عدد فلا يجوز لابن أن يطلب عدد.

---

## 1. قاعدة البيانات

### `metal_categories`
- إضافة عمود `parent_id uuid NULL REFERENCES metal_categories(id) ON DELETE RESTRICT`.
- إضافة عمود `sort_order int DEFAULT 0`.
- يبقى `metal_id` على الجذر فقط؛ الأبناء يرثون المعدن من الأب (نخزّنه أيضاً للتسهيل + trigger يضمن تطابقه مع الأب).
- index على `(parent_id)` و `(metal_id, parent_id)`.

### قواعد التحقق (trigger BEFORE INSERT/UPDATE)
- لو `parent_id` ليس NULL: `metal_id` يجب يساوي `metal_id` للأب.
- منع الدورات (التصنيف لا يكون جداً لنفسه).
- قاعدة العدد:
  - لو الأب `requires_count = true` فكل الأبناء `requires_count = true`.
  - لو الأب `requires_count = false` فلا يجوز لأي ابن `requires_count = true`.
- عند تحديث `requires_count` على عقدة: نطبّق نفس القيد تنازلياً (نتحقق ضد الأبناء الموجودين)، ولو خالف → نرفع خطأ بنص واضح.

### قيد على الحركات والمخزون
- في `apply_movement_inventory` و `process_section_workorder_return`: إذا كان `metal_id` يحتوي تصنيفات (أي يوجد جذر `metal_categories` لهذا المعدن)، فالحركة يجب أن تحمل `category_id` يشير إلى **عقدة ليس لها أبناء** (leaf). يضاف فحص: 
  ```sql
  IF NEW.category_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM metal_categories WHERE parent_id = NEW.category_id
  ) THEN RAISE EXCEPTION 'يجب اختيار التصنيف الفرعي النهائي';
  ```
- المخزون يبقى مفهرس على `category_id` كما هو الآن، لكن القيمة دائماً تشير إلى leaf.

### حذف التصنيف
- يُمنع حذف عقدة لها أبناء، أو لها رصيد في `vault_inventory` / `section_inventory`، أو مرتبطة بأي حركة.

---

## 2. الواجهة — إعدادات النظام

### تبويب "التصنيفات" يصبح شجرة
- لكل معدن: شجرة قابلة للطي (Collapsible) بالعقد.
- بجانب كل عقدة:
  - اسم التصنيف.
  - `Switch` لـ "يحتاج عدد" (محل الـ checkbox)، معطّل تلقائياً عند تعارضه مع الأب (مع tooltip يفسّر).
  - زر "إضافة تصنيف فرعي" (يفتح dialog: اسم + سويتش العدد، مع تطبيق قاعدة الأب).
  - زر تعديل وحذف (حذف يُمنع لو فيه أبناء أو حركات).
- الجذور تُضاف من زر "إضافة تصنيف رئيسي" (يطلب اختيار المعدن).

### قواعد UI للسويتش
- لو الأب `requires_count=true` → السويتش على الابن ثابت `true` ومقفل.
- لو الأب `requires_count=false` → السويتش على الابن قابل للتفعيل لكن سيرفض من السيرفر إلا لو وافق التسلسل (نمنعه أيضاً في UI).
- تغيير عقدة من `false → true` بينما لها أبناء `false` → نعرض dialog تأكيد: "سيتم تفعيل العدد لكل التصنيفات الفرعية". (نستدعي migration RPC تطبق التحديث المتسلسل).
- العكس: تغيير من `true → false` بينما لها أبناء `true` → نفس الحوار: "سيتم تعطيل العدد للأبناء أيضاً".

---

## 3. الواجهة — قيود الدخول/الخروج (Vaults & Sections)

### اختيار التصنيف
- مكوّن جديد `CategoryTreePicker` يستبدل الـ Combobox الحالي:
  - يعرض breadcrumbs: "سبائك ▸ بلدي" مثلاً.
  - يفتح بopover فيه شجرة. عند اختيار عقدة لها أبناء، تتوسّع وتُجبر اختيار leaf (لا يُسمح Submit بدون leaf).
  - حقل العدد إجباري لو الـleaf المختار `requires_count=true`.

### تطبيق على الصفحات
- `vault-detail.tsx` (إدخال + إصدار أمر شغل + قيد خروج).
- `work-order-transfer-dialog.tsx` (الاسترداد للخزنة).
- `section-detail.tsx` (عرض المخزون فقط، لا إدخال مباشر).
- `work-orders.tsx`، `movements.tsx`: عرض اسم التصنيف بصيغة المسار الكامل (`جذر ▸ ... ▸ leaf`).

---

## 4. عرض المخزون

- في `vault-detail.tsx` و `section-detail.tsx`: تجميع صفوف المخزون كما هي (كل صف بـ category_id الخاصة)، مع عرض المسار الكامل للتصنيف بدل الاسم المفرد فقط.
- في `work-order-card.tsx`: نفس التنسيق للمسار.

---

## 5. الترحيل (Migration of existing data)

- أعمدة جديدة فقط؛ البيانات الحالية تبقى كجذور (`parent_id IS NULL`).
- لا يوجد تعارض مع الـ leaf-rule لأن جميع التصنيفات الحالية بلا أبناء = leafs.

---

## 6. الملفات المتأثرة

- migration جديدة (schema + triggers + تحديث `apply_movement_inventory` لفحص leaf).
- `src/pages/system-settings.tsx` — شجرة التصنيفات + Switch + dialogs.
- جديد: `src/components/category-tree-picker.tsx`.
- جديد: `src/lib/category-tree.ts` (helpers: build tree, get path, isLeaf, validateCountRule).
- `src/pages/vault-detail.tsx`, `src/components/work-order-transfer-dialog.tsx`, `src/pages/work-orders.tsx`, `src/pages/movements.tsx`, `src/pages/section-detail.tsx`, `src/components/work-order-card.tsx`, `src/lib/work-order-contents.ts`, `src/lib/work-order-actions.ts` — استبدال الاختيار بالـ tree picker وعرض المسار.

---

## 7. التحقق بعد التنفيذ
- بناء ناجح + اختبار يدوي:
  1. إنشاء شجرة (سبائك ▸ بلدي/شركات؛ مشغولات ▸ جاهزة ▸ غوايش/خواتم).
  2. إدخال خزنة بـ leaf فقط (يُرفض اختيار عقدة لها أبناء).
  3. التحقق من قاعدة العدد عند تغيير الأب.
  4. إصدار/استرداد أمر شغل + معالجة + تحييف، كل المسارات تعمل.
  5. عرض المخزون يفصل لكل leaf على حدة.
