## الفكرة

نعيد بناء نظام الصلاحيات بالكامل بحيث:
1. الصلاحيات تغطي كل الأقسام في النظام (لوحة التحكم، الشيفتات، الإحصائيات، الخزن، أقسام التصنيع، قيود الحركة، الموردين، الشيفتات السابقة، المستخدمين والصلاحيات).
2. كل صلاحية فرعية تعتمد على صلاحية أب — مينفعش تتفعل غير لو الأب مفعل (تسلسل شجري).
3. في صفحة المستخدمين، تعديل الصلاحيات يظهر على هيئة **شجرة قابلة للطي/الفتح** (مع indent + خطوط) زي شجرة الحسابات.
4. الصلاحيات بتتطبق فعلياً على السايدبار والصفحات وأزرار الإجراءات (إضافة/تعديل/حذف/استخراج).

## شجرة الصلاحيات

```
لوحة التحكم  (view_control_panel)
├── الشيفت الحالي  (view_current_shift)
│   ├── بدء شيفت جديد  (start_shift)
│   └── إنهاء الشيفت  (end_shift)
└── الإحصائيات  (view_stats)
    └── استخراج الإحصائيات  (export_stats)

الخزن  (view_vaults)
├── إضافة خزنة  (create_vault)
└── إدارة الخزنة  (access_vault)
    ├── تعديل الخزنة  (edit_vault)
    ├── حذف الخزنة  (delete_vault)
    ├── إنشاء قيد دخول  (create_vault_entry)
    ├── عرض بيانات الخزنة  (view_vault_data)
    └── عرض حركات الخزنة  (view_vault_movements)

أقسام التصنيع  (view_sections)
├── إضافة قسم  (create_section)
└── إدارة القسم  (access_section)
    ├── تعديل القسم  (edit_section)
    ├── حذف القسم  (delete_section)
    ├── عرض بيانات القسم  (view_section_data)
    └── عرض حركات القسم  (view_section_movements)

قيود الحركة  (view_movements)

الموردين  (view_suppliers)
├── تعديل المورد  (edit_supplier)
├── حذف المورد  (delete_supplier)
└── كشف حساب المورد  (view_supplier_account)

الشيفتات السابقة  (view_shifts_history)
└── تفاصيل الشيفت  (view_shift_details)

المستخدمين والصلاحيات  (view_users)
├── إضافة مستخدم  (create_users)
├── تعديل بيانات المستخدم  (edit_user_profile)
├── تعديل صلاحيات المستخدم  (edit_user_permissions)
└── حذف المستخدم  (delete_users)
```

## التنفيذ

### 1. قاعدة البيانات (migration)
- توسيع enum `app_permission` ليشمل كل القيم الجديدة أعلاه.
- الإبقاء على القيم القديمة (`view_dashboard`, `export_data`, `view_users`, `manage_users`, `create_users`) للتوافق مع الداتا الموجودة، لكن استخدام الجديدة في التطبيق.

### 2. تعريف الشجرة في الكود
- ملف جديد `src/lib/permissions-tree.ts` يحتوي شجرة هرمية واحدة (`PermissionNode { value, label, children }`) مع helpers:
  - `getAllDescendants(value)`
  - `getAncestors(value)`
  - `togglePermInTree(current, value)` — يضيف الأب تلقائياً عند التفعيل، ويزيل الأبناء عند الإلغاء.

### 3. مكون شجرة الصلاحيات
- مكون `<PermissionTree />` جديد:
  - Indentation حسب العمق + أيقونة طي/فتح (Chevron).
  - Checkbox لكل عقدة.
  - الأبناء disabled ما لم يكن الأب مفعّل.
  - زر "تحديد الكل" / "إلغاء الكل" أعلى الشجرة.

### 4. ربط الصلاحيات بالـ UI الفعلي
- `app-sidebar.tsx`: إخفاء عناصر القائمة بناءً على الصلاحيات الجذرية (view_control_panel, view_vaults, …).
- صفحات: `control-panel.tsx`, `vaults.tsx`, `vault-detail.tsx`, `sections.tsx`, `section-detail.tsx`, `movements.tsx`, `suppliers.tsx`, `supplier-detail.tsx`, `shifts.tsx`, `shift-detail.tsx`, `users-permissions.tsx` — استخدام `hasPermission(...)` لإخفاء/تعطيل الأزرار وحظر الدخول.
- `shift-control.tsx`: التحكم في إظهار زر بدء/إنهاء.
- `ProtectedRoute` يبقى للمصادقة فقط، أما الصلاحيات فتُتحقق داخل كل صفحة (لإظهار رسالة "لا تملك صلاحية" بدل redirect).

### 5. صفحة المستخدمين والصلاحيات
- استبدال قائمة الصلاحيات الحالية بـ `<PermissionTree />` في حواري الإضافة والتعديل.
- المسؤول (admin) يبقى توجل واحد يعطي كل الصلاحيات.

## ملاحظات

- لن نضيف صفحات جديدة ولن نغير منطق العمليات نفسها — مجرد طبقة تحقق صلاحيات.
- التصميم يلتزم بـ design tokens الحالية (لا ألوان مباشرة).
- لن نعدل `client.ts` أو `types.ts`.
