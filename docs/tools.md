# Tools

What this project touches on the user's Mac. "not checked" means nobody has verified it.
The game itself needs nothing but a browser.

## git

- Installed with: Xcode Command Line Tools.
- Uninstall: `sudo rm -rf /Library/Developer/CommandLineTools` (removes all Command Line Tools, including python3).
- Leftovers: `~/.gitconfig` (not checked); the repo's own `.git/` folder; the github.com login in the macOS keychain. Never remove or suggest erasing that login (see CLAUDE.md).
- Dev-only: needed to publish to GitHub Pages, not to play.
- On the machine before this project: not checked.

## python3

- Installed with: Xcode Command Line Tools (same uninstall as git).
- Leftovers: not checked.
- Not used by the project. Only named in `.claude/launch.json` for a local test server the user declined.
- On the machine before this project: not checked.

## Safari

- Comes with macOS; not removable.
- Needed to play and test the game (any modern browser works).
- On the machine before this project: yes.

## Homebrew

- Installed: yes (how: not checked).
- Uninstall: the official script from brew.sh: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"`.
- Leftovers: `/opt/homebrew` or `/usr/local` (which one: not checked).
- Not used by this project.
- On the machine before this project: not checked.

## Claude desktop app (with the built-in browser)

- Installed with: not checked.
- Uninstall: drag Claude from Applications to the Trash.
- Leftovers: `~/Library/Application Support/Claude` and `~/.claude`.
- Dev-only.
- On the machine before this project: not checked.

## Not installed

- Node.js: not installed, so the tests run in `tests/tests.html` instead of `node tests/...`.
