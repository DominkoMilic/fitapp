# Maestro flows

Run against a development or preview build installed on a simulator, emulator or phone.

```bash
# one-time: curl -Ls "https://get.maestro.mobile.dev" | bash
export APP_ID=app.pace.fitness.development   # or app.pace.fitness.preview
maestro test tests/e2e/maestro/smoke -e APP_ID=$APP_ID -e EMAIL=you@example.com -e PASSWORD=...
maestro test tests/e2e/maestro/onboarding.yaml -e EMAIL=new+1@example.com -e PASSWORD=...
```

- `smoke/` needs an account that has finished onboarding. Use a test account in a test project,
  never your personal account in production.
- Files starting with `_` are subflows and are skipped when running the folder.
- In CI the same flows run on EAS Workflows (`.eas/workflows/e2e.yml`).
