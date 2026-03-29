# AGENT.md

Guidance for any coding agent (Codex, Claude, or collaborators) touching this repository. This is the canonical reference for the Cloudflare rewrite development loop summarized in `CLAUDE.md`.

## Mission Snapshot
- Current legacy stack: Firebase + React auction manager.
- Target stack: brandless volunteer/event/campaign platform deployed on Cloudflare (see `docs/cloudflare-rewrite-blueprint.md`).
- We must preserve the Firebase version while incrementally building the Cloudflare rewrite.

## Development Principles
0. **Create a Fresh Branch Per Step**
   - Start each checklist item by branching off the latest `main` (e.g., `git checkout -b step-02-platform-config`).
   - Keep one logical step per branch; delete/merge the branch once the change lands.

1. **Review Before You Write**
   - Re-read `docs/cloudflare-rewrite-blueprint.md`, the relevant module docs, and `CLAUDE.md` before each task.
   - Confirm which tiny checklist item (tracked in `STATUS.md`) you are completing.

2. **Work in Tiny, Auditable Steps**
   - Make the smallest possible change that moves one checklist item forward.
   - Keep diffs self-contained (code + docs + config) so they are easy to review and revert.

3. **Add or Update Tests Every Time**
   - Extend Vitest, integration harness scripts, or Workers/Miniflare tests to cover the new behavior.
   - Run `npm run harness:smoke` (or document why a narrower command suffices) before asking for review.

4. **Mandatory Sub-Agent/Peer Review**
   - Launch a reviewing agent (or pair with a teammate) on every change set. Capture findings and fix them immediately.
   - Do not merge until the reviewer signs off and tests are green.

5. **Update STATUS + Docs**
   - Check off the completed item in `STATUS.md` and note any follow-up needed.
   - If architecture assumptions changed, update `docs/cloudflare-rewrite-blueprint.md` and this file/`CLAUDE.md` to keep guidance fresh.

6. **Commit Discipline**
   - One logical step per commit with descriptive messages (“Step 2: add platform config loader scaffold”).
   - Never mix multiple checklist items in the same commit.

By looping through **review → tiny change → tests → sub-agent review → status update**, we keep the rewrite safe, traceable, and easy to hand off.
