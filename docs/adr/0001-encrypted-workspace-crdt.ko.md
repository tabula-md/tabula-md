# ADR 0001: 암호화된 워크스페이스 CRDT

날짜: 2026-07-10
수정: 2026-07-16
상태: 승인됨
소유자: taeha

기준 문서: `0001-encrypted-workspace-crdt.md`

## 배경

이전 협업 구현은 문서별 Yjs 상태, JSON room event, 로컬 workspace 상태를
함께 관리했습니다. 이 구조에서는 여러 문서의 동시 변경, 폴더 트리,
재연결, checkpoint 경쟁, 메모리 해제를 한 기준으로 설명하기 어려웠습니다.

Tabula.md에는 사람과 에이전트가 같은 계약으로 여러 Markdown 문서, 폴더,
댓글을 함께 다루면서도 서버가 내용을 읽지 못하는 단일 모델이 필요합니다.

## 결정

- live room 하나는 `Y.Doc` 하나를 사용합니다.
- `tabula.nodes`는 폴더/문서 트리, `tabula.documents`는 문서별 `Y.Text`,
  `tabula.comments`는 댓글과 답글을 저장합니다.
- 현재 문서, 커서, 선택 영역, 참여자는 영속 workspace가 아니라 Awareness에
  둡니다.
- 사람과 에이전트는 같은 `RoomActor`와 direct edit 경로를 사용합니다.
  차이는 `kind`뿐입니다. capability는 `presence`, `read`, `write`만 두며
  공식 클라이언트 정책이지 암호학적 권한이 아닙니다.
- 외부 envelope는 `v: 1`, `kind: "room-event"`를 유지합니다. 복호화된 내부
  payload는 binary protocol v2이며 `sync.message`, `sync.chunk`,
  `awareness.updated`만 허용합니다.
- Firebase Storage에는 고유한 암호화 checkpoint blob을 저장하고,
  Firestore에는 generation CAS pointer와 메타데이터만 저장합니다. 보존
  기간은 마지막 성공 저장부터 7일입니다.
- `tabula-room`은 ciphertext relay만 담당하고, `tabula-json`은 암호화된
  Export link만 저장합니다.
- room은 논리적 Tabula workspace 전체입니다. 문서별 포함/제외나 live room
  안의 브라우저 전용 Private 분기는 없습니다. 새 문서와 폴더는 즉시 room에
  들어갑니다.
- Start session은 낙관적으로 시작합니다. 로컬 Y.Doc을 생성·검증한 직후
  room metadata와 URL을 붙이고 live 화면을 엽니다. relay 연결과 첫 Firebase
  암호화 checkpoint 저장은 백그라운드에서 계속합니다. 영구적인 연결 실패가
  발생하면 현재 room 상태를 로컬 workspace로 materialize해 계속 사용할 수
  있게 합니다.
- 기존 room/checkpoint와 브라우저 DB 형식은 호환하지 않습니다. 앱은
  정규화된 `tabula-workspace-v7` IndexedDB 스키마 하나만 사용하며 구버전
  DB나 전체 workspace localStorage fallback을 읽지 않습니다.
- 폴더 membership을 명시적으로 저장해 빈 폴더도 room에 참여하게 합니다.
- Yjs encoded state는 16 MiB 전송 한계보다 낮은 12 MiB로 제한합니다. live
  Y.Doc을 강제로 압축해 peer state vector를 깨뜨리지 않고 새 session을
  시작하도록 합니다.
- Yjs update와 Awareness update는 각각 암호화 전송 중 1개와 병합 대기
  1개만 유지합니다. 수신함은 envelope 64개, 32 MiB로 제한하고 문서별
  Undo 기록은 100단계로 제한합니다.

## 결과

- 텍스트와 트리 변경은 별도 CRUD event 없이 CRDT로 수렴합니다.
- 다른 참여자가 문서를 전환해도 내 편집 문서는 바뀌지 않습니다.
- 삭제 정보가 CRDT에 남아 오래 끊긴 peer가 문서를 부활시키지 않습니다.
- live room은 Markdown/댓글 본문 합계 10 MiB, 문서 500개, 폴더 500개,
  깊이 32, 댓글 5,000개, encoded CRDT state 12 MiB로 제한합니다.
- 로컬 workspace는 파일, 폴더, 댓글, 화면 상태를 분리한 IndexedDB record로
  복구합니다. `#room` workspace는 암호화 checkpoint에서만 복구하며 저장된
  로컬 workspace와 합치지 않습니다.
- 500회 update마다 encoded CRDT 크기를 확인해 hard limit 전에 알립니다.
  오프라인 peer는 이전 state vector를 가질 수 있으므로 live Y.Doc을 자동
  교체하는 압축은 하지 않습니다. 이를 안전하게 하려면 별도 epoch bridge와
  구 epoch 변경 병합 계약이 필요합니다.
- room URL을 가진 peer의 write를 암호학적으로 막지는 못합니다. 서명된
  capability나 write token은 별도 ADR이 필요한 후속 결정입니다.
- 첫 암호화 checkpoint가 저장되기 전에 모든 참여자가 브라우저를 닫으면 새
  room을 복구할 영속 상태가 없을 수 있습니다. 즉시 협업을 시작하기 위해
  수용한 제품 tradeoff이며, 이후 checkpoint가 성공하면 7일 만료가 갱신됩니다.

## 검토한 대안

- JSON `RoomEvent` 기반 문서 CRUD: CRDT와 중복되므로 제외했습니다.
- 문서별 Y.Doc: 트리, 댓글, checkpoint와 다중 문서 변경이 원자적이지 않아
  제외했습니다.
- `tabula-room` 또는 `tabula-json`에 live checkpoint 저장: 각 서비스의
  책임이 흐려지므로 제외했습니다.
- 에이전트 proposal 전용 흐름: 사람과 에이전트를 같은 참여자로 취급하는
  제품 결정과 맞지 않아 제외했습니다.
- 첫 영속 checkpoint가 끝날 때까지 room 진입을 미루는 방식: 저장 지연이 핵심
  협업 동작을 막는 경험을 만들기 때문에 제외했습니다. 로컬 room을 먼저 열고
  durability를 이후 상태로 노출합니다.
- live Y.Doc 자동 압축: 오프라인 peer의 변경을 잃거나 구 state vector를
  다시 병합해야 하므로 제외했습니다.

## 완료 조건

- 사람과 에이전트의 direct edit, 구조 변경, 댓글이 재연결 후 동일하게
  수렴합니다.
- room key는 URL fragment와 클라이언트 밖으로 나가지 않습니다.
- 늦은 참여와 새로고침은 암호화 checkpoint에서 복구됩니다.
- Start session은 relay 연결이나 checkpoint 왕복을 기다리지 않고 live 화면으로
  전환됩니다.
- 반복 연결/해제 후 socket, Yjs 객체, listener, timer, undo manager,
  chunk buffer가 남지 않습니다.
- 암호화가 느린 상황에서도 편집·커서 전송 대기열이 bounded 상태를 유지하고,
  frozen browser page가 다시 활성화되면 최종 상태가 수렴합니다.
