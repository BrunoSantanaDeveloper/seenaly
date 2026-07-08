---
name: update-from-template
description: Pull the latest flyee template improvements into this derived project (git merge from the template remote), resolving conflicts by the template's conventions and running the post-merge checklist (install, tokens, migrations, env, build). Reusable — never delete this skill.
---

# Update this project from the flyee template

Derived projects share git history with the template, so updating is a normal merge. This skill is the documented procedure — run it whenever the template gains packages, fixes or improvements this project should inherit.

## 1. Preconditions

- Clean working tree (commit or stash first — a merge on top of dirty state is unrecoverable noise).
- `git remote -v` shows `template`. If absent, ask the user for the flyee repo URL and `git remote add template <url>`.
- `git fetch template`.

## 2. Review what is coming — BEFORE merging

```
git log --oneline HEAD..template/main
git diff --stat HEAD...template/main
```

Summarize for the user: new packages, new migrations (`packages/db/migrations/`), changed env examples, touched areas that this project customized. Get an OK before merging.

## 3. Merge

`git merge template/main` — always merge, never rebase (both histories are published).

## 4. Conflict resolution rules

- **Project identity files** (root `CLAUDE.md` header/product summary, `BRAND` in `packages/content`, i18n copy, token palette CSS, `config.ts` defaults, `app.json`, `docs/PRODUCT.md`, `docs/DESIGN.md`): keep the PROJECT's version, hand-incorporating structural additions from the template side (e.g. a new CLAUDE.md section, a new token added to every theme). `docs/DESIGN.md` in particular is the project's committed visual direction — never overwrite it with the template's reference values.
- **modify/delete on pruned demo content** (UI showcase, docs, sample apps, marketing, mobile — whatever this project pruned at init): keep the deletion (`git rm <path>`). Do not resurrect demo content.
- **`package-lock.json`**: take either side, then regenerate with `npm install` before committing.
- Never reintroduce `gogo`/`Gogo` naming from old history.

## 5. Post-merge checklist

1. `npm install` (root).
2. Template changed `packages/design-tokens/css/*` → `npm run tokens:generate` and include the regenerated mirror in the merge commit.
3. **New migrations** in `packages/db/migrations/` → list them in order and remind the user to apply them to the project's Supabase before deploying.
4. **New env vars** in `apps/web/.env.example` (diff it) → mirror the new placeholders into the local `.env` and the Vercel project.
5. `npm run typecheck` and `npm run build` — must pass before concluding.
6. Commit the merge; report: what came in, migrations to apply, env vars to fill, any conflict decisions taken.

## Backporting (the opposite direction)

If this project built something generic (useful to any derived project), do NOT merge project → template. Reimplement/cherry-pick it in the template repo, stripped of business logic; every derivative then receives it on its next update.
