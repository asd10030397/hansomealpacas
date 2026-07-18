# HANSOME — Agent Instructions

Before any implementation or design change, read:

**[docs/CURSOR_AGENT_HANDOFF.md](docs/CURSOR_AGENT_HANDOFF.md)**

That file is the handoff for future Cursor sessions: what is locked, what to read first, what not to do, and the implementation order when coding is requested.

Gameplay source of truth (until `01_Core_Game_Rules_v1.1.md` exists):

- `docs/HANSOME_GDS_v1.1_zh-TW.md`
- `docs/HANSOME_GDS_v1.1_en.md`

Documentation architecture:

- `docs/PROJECT_DOCUMENTATION_STRUCTURE.md`
- `docs/PROJECT_DOCUMENTATION_STRUCTURE_zh-TW.md`

Default: **do not write Solidity or change locked game rules** unless the user explicitly asks.
