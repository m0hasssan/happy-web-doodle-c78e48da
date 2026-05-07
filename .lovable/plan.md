## الهدف

ربط نظام الصلاحيات بالكامل مع الباك إند والـ UI عبر 8 تعديلات.

## التعديلات

### 1. تحديث RLS policies (الأهم)

استبدال `has_role(auth.uid(), 'admin')` في policies الـ INSERT/UPDATE/DELETE بـ `has_permission(auth.uid(), '<perm>', <resource_id>)`:

- **vaults**: `create_vault` للإضافة، `edit_vault` (مع id) للتعديل، `delete_vault` (مع id) للحذف.
- **vault_inventory / vault_metals**: `create_vault_entry` (مع vault_id) للإضافة والتعديل والحذف.
- **manufacturing_sections**: `create_section` / `edit_section` / `delete_section`.
- **section_inventory / section_metals**: مرتبطة بـ section_id.
- **movements**: INSERT يتطلب `create_vault_entry` على from_id أو to_id (أو صلاحية موازية للقسم).
- **suppliers**: `edit_supplier` / `delete_supplier`.
- **shifts**: INSERT يتطلب `start_shift`، UPDATE يتطلب `end_shift`.

### 2. حماية الـ Routes

إضافة `beforeLoad` permission guard لكل صفحة تعيد التوجيه لو اليوزر مش عنده الصلاحية الجذرية:
`/control-panel`, `/vaults`, `/vaults/:id`, `/sections`, `/sections/:id`, `/movements`, `/suppliers`, `/suppliers/:id`, `/shifts`, `/shifts/:id`, `/users-permissions`.
صفحات الـ detail بترجع لقائمة الموارد لو الصلاحية على resource معين مفقودة.

### 3. الشريط الجانبي (Sidebar)

تعديل `app-sidebar.tsx` بحيث كل عنصر يظهر فقط لو اليوزر عنده الصلاحية الجذرية (`view_control_panel`, `view_vaults`, …). الـ admin يشوف كل حاجة.

### 4. أزرار الشيفت

`shift-control.tsx`: زر «بدء شيفت» يظهر/يتعطل حسب `start_shift`، زر «إنهاء الشيفت» حسب `end_shift`.

### 5. زر استخراج الإحصائيات

`control-panel.tsx`: زر الاستخراج يخفي/يتعطل حسب `export_stats`.

### 6. صفحة الموردين

`suppliers.tsx` + `supplier-actions.tsx` + `supplier-detail.tsx`: أزرار التعديل/الحذف وكشف الحساب حسب `edit_supplier` / `delete_supplier` / `view_supplier_account`.

### 7. صفحة الشيفتات السابقة

`shifts.tsx`: زر/رابط تفاصيل الشيفت يخفي لو مفيش `view_shift_details`، وحماية route `/shifts/:id` بنفس الصلاحية.

### 8. فلترة الحركات per-resource

`movements.tsx`: فلترة الصفوف بحيث اليوزر يشوف فقط الحركات اللي طرفها (from_id أو to_id) خزنة/قسم عنده عليه `view_vault_movements` / `view_section_movements`. الـ admin يشوف الكل بدون فلترة.

## ملاحظات تقنية

- صلاحية `edit_user_profile` / `delete_users` / `edit_user_permissions` تبقى عامة (مش per-resource) — الـ admin بيمنحها لمن يدير المستخدمين.
- كل migration للـ RLS هيعمل DROP + CREATE للـ policies (مفيش data migration).
- الـ `has_permission` function موجودة بالفعل وبتدعم `_resource_id`.
- Helper جديد `hasResourceAny(perm)` في `permissions-context` يرجع true لو اليوزر عنده الصلاحية على أي resource — مفيد للـ sidebar (مثلاً يشوف «الخزن» لو عنده access على خزنة واحدة على الأقل).

## الترتيب

1. Migration واحدة كبيرة لكل الـ RLS (نقطة 1).
2. تعديلات الـ frontend (نقاط 2-8) في نفس الـ batch.
