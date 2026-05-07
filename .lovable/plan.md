## الفكرة

نخلي الصلاحيات الخاصة بالخزن والأقسام **per-resource** بدل ما تكون عامة — يعني كل خزنة وكل قسم يبقى ليهم شجرة صلاحيات مستقلة، وأي إضافة/حذف لخزنة أو قسم تنعكس تلقائياً في شجرة الصلاحيات.

## التغييرات

### 1. قاعدة البيانات (migration)

- إضافة عمود `resource_id uuid NULL` في جدول `user_permissions`.
- تعديل الـ unique constraint ليشمل `(user_id, permission, resource_id)` بدل `(user_id, permission)`.
- تحديث دالة `has_permission` بحيث تقبل `_resource_id uuid DEFAULT NULL` وتطابق على `resource_id` كمان (مع NULL-safe comparison).
- مسح/تنظيف الصلاحيات القديمة الخاصة بـ `access_vault`, `edit_vault`, `delete_vault`, `create_vault_entry`, `view_vault_data`, `view_vault_movements`, ونفس الشيء للأقسام (لأنها هتبقى per-resource).

### 2. الكود

- **`permissions-tree.ts`**: تقسيم الشجرة لجزء ثابت + helper `buildDynamicTree(vaults, sections)` يحقن sub-trees لكل خزنة وقسم تحت "الخزن" و"أقسام التصنيع".
- نوع جديد للصلاحية مع resource: `{ permission: AppPermission, resource_id?: string }`.
- **`permissions-context.tsx`**: تخزين الصلاحيات كـ array من `{ permission, resource_id }`، وتحديث `hasPermission(p, resourceId?)`.
- **`<PermissionTree />`**: يستقبل `vaults` و `sections` كـ props، يبني الشجرة ديناميكياً، ويعرض اسم كل خزنة/قسم كعقدة بداخلها (تعديل/حذف/قيد دخول/عرض بيانات/عرض حركات).
- **`users-permissions.tsx`**: يجيب قائمة الخزن والأقسام ويمررها للـ tree، ويحفظ الصلاحيات مع `resource_id`.
- **صفحات `vaults.tsx`, `vault-detail.tsx`, `sections.tsx`, `section-detail.tsx`**: تستخدم `hasPermission("access_vault", vault.id)` وهكذا.
- **صفحة الصلاحيات** والـ admin يحصل على كل حاجة بدون تخزين صريح.

### 3. النتيجة

- في حوار الصلاحيات: تحت "الخزن" تلاقي "إضافة خزنة جديدة" + شجرة لكل خزنة موجودة (خزنة الخواجة، الخزنة الرئيسية، …).
- نفس الفكرة تحت "أقسام التصنيع" (السبك، الليزر، …).
- أي خزنة/قسم جديد يظهر تلقائياً، وأي محذوف يختفي.
