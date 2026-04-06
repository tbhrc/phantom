# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and this project follows the existing semantic version style already used in the repository.

## [0.18.4] - 2026-04-06

### Added
- Added a functional control-room style dashboard to the root UI with live subsystem cards, channel visibility, onboarding state, peer status, insights, and raw health inspection.
- Added client-side refresh and health JSON copy actions to the dashboard.

### Changed
- Bumped the application version from `0.18.3` to `0.18.4`.
- Replaced the primitive static landing page in `public/index.html` with a richer operational dashboard that polls `/health` and exposes more of Phantom's runtime state.

## [0.18.3] - 2026-04-06

### Added
- Added a root `CHANGELOG.md` to track repository-level changes.
- Added Docker line-ending normalization protection for shell scripts via `.gitattributes` and the runtime image build.
- Added localhost-only UI auto-login for the desktop launcher so the local web UI opens with an authenticated session.
- Added runtime model routing to use `claude-haiku-4-5` for lightweight requests and the configured primary model for heavier requests.
- Added focused tests for runtime model routing.

### Changed
- Bumped the application version from `0.18.2` to `0.18.3`.
- Updated the Windows launcher to open the authenticated local UI route instead of the raw `/ui/` login page.
- Updated web UI login copy to remove Slack-specific instructions and reflect Telegram or the active chat channel.
- Updated web UI login tool copy so magic-link instructions are channel-agnostic.
- Updated channel config defaults so Slack and Telegram are disabled unless intentionally enabled.
- Updated channel schema validation so disabled channels do not require missing tokens.
- Updated runtime channel plumbing to normalize nullable config values safely.

### Fixed
- Fixed Docker startup failures caused by CRLF line endings in `scripts/docker-entrypoint.sh`.
- Fixed local startup behavior so Phantom can boot healthy in Docker and serve `/health`.
- Fixed Telegram activation by enabling the configured bot token and syncing the live container config.
- Fixed misleading Slack login prompts in the web UI for Telegram-first setups.

### Notes
- Main chat routing now prefers Haiku for short Q&A, status checks, summaries, UI text, and lightweight replies.
- Heavy requests involving tools, files, code changes, or long/ambiguous prompts continue to use the configured primary model.
- Evolution judges were intentionally left on their existing separate model path.
