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

A local Tabula MCP runs as a trusted participant on your device. If you choose
a hosted MCP, that hosted service is also a trusted participant and can read the
room content you share with it. This is separate from the ciphertext-only room
relay.

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

## Analytics

The hosted version of Tabula.md uses PostHog to measure whether sharing and
collaboration workflows succeed.

We collect:

- anonymous events such as creating, sharing, joining, and editing a room
- a short referral label when a link includes `?ref=`
- anonymous identifiers that group events from the same session or room

We do not collect document content, filenames, prompts, room keys, shared URLs,
or account information.

Analytics are disabled in self-hosted builds unless the operator configures
them.

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
