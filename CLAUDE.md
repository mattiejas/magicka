Read [CONTRIBUTING.md](CONTRIBUTING.md) before changing code, and use the terms in [GLOSSARY.md](GLOSSARY.md).

- Run `npm run check` before committing. Commit each finished feature.
- Never test with the account `testtest`; it belongs to the owner. Register a test account in a separate browser tab.
- The dev server's database is `server/driftwake.db`. Never delete or overwrite it.
- Go changes need a restart of `npm run dev`.

## Agent skills

### Issue tracker

Issues and specs are GitHub issues in `mattiejas/magicka`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, each label named after its role. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the root. See `docs/agents/domain.md`.
