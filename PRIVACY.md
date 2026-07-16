# Privacy

Tabula.md is local-first. Plaintext Markdown is edited and stored in the
browser unless you choose to export it or share it.

## Local Documents

Documents are saved in browser storage for local restore. The open-source app
does not require an account to create or edit local Markdown files.

## Live Collaboration

Live collaboration links use this shape:

```txt
https://tabula.md/#room=<roomId>,<roomKey>
```

The room key is kept after the `#` fragment. Browsers use it locally to encrypt
and decrypt collaboration data. The collaboration service receives room routing
metadata and encrypted updates, not the room key or plaintext Markdown.

## Export Links

Export links use this shape:

```txt
https://tabula.md/#json=<snapshotId>,<snapshotKey>
```

The export key is kept after the `#` fragment. Browsers use it locally to open
an encrypted copy. The Export link service stores encrypted snapshot payloads,
not the export key or plaintext Markdown.

Anyone with the full link, including the fragment key, can open a local copy.
Hosted Export link blobs are retained for a limited window. The current hosted
service window is 7 days. Tabula.md is in public preview and does not yet
provide account-based link revoke controls.

## Product Analytics

The official hosted Tabula.md service uses PostHog US Cloud to collect a small
set of content-free product events and understand whether sharing and
collaboration workflows succeed. These events can record that a room was
created, a room link or agent invitation was copied, another participant
joined, or another participant edited the shared workspace.

Product events contain an ephemeral browser-tab identifier, event time, app
version, and, when available, whether the other participant is a person or an
agent. They do not contain Markdown, file or folder names, comments, prompts,
participant names, room or document identifiers, room keys, snapshot keys,
URLs, referrers, DOM element details, or URL fragments. The identifier is stored
in browser session storage and is discarded when that browser tab session ends.

PostHog autocapture, page-view capture, session recording, heatmaps, surveys,
and persistent person identification are disabled. Tabula.md does not call
PostHog identify APIs or associate product events with an account or email.

Analytics are disabled by default in the open-source app. A self-hosted build
sends no product events unless its operator explicitly configures a PostHog
project key. Operators are responsible for documenting their own deployment and
retention policy.

## Error Reporting

The official hosted service may send content-free client error reports when a
configured product operation fails. Reports can contain the app version,
browser user-agent, URL path without query or fragment, feature and operation
labels, a coarse error category, and timestamp. Reports do not include raw error
messages, Markdown, document identifiers, or link fragments and their keys.

Error reporting is also disabled when no reporting endpoint is configured.

## Reporting Problems

For product bugs, open an issue at
https://github.com/tabula-md/tabula-md/issues.

Do not paste full `#room` or `#json` links into public issues. The fragment key
is what opens the shared content.
