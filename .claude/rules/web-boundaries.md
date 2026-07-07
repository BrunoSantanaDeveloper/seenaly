---
paths: ["apps/web/**"]
---

# apps/web boundaries

- Code that another consumer could plausibly share lives in `packages/*`, not inside the app.
- Do not redefine theme tokens locally (`--primary`, `--grey-*` etc.) — they come from `@flyee/design-tokens`.
