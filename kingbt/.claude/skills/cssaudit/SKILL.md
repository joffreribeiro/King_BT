---
name: cssaudit
description: Map all conflicting CSS rules affecting an element before editing layout/width/spacing. Use for table width matching, card layouts, expand/collapse, zebra striping, or any "doesn't match the reference" styling bug.
---

When given a CSS layout, width, or spacing bug:

1. Grep the target element's selector(s) and class names across ALL `.css`/`.scss`/style files and any inline `style=` / styled-component definitions in the relevant components.
2. List every matching rule found, with: file, selector, specificity, and whether it has `!important`.
3. Specifically check for these common conflict sources:
   - Global `nth-child` / zebra-striping rules that override local ones
   - `table-layout: fixed` plus explicit column widths
   - `colspan` summary/total rows forcing wrapper width
   - Freeze/sticky column rules
   - Inline styles set via JS that override CSS
4. Report ALL conflicting layers found BEFORE making any edit. State which rule will "win" under normal cascade rules and why the current result looks wrong.
5. Propose ONE consolidated fix that addresses every conflicting layer at once — not a one-rule-at-a-time patch.
6. After applying the fix, ask the user to verify visually before considering it done. Do not commit/push.
