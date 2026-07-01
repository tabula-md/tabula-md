# Firebase Project

Tabula.md uses Firebase Firestore as the hosted live-room recovery provider.
The app encrypts room recovery state in the browser before writing to
`rooms/{roomId}`.

Stored room documents contain only:

- `formatVersion`
- `stateVersion`
- `iv`
- `ciphertext`
- `updatedAt`

Deploy rules with the Firebase CLI from this directory:

```sh
firebase deploy --only firestore:rules,storage
```

The app needs the Firebase Web SDK config JSON through
`VITE_TABULA_FIREBASE_CONFIG`. The room key stays in the URL fragment and is
never sent to Firebase.
