# Barn Bloom

A cozy plant-care / idle browser game: water and feed plants in a barn, harvest and sell them, and spend coins on seeds, nutrients, upgrades and more pots.
Stack: plain HTML, CSS and JavaScript, no build step. Run: open `index.html` in a browser. Test: open `tests/tests.html` (Node is not installed).

## Rules
- Respond to the user in the language he writes in (often Dutch). Keep all code, comments and docs in English.
- Keep replies short and plain. The user is not a professional developer and watches token use, so avoid needless reading and long replies.
- Ask before creating or doing anything new. Propose the change first and wait for a yes. Small tweaks the user explicitly asked for can go straight in.
- Never commit secrets, API keys or tokens. Keep them in .env and make sure .env is in .gitignore.
- Never guess. If you're unsure or stuck, stop and ask the user.
- Do not claim something works unless it was checked. Say what was and was not verified.
- Do not invent the user's handle, a licence or badges.
- Terminal: the user runs commands, Claude does not, except git commit and push (see Git). Give commands as copyable `bash` blocks (one per block) with a plain explanation.
- Use only the file tools and the built-in browser; do not call Bash unless the user explicitly asks (it slipped five times in October and had to be confessed).
- Never suggest erasing the saved github.com login.
- Never install tools, packages, SDKs or dependencies yourself, inside or outside the project folder. Give the user the exact command and explain what each command and flag does. Wait until he confirms it is installed, then log it in docs/tools.md with how to remove it.
- If you notice outdated or unused files, code, docs entries or dependencies, list them and ask the user before removing anything.

## Workflow
- After each completed plan step, update docs/progress.md in max 5 lines.
- When a phase is done: condense its entries in docs/progress.md to one summary line, then remind the user to run /clear before the next phase.

## Git
- Test every change yourself first in the built-in browser pane (this project has no terminal). Then tell the user what to open to see it working himself (`index.html`, `tests/tests.html`). Commit, and push if there is a remote, only after his OK. If he explicitly says to do something and commit & push, do it without waiting for his test. Use clear, conventional commit messages in English. Remote and auth details: docs/rules.md.

## Docs
- At the start of every session, read docs/progress.md first, then only the current phase in docs/plan.md (the phase named under "Next step").
- Every .md file in docs/ must be listed below with when to read it. If you create a new one, add it here.
- docs/progress.md — read first in every session; update after each completed plan step.
- docs/plan.md — read the phase named under "Next step"; read it all before planning a new phase.
- docs/rules.md — read before writing or changing code, testing, or using git.
- docs/goal.md — the original brief; read before any large feature or redesign.
- docs/tools.md — read before suggesting any install or uninstall; update when a tool is added or removed.
