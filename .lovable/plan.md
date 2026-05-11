
## نظرة عامة

قسم جديد ف السايدبار اسمه "الخسيات والاسترداد" يعرض إجمالي خسيات الأقسام بعيار 999 ويتيح فتح عمليات استرداد متعددة في نفس الوقت لاسترجاع جزء من الخسية وتسجيل الباقي كهالك.

## التغييرات على قاعدة البيانات

### جداول جديدة

**`recovery_operations`** — عملية استرداد واحدة
- `id`, `code` (RC-…), `status` ('open' | 'closed'), `notes`
- `opened_by_user_id`, `opened_by_name`, `opened_shift_id`
- `closed_by_user_id`, `closed_by_name`, `closed_at`, `closed_shift_id`
- `created_at`, `updated_at`

**`recovery_operation_sections`** — الأقسام المختارة للعملية مع رصيد الخسية الأولي اللي اتنقل
- `id`, `operation_id`, `section_id`, `metal_id`
- `initial_loss_999` (الخسية الأولية اللي اتسحبت من القسم)
- `recovered_999` (مجموع المسترد لحد دلوقتي)
- `waste_999` (يتحط لما العملية تنتهي = initial - recovered)

**`recovery_entries`** — كل حركة استرداد فردية
- `id`, `operation_id`, `section_id`, `metal_id`
- `weight_999`, `to_vault_id`
- `shift_id`, `employee_name`, `created_by_user_id`, `created_at`

### تعديل enum الصلاحيات
إضافة: `view_recovery`, `manage_recovery`

### دالة Postgres `recovery_open(p_section_ids uuid[], p_shift_id uuid, p_employee_name text)`
- تتحقق إن القسم مش موجود في عملية مفتوحة
- لكل قسم تحسب مجموع `pure_999_weight` من `work_order_shrinkage` المرتبط بالقسم — مطروح منه أي خسية اتنقلت قبل كده
- تتحقق إن في رصيد فعلي 999 في `section_inventory` (category=null)
- تنقص الرصيد من `section_inventory` بنفس القيمة (تشال الخسية من القسم نقل فعلي للعملية)
- تنشئ صف في `recovery_operation_sections` بقيمة `initial_loss_999`
- تنشئ صف في `recovery_operations`

### دالة `recovery_add_entry(p_operation_id, p_section_id, p_weight, p_vault_id, p_shift_id, p_employee_name)`
- تتحقق إن المسترد ≤ الخسية المتبقية للقسم في العملية (initial - recovered)
- تضيف حركة في `movements` (from=section, to=vault, karat=999, category=null) — دي اللي بتزود رصيد الخزنة عبر التريجر
- بس الخسية مش في القسم أصلاً (اتشالت وقت الفتح) — فلازم نضيفها مؤقتاً قبل ما الـtrigger يخصمها. الحل: نزود `section_inventory` بالقيمة دي قبل الـinsert ونخلي التريجر يخصم زي العادة
- نحدث `recovered_999` في `recovery_operation_sections`
- ننشئ صف في `recovery_entries`

### دالة `recovery_close(p_operation_id, p_shift_id, p_employee_name)`
- لكل قسم: `waste = initial - recovered`. الـwaste مش بيرجع للقسم (اعتباره هالك نهائي)
- تحديث `recovery_operations.status = 'closed'`

## التغييرات على الفرونت إند

### السايدبار (`src/components/app-sidebar.tsx`)
إضافة عنصر جديد بأيقونة `Recycle` يدخل على `/recovery` — `requires: "view_recovery"`

### صفحة جديدة `src/pages/recovery.tsx`
- زرار علوي يمين: **"فتح عملية استرداد جديدة"** (يحتاج `manage_recovery`) → دايلوج فيه قائمة بالأقسام مع `(الخسية: X جم 999)` جنب كل اسم — checkboxes متعدد
- كرت ملخص: إجمالي الخسية الحالية لكل الأقسام بعيار 999 (مجموع `pure_999_weight - already_in_open_operations`)
- كروت العمليات المفتوحة (شبه work-order-card): إجمالي الخسية، إجمالي المسترد، زراير "إدخال استرداد" و"إنهاء العملية"
- تابز تحت:
  - **الخسيات**: جدول (اسم القسم، إجمالي الخسيات، إجمالي المستردات، إجمالي الهالك، زرار "الاستردادات السابقة")
  - **الاستردادات**: جدول حركات الاسترداد (اسم القسم، الخسية قبل، المسترد، الهالك، زرار تفاصيل)

### دايلوجات
- `RecoveryOpenDialog` — اختيار أقسام
- `RecoveryEntryDialog` — اختيار قسم من اللي في العملية + إدخال وزن مسترد + اختيار خزنة
- `RecoveryCloseConfirmDialog` — تأكيد إنهاء + عرض الهالك المتوقع لكل قسم
- `SectionRecoveryHistoryDialog` — يعرض كل عمليات الاسترداد السابقة لقسم معين

### ملفات إضافية
- `src/lib/recovery.ts` — helpers لجلب البيانات وحساب الخسية المتاحة للقسم
- إضافة الصلاحيات الجديدة في `src/lib/permissions-tree.ts`
- تحديث types عبر migration

## التحقق والاختبار

- التأكد إن مفيش قسم يدخل في عمليتين مفتوحتين في نفس الوقت
- التأكد إن المسترد ≤ الخسية المتبقية
- التأكد إن لازم يكون في شيفت مفتوح
- بعد الإنهاء: العملية تختفي من الكروت وتظهر في تابز الإحصائيات
