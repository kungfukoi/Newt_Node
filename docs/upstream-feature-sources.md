# Upstream feature sources

The user requested that these repositories be remembered as sources to evaluate and selectively port features from. Deadmeat is James Fisher (`jamesmfisher1979-source`). The GitHub spelling of Sugarmilks's account is `SugerMilks`.

| Person | Repository | Purpose | Local checkout / tracking |
| --- | --- | --- | --- |
| Sugarmilks / Steven | https://github.com/SugerMilks/NewtNode | NewtNode feature source | `sugarmilks` remote in our Newt_Node checkout |
| Deadmeat / James Fisher | https://github.com/jamesmfisher1979-source/NewtNode | NewtNode features; read `JAMES_CHANGES.md` | Our adapted port is documented in `james-integration.md` |
| Deadmeat / James Fisher | https://github.com/jamesmfisher1979-source/newtLauncher | Separate multi-copy desktop launcher | Installed at `C:\dev\newtLauncher`; `origin` points to James's repository |

Our application is `kungfukoi/Newt_Node`, normally at `C:\dev\Newt_Node`. Keep application ports and the separate launcher distinct. James's launcher is configured to manage our existing checkout as Jeff's copy, using a private Python environment and a desktop shortcut.

## Review checkpoints — October 26, 2026

- James's NewtNode `ba55fdbf4de3aa4b5b239a12fcbf3bf8de827ce1`: all 11 in-app additions adapted locally in `f8d1584` / `4.22.0-beta.0`. Includes stronger workspace saving and cancellation behavior. His original notes remain in `JAMES_CHANGES.md`.
- James's launcher `47881c6`: installed and Start verified with our NewtNode. Local Windows batch wrapper prefers `utility/.venv`; local settings, dependencies and logs are ignored. No launcher push was requested.
- Sugarmilks `main` is `927d07f7df5cad6573fe5b3b4b1301713f624e10`, dated October 14, 2026. Atlas Seedance draft finishing and Krea preview-only drafts already exist here in adapted commit `bbf6662` (October 14). Our selected-draft helper additionally rejects `completionSupported: false`.
- The preceding Sugarmilks commit `87e3302b87d688fa193b50c0d48d22eac70f5ea0` (October 12) covers Seedance drafts/editing, Explore look controls, Nano Banana 2.1 and ElevenLabs v4. Local implementations include `52265b1` (Seedance), `27e92ef` (Explore), `5a64250`/`c3c8e3e` (Nano Banana 2.1), and `0a350b6` (ElevenLabs v4).
- Sugarmilks's other branches are older: `codex/newtnode-character-workflow-checkpoint` ends at `3533e3c` (May 28), and `codex/reapply-sugermilks-features` at `4ef9428` (June 9). Neither contains more recent development than `main` at this review.

## Future reviews

Fetch/read current branches and documentation, then compare actual feature behavior with local source and tests. Different commit hashes do not establish that a feature is missing: these repositories have diverged and features are often adapted rather than merged wholesale. Preserve our workflow compatibility, provider routing, durable jobs and Windows/macOS behavior. Record the source SHA and any meaningful adaptations when a feature is adopted.

This list is a durable reference. It does not request automatic merging, publication, messages to the authors, or scheduled monitoring. Obtain fresh user direction for those actions.
