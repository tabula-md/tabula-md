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

## Snapshot Links

Snapshot links use this shape:

```txt
https://tabula.md/#json=<snapshotId>,<snapshotKey>
```

The snapshot key is kept after the `#` fragment. Browsers use it locally to open
an encrypted copy. The snapshot service stores encrypted snapshot data, not the
snapshot key or plaintext Markdown.

Anyone with the full link, including the fragment key, can open a local copy.
Tabula.md is in public preview and does not yet provide account-based link
revoke controls.

## Reporting Problems

For product bugs, open an issue at
https://github.com/tabula-md/tabula-md/issues.

Do not paste full `#room` or `#json` links into public issues. The fragment key
is what opens the shared content.
