
# تتبع العدد في المخزون والحركات

## 1. تعديلات قاعدة البيانات

### إضافة `category_id` و `total_count` لجداول المخزون
- `vault_inventory`: إضافة `category_id uuid NULL` و `total_count integer NULL`
- `section_inventory`: نفس الإضافة
- مفتاح فريد جديد: `(holder_id, metal_id, karat, category_id)` بحيث الـ NULL distinct (يعني السبائك بدون تصنيف صف منفصل، والمشغولات بصنف معين صف ثاني)

### تحديث triggers `apply_movement_inventory` و `reverse_movement_inventory`
- المطابقة تتم على `category_id IS NOT DISTINCT FROM`
- لو `count` على الحركة ≠ NULL → يضيف/يخصم من `total_count` في صف الوجهة/المصدر
- الخصم بيتحقق من `total_count >= count` لو موجود

### تحديث دالة `process_section_workorder_return`
- تمرر `category_id` و `count` لكل سطر (موجودة بالفعل)
- التحويل بين العيارات يحافظ على العدد (لكن غالباً التحويل بين العيارات يكون لمعالجة بدون عدد، فلا تتأثر)

## 2. منطق التطبيق (frontend)

### عرض المخزون مع العدد
- في `vault-detail.tsx` و `section-detail.tsx`: عرض كل صف مخزون مع العدد لو موجود → "30× مشغولات 1320 جم"
- أمر الشغل والـ badges في `work-order-card.tsx`: نفس التنسيق

### إلزام التصنيف عند الإدخال/الإخراج
- لو المعدن المختار عنده تصنيف بيطلب عدد → اختيار التصنيف **إجباري** (مش اختياري)
- لو التصنيف بيطلب عدد → حقل العدد إجباري وقيمة > 0

### تحقق من العدد المتاح في المصدر
- قبل الإرسال: نقرأ `total_count` من inventory الصف المطابق
- لو العدد المطلوب > المتاح → نمنع الإرسال برسالة واضحة
- نطبق ده على:
  - إصدار خزنة → قسم
  - استرداد قسم → خزنة (يقرأ من section_inventory)
  - تسوية أمر شغل
  - رد بدون تعديل (`sendWorkOrderBackToSection`)

### قواعد العدد حسب نوع القسم
- **قسم تصنيع (manufacturing)**: العدد المسترد ≤ العدد المُصدَر للأمر (ممكن قطعة تتحشر فتتحول لخسية وزن + يقل العدد)
- **قسم معالجة (processing)**: العدد مرن (سبيكة → سبيكتين أو العكس) — لا تحقق على العدد للمسترد، نعتمد على المتاح في القسم فقط

التحقق على نوع القسم يضاف في `WorkOrderTransferDialog` عند `direction = "return-to-vault"`.

## 3. الملفات المتأثرة

- migration جديدة (schema + triggers)
- `src/pages/vault-detail.tsx` (عرض + إدخال المخزون + إصدار أمر شغل)
- `src/pages/section-detail.tsx` (عرض المخزون)
- `src/components/work-order-transfer-dialog.tsx` (التحقق من العدد + قواعد التصنيع/المعالجة)
- `src/components/work-order-card.tsx` (عرض العدد - موجود جزئياً)
- `src/lib/work-order-actions.ts` (`sendWorkOrderBackToSection` يحترم العدد)
- `src/lib/work-order-contents.ts` (موجود جزئياً)

## رسائل الخطأ
- "اختيار التصنيف إجباري لهذا المعدن"
- "العدد المتاح: X — لا يمكن إصدار Y"
- "لا يمكن استرداد عدد أكبر من المُصدَر في قسم تصنيع"
