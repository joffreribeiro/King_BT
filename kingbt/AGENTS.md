# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## CSS & Styling Workflow

Before changing any CSS layout/width/spacing rule, FIRST find every rule that affects the target element: grep all stylesheets for the selector, including inline styles, `!important`, global `nth-child` rules, `table-layout: fixed`, colspan summary rows, and freeze-column rules. List every matching rule with its specificity and flag which ones conflict. Do not edit until the conflicting layers are identified. Apply one consolidated fix, not one rule at a time.

## Environment & Sync

A PostToolUse hook already auto-copies edits from `E:\...\King_BT\kingbt` to `D:\KINGBT` and runs `expo export` + `firebase deploy` after every Write/Edit. If a change "doesn't appear," check that the hook actually ran and synced/deployed successfully before assuming a CSS cascade or cache problem — most "invisible change" issues are sync/deploy timing, not styling.

## Git Workflow

Do not run `git commit` or `git push` unless explicitly asked. Let the user verify a fix visually first.

## Domain Rules — Beach Tennis

This app follows real Beach Tennis rules. There is no second-serve distinction (unlike tennis). Super 8 format must correctly distinguish individuals play vs. duplas. Verify rules with the user before implementing scoring/format features if unsure.
