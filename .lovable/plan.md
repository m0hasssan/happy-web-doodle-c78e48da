# Fix responsive layout of "قيد دخول جديد" dialog

## Problem
Inside `src/pages/vault-detail.tsx` (the `AddEntryDialog`), each entry row is one horizontal flex with fixed widths (`w-24`, `w-28`, `w-20`) plus two `flex-1` selects and a delete button. On a 360px viewport the row is wider than the dialog, so fields slide out behind the dialog edge (as shown in the screenshot).

The dialog itself is fine — the issue is the row's inner layout, not the dialog width.

## Plan

Refactor only the entry row markup (≈ lines 467–568) to use a responsive grid:

- **Mobile (default):** 2-column grid, each field takes a full cell. Order: نوع المعدن | العيار، التصنيف | الوزن، العدد | (delete button).
- **sm and up:** restore current single-row layout (metal flex-1, karat w-24, category flex-1, weight w-28, count w-20, delete icon).

Concretely:
- Replace the outer `<div className="flex items-end gap-2">` with a `grid grid-cols-2 gap-2 sm:flex sm:items-end` container.
- Drop the fixed `w-24 / w-28 / w-20` on mobile by only applying them at `sm:` (e.g. `sm:w-24`) and let the cells fill the grid column on mobile.
- Make the delete button full-width on mobile (`w-full sm:w-9`) with text "حذف السطر" visible on mobile, icon-only on `sm+`. Keep it disabled when only one row exists.
- Header row (سطر N) stays as is.

Also tighten the scroll container so it never causes horizontal overflow:
- Add `min-w-0` to the row card and to each field wrapper so long select values don't push width.
- Keep `max-h-[55vh] overflow-y-auto` but add `overflow-x-hidden` defensively.

No changes to logic, state, validation, or submit. Pure presentational changes scoped to the entry row inside `AddEntryDialog`.

## Files
- `src/pages/vault-detail.tsx` — edit the row markup inside `AddEntryDialog` only.
