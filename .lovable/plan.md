## الهدف
إضافة دايلوج جديد "تعديل الأصناف" لكل خزنة، يسمح للمستخدم بإعادة تشكيل الأصناف الموجودة (تغيير العيارات/التصنيفات/الأعداد/الأوزان، حذف صنف، إضافة صنف) بشرط الحفاظ على نفس صافي وزن 999 للخزنة. العملية لا تُسجَّل في جدول الحركات `movements`.

## المشكلة الجوهرية
عرض breakdown الأصناف (metal+karat+category+count+weight) في كروت الخزنة يُحسب حالياً من aggregation للـ `movements` فقط. لذلك أي تعديل لازم يُحفظ في مكان يُدمج في نفس الحساب — وإلا التعديل مش هيظهر بعد reload.

## الحل
إنشاء جدول جديد `vault_item_adjustments` يخزن delta لكل صنف ناتج عن تعديلات الأصناف، ودمجه مع aggregation الموجود في `vault-detail.tsx` و `vaults.tsx`.

### Backend (migration)

```text
table vault_item_adjustments
  id uuid PK
  vault_id uuid
  metal_id uuid
  karat text NULL
  category_id uuid NULL
  delta_weight numeric  (موجب أو سالب)
  delta_count integer NULL (موجب أو سالب)
  adjustment_id uuid    (يجمع كل أسطر نفس العملية)
  created_at, created_by_user_id, employee_name, shift_id
  RLS: نفس صلاحيات `create_vault_entry` على الخزنة
```

- لا triggers على vault_inventory لأن الـ breakdown المعروض في الواجهة يُحسب من الـ movements + الـ adjustments وليس من جدول vault_inventory.
- الجدول للـ audit trail فقط (مين عمل التعديل ومتى)، بدون تأثير على movements.

### Frontend

1. **زرار "تعديل الأصناف"** جنب زرار "تعديل الأعداد" في `vault-detail.tsx` (نفس صلاحية canEntry + active shift).

2. **EditItemsDialog** جديد:
   - يقرأ الأصناف الحالية من نفس مصدر الكروت (breakdownMap بعد طرح المحجوز).
   - **Alert card فوق** مقسوم نصين:
     - قبل التعديل: مجموع `(weight * karat_numeric) / 999` لكل الأصناف الحالية.
     - بعد التعديل: نفس الحساب لكن من الأسطر بعد التعديل.
     - لو متساويين (مع tolerance بسيطة) → badge أخضر "متطابق".
     - لو مختلفين → badge أحمر "فرق X جم 999" + زرار حفظ disabled.
   - **جدول الأصناف**: كل سطر فيه: المعدن، العيار (select)، التصنيف (CategoryCascade)، الوزن، العدد (لو required)، زرار حذف.
   - **زرار "إضافة سطر"** يضيف سطر فارغ.
   - زرار "حفظ التعديلات" disabled لو الصافي مش متطابق.

3. **منطق الحفظ**: نحسب delta لكل صنف:
   - الأصناف اللي اتشالت → delta سالب بالكامل.
   - الأصناف الجديدة → delta موجب بالكامل.
   - الأصناف اللي اتعدلت (نفس metal+karat+category بقيم مختلفة) → delta = جديد - قديم.
   - نسجلها كلها في `vault_item_adjustments` بنفس `adjustment_id`.

4. **دمج التعديلات في الـ breakdown** في `vault-detail.tsx`:
   - بعد بناء `breakdownMap` من movements، نضيف الـ adjustments عليها (نفس key = `metal_id__karat`، نفس category_id).
   - يتعكس على الكروت تلقائياً.

5. **دمج في `vaults.tsx`**: لو الصفحة بتعرض إجمالي وزن خزنة من vault_inventory فقط، ممكن نضيف صفر تأثير (لأن صافي 999 ثابت لكن الإجمالي بالأوزان الفعلية ممكن يتغير لو حد نقل وزن من عيار 750 لـ 995 — حاصل ضرب نفس صافي 999 لكن الأوزان الكلية مختلفة). نحتاج دمج adjustments في حساب total_weight بصفحة vaults كذلك.

## الملفات اللي هتتعدل
- `supabase/migrations/<new>.sql` — الجدول الجديد + RLS
- `src/pages/vault-detail.tsx` — زرار + EditItemsDialog + قراءة adjustments + دمجها في breakdownMap
- `src/pages/vaults.tsx` — قراءة adjustments ودمجها في إجمالي وزن الخزنة بالكروت
- `src/integrations/supabase/types.ts` — يتحدث تلقائياً بعد الـ migration

## ملاحظات
- صيغة 999: `(weight * Number(karat)) / 999`. لو عيار غير رقمي (نادر) نتجاهله من المقارنة (ونحذره للمستخدم).
- العملية مرتبطة بالشيفت المفتوح (للـ audit) لكن مش بتسجل في movements.
- لا تلامس `vault_inventory` لأنها مش مصدر العرض في الكروت.