import type { ConnectionStatus } from "../collaboration/liveCollaboration";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";

export type BrowserPersistenceState =
  | "saving"
  | "saved"
  | "error"
  | "suspended";

export type FolderBindingStatus =
  | "ready"
  | "dirty"
  | "saving"
  | "conflict"
  | "permission-required"
  | "error"
  | "suspended";

export type WorkspaceContextState = {
  runtime: { kind: "local" } | { kind: "room" };
  browserPersistence: {
    state: BrowserPersistenceState;
  };
  folderBinding: null | {
    label?: string;
    writeMode: "manual" | "automatic";
    status: FolderBindingStatus;
  };
  collaboration: null | {
    connectionStatus: ConnectionStatus;
  };
};

export type WorkspaceContextSummaryItem = {
  kind: "browser" | "folder" | "collaboration";
  title: string;
  description: string;
  state: "steady" | "working" | "pending" | "paused" | "attention";
  attention: boolean;
};

export type WorkspaceContextSummaryViewModel = {
  primary: WorkspaceContextSummaryItem;
  items: WorkspaceContextSummaryItem[];
};

export const getOrderedWorkspaceContextItems = (
  summary: WorkspaceContextSummaryViewModel,
): WorkspaceContextSummaryItem[] => [
  summary.primary,
  ...summary.items.filter((item) => item.kind !== summary.primary.kind),
];

type ContextSummaryCopy = {
  browserTitle: string;
  browserOnlySaved: string;
  browserRecoverySaved: string;
  browserSaving: string;
  browserError: string;
  browserSuspended: string;
  folderTitle: string;
  folderManual: string;
  folderAutomatic: string;
  folderDirty: string;
  folderSaving: string;
  folderConflict: string;
  folderPermissionRequired: string;
  folderError: string;
  folderSuspended: string;
  roomTitle: string;
  roomConnecting: string;
  roomConnected: string;
  roomPaused: string;
  roomDisconnected: string;
};

const copies: Record<WorkspaceLanguage, ContextSummaryCopy> = {
  en: {
    browserTitle: "This browser",
    browserOnlySaved: "Saved automatically here. Not connected to a local folder.",
    browserRecoverySaved: "A recovery copy and Tabula data are saved in this browser.",
    browserSaving: "Saving a recovery copy in this browser…",
    browserError: "Couldn’t save the browser recovery copy.",
    browserSuspended: "Browser persistence is paused while this live room is open.",
    folderTitle: "Connected folder",
    folderManual: "Changes stay in this browser until you save them to the folder.",
    folderAutomatic: "Changes save automatically to this folder.",
    folderDirty: "Changes in this browser have not been saved to this folder.",
    folderSaving: "Saving changes to this folder…",
    folderConflict: "Saving is paused until the folder conflict is resolved.",
    folderPermissionRequired: "Folder permission is required before saving.",
    folderError: "Couldn’t save to this folder. Your changes remain in this browser.",
    folderSuspended: "Saving to this folder is paused.",
    roomTitle: "Live collaboration",
    roomConnecting: "Connecting this workspace to the live room…",
    roomConnected: "Changes are synchronized with everyone in this room.",
    roomPaused: "Synchronization is paused and will resume automatically.",
    roomDisconnected: "This browser is not synchronized with the live room.",
  },
  ko: {
    browserTitle: "이 브라우저",
    browserOnlySaved: "이 브라우저에 자동 저장됩니다. 로컬 폴더와 연결되어 있지 않습니다.",
    browserRecoverySaved: "복구 사본과 Tabula 데이터를 이 브라우저에 저장합니다.",
    browserSaving: "이 브라우저에 복구 사본을 저장하는 중입니다…",
    browserError: "브라우저 복구 사본을 저장하지 못했습니다.",
    browserSuspended: "실시간 룸을 연 동안 브라우저 저장이 일시 중지됩니다.",
    folderTitle: "연결된 폴더",
    folderManual: "폴더에 저장하기 전까지 변경 사항은 이 브라우저에 보관됩니다.",
    folderAutomatic: "변경 사항을 이 폴더에 자동 저장합니다.",
    folderDirty: "이 브라우저의 변경 사항이 폴더에 저장되지 않았습니다.",
    folderSaving: "폴더에 변경 사항을 저장하는 중입니다…",
    folderConflict: "폴더 충돌을 해결할 때까지 저장이 중지됩니다.",
    folderPermissionRequired: "저장하려면 폴더 권한이 필요합니다.",
    folderError: "폴더에 저장하지 못했습니다. 변경 사항은 이 브라우저에 남아 있습니다.",
    folderSuspended: "이 폴더에 저장하는 작업이 일시 중지됩니다.",
    roomTitle: "실시간 협업",
    roomConnecting: "워크스페이스를 실시간 룸에 연결하는 중입니다…",
    roomConnected: "이 룸의 모든 참여자와 변경 사항을 동기화합니다.",
    roomPaused: "동기화가 일시 중지되었으며 자동으로 다시 시작됩니다.",
    roomDisconnected: "이 브라우저가 실시간 룸과 동기화되지 않고 있습니다.",
  },
  ja: {
    browserTitle: "このブラウザー",
    browserOnlySaved: "このブラウザーに自動保存されます。ローカルフォルダーには接続されていません。",
    browserRecoverySaved: "復元用コピーと Tabula データはこのブラウザーに保存されます。",
    browserSaving: "このブラウザーに復元用コピーを保存中です…",
    browserError: "ブラウザーの復元用コピーを保存できませんでした。",
    browserSuspended: "ライブルームを開いている間、ブラウザー保存は一時停止します。",
    folderTitle: "接続中のフォルダー",
    folderManual: "フォルダーに保存するまで、変更はこのブラウザーに保持されます。",
    folderAutomatic: "変更はこのフォルダーに自動保存されます。",
    folderDirty: "このブラウザーの変更はまだフォルダーに保存されていません。",
    folderSaving: "フォルダーに変更を保存中です…",
    folderConflict: "フォルダーの競合が解決されるまで保存は停止します。",
    folderPermissionRequired: "保存するにはフォルダーの権限が必要です。",
    folderError: "フォルダーに保存できませんでした。変更はこのブラウザーに残っています。",
    folderSuspended: "このフォルダーへの保存は一時停止中です。",
    roomTitle: "ライブ共同編集",
    roomConnecting: "ワークスペースをライブルームに接続しています…",
    roomConnected: "このルームの全員と変更を同期しています。",
    roomPaused: "同期は一時停止中で、自動的に再開されます。",
    roomDisconnected: "このブラウザーはライブルームと同期していません。",
  },
  zh: {
    browserTitle: "此浏览器",
    browserOnlySaved: "内容会自动保存在此浏览器中，未连接到本地文件夹。",
    browserRecoverySaved: "恢复副本和 Tabula 数据保存在此浏览器中。",
    browserSaving: "正在此浏览器中保存恢复副本…",
    browserError: "无法保存浏览器恢复副本。",
    browserSuspended: "实时房间打开时，浏览器持久化已暂停。",
    folderTitle: "已连接的文件夹",
    folderManual: "保存到文件夹之前，更改会保留在此浏览器中。",
    folderAutomatic: "更改会自动保存到此文件夹。",
    folderDirty: "此浏览器中的更改尚未保存到文件夹。",
    folderSaving: "正在将更改保存到文件夹…",
    folderConflict: "解决文件夹冲突前，保存已暂停。",
    folderPermissionRequired: "保存前需要文件夹权限。",
    folderError: "无法保存到此文件夹。更改仍保留在此浏览器中。",
    folderSuspended: "已暂停保存到此文件夹。",
    roomTitle: "实时协作",
    roomConnecting: "正在将此工作区连接到实时房间…",
    roomConnected: "更改正与此房间中的所有人同步。",
    roomPaused: "同步已暂停，并会自动恢复。",
    roomDisconnected: "此浏览器未与实时房间同步。",
  },
  es: {
    browserTitle: "Este navegador",
    browserOnlySaved: "Se guarda automáticamente aquí. No está conectado a una carpeta local.",
    browserRecoverySaved: "Una copia de recuperación y los datos de Tabula se guardan en este navegador.",
    browserSaving: "Guardando una copia de recuperación en este navegador…",
    browserError: "No se pudo guardar la copia de recuperación del navegador.",
    browserSuspended: "La persistencia del navegador está pausada mientras esta sala está abierta.",
    folderTitle: "Carpeta conectada",
    folderManual: "Los cambios permanecen en este navegador hasta guardarlos en la carpeta.",
    folderAutomatic: "Los cambios se guardan automáticamente en esta carpeta.",
    folderDirty: "Los cambios de este navegador no se han guardado en la carpeta.",
    folderSaving: "Guardando cambios en esta carpeta…",
    folderConflict: "El guardado está pausado hasta resolver el conflicto de la carpeta.",
    folderPermissionRequired: "Se necesita permiso de la carpeta antes de guardar.",
    folderError: "No se pudo guardar en esta carpeta. Los cambios permanecen en este navegador.",
    folderSuspended: "El guardado en esta carpeta está pausado.",
    roomTitle: "Colaboración en vivo",
    roomConnecting: "Conectando este espacio a la sala en vivo…",
    roomConnected: "Los cambios se sincronizan con todas las personas de esta sala.",
    roomPaused: "La sincronización está pausada y se reanudará automáticamente.",
    roomDisconnected: "Este navegador no está sincronizado con la sala en vivo.",
  },
  fr: {
    browserTitle: "Ce navigateur",
    browserOnlySaved: "Enregistré automatiquement ici. Non connecté à un dossier local.",
    browserRecoverySaved: "Une copie de récupération et les données Tabula sont enregistrées dans ce navigateur.",
    browserSaving: "Enregistrement d’une copie de récupération dans ce navigateur…",
    browserError: "Impossible d’enregistrer la copie de récupération du navigateur.",
    browserSuspended: "La persistance du navigateur est suspendue pendant l’ouverture de cette salle.",
    folderTitle: "Dossier connecté",
    folderManual: "Les modifications restent dans ce navigateur jusqu’à leur enregistrement dans le dossier.",
    folderAutomatic: "Les modifications sont enregistrées automatiquement dans ce dossier.",
    folderDirty: "Les modifications de ce navigateur ne sont pas encore enregistrées dans le dossier.",
    folderSaving: "Enregistrement des modifications dans ce dossier…",
    folderConflict: "L’enregistrement est suspendu jusqu’à la résolution du conflit de dossier.",
    folderPermissionRequired: "L’autorisation du dossier est requise avant l’enregistrement.",
    folderError: "Impossible d’enregistrer dans ce dossier. Les modifications restent dans ce navigateur.",
    folderSuspended: "L’enregistrement dans ce dossier est suspendu.",
    roomTitle: "Collaboration en direct",
    roomConnecting: "Connexion de cet espace à la salle en direct…",
    roomConnected: "Les modifications sont synchronisées avec toutes les personnes de cette salle.",
    roomPaused: "La synchronisation est suspendue et reprendra automatiquement.",
    roomDisconnected: "Ce navigateur n’est pas synchronisé avec la salle en direct.",
  },
  de: {
    browserTitle: "Dieser Browser",
    browserOnlySaved: "Wird hier automatisch gespeichert. Nicht mit einem lokalen Ordner verbunden.",
    browserRecoverySaved: "Eine Wiederherstellungskopie und Tabula-Daten werden in diesem Browser gespeichert.",
    browserSaving: "Wiederherstellungskopie wird in diesem Browser gespeichert…",
    browserError: "Die Wiederherstellungskopie konnte nicht im Browser gespeichert werden.",
    browserSuspended: "Die Browser-Persistenz ist pausiert, solange dieser Live-Raum geöffnet ist.",
    folderTitle: "Verbundener Ordner",
    folderManual: "Änderungen bleiben in diesem Browser, bis du sie im Ordner speicherst.",
    folderAutomatic: "Änderungen werden automatisch in diesem Ordner gespeichert.",
    folderDirty: "Änderungen in diesem Browser wurden noch nicht im Ordner gespeichert.",
    folderSaving: "Änderungen werden in diesem Ordner gespeichert…",
    folderConflict: "Das Speichern ist pausiert, bis der Ordnerkonflikt gelöst ist.",
    folderPermissionRequired: "Vor dem Speichern ist eine Ordnerberechtigung erforderlich.",
    folderError: "Speichern in diesem Ordner fehlgeschlagen. Änderungen bleiben in diesem Browser erhalten.",
    folderSuspended: "Das Speichern in diesem Ordner ist pausiert.",
    roomTitle: "Live-Zusammenarbeit",
    roomConnecting: "Dieser Workspace wird mit dem Live-Raum verbunden…",
    roomConnected: "Änderungen werden mit allen Personen in diesem Raum synchronisiert.",
    roomPaused: "Die Synchronisierung ist pausiert und wird automatisch fortgesetzt.",
    roomDisconnected: "Dieser Browser ist nicht mit dem Live-Raum synchronisiert.",
  },
};

const getBrowserDescription = (
  copy: ContextSummaryCopy,
  state: BrowserPersistenceState,
  hasFolderBinding: boolean,
) => {
  if (state === "saving") return copy.browserSaving;
  if (state === "error") return copy.browserError;
  if (state === "suspended") return copy.browserSuspended;
  return hasFolderBinding ? copy.browserRecoverySaved : copy.browserOnlySaved;
};

const getFolderDescription = (
  copy: ContextSummaryCopy,
  folder: NonNullable<WorkspaceContextState["folderBinding"]>,
) => {
  if (folder.status === "dirty") return copy.folderDirty;
  if (folder.status === "saving") return copy.folderSaving;
  if (folder.status === "conflict") return copy.folderConflict;
  if (folder.status === "permission-required") {
    return copy.folderPermissionRequired;
  }
  if (folder.status === "error") return copy.folderError;
  if (folder.status === "suspended") return copy.folderSuspended;
  return folder.writeMode === "automatic"
    ? copy.folderAutomatic
    : copy.folderManual;
};

const getRoomDescription = (
  copy: ContextSummaryCopy,
  status: ConnectionStatus,
) => {
  if (status === "connected") return copy.roomConnected;
  if (status === "connecting" || status === "reconnecting" || status === "idle") {
    return copy.roomConnecting;
  }
  if (status === "suspended") return copy.roomPaused;
  return copy.roomDisconnected;
};

export const getWorkspaceContextSummary = (
  language: WorkspaceLanguage,
  context: WorkspaceContextState,
): WorkspaceContextSummaryViewModel => {
  const copy = copies[language];
  const browser: WorkspaceContextSummaryItem = {
    kind: "browser",
    title: copy.browserTitle,
    description: getBrowserDescription(
      copy,
      context.browserPersistence.state,
      Boolean(context.folderBinding),
    ),
    state:
      context.browserPersistence.state === "error"
        ? "attention"
        : context.browserPersistence.state === "saving"
          ? "working"
          : context.browserPersistence.state === "suspended"
            ? "paused"
            : "steady",
    attention: context.browserPersistence.state === "error",
  };
  const folder: WorkspaceContextSummaryItem | null = context.folderBinding
    ? {
        kind: "folder",
        title: context.folderBinding.label || copy.folderTitle,
        description: getFolderDescription(copy, context.folderBinding),
        state:
          context.folderBinding.status === "conflict" ||
          context.folderBinding.status === "permission-required" ||
          context.folderBinding.status === "error"
            ? "attention"
            : context.folderBinding.status === "saving"
              ? "working"
              : context.folderBinding.status === "dirty"
                ? "pending"
                : context.folderBinding.status === "suspended"
                  ? "paused"
                  : "steady",
        attention:
          context.folderBinding.status === "conflict" ||
          context.folderBinding.status === "permission-required" ||
          context.folderBinding.status === "error",
      }
    : null;
  const collaboration: WorkspaceContextSummaryItem | null = context.collaboration
    ? {
        kind: "collaboration",
        title: copy.roomTitle,
        description: getRoomDescription(
          copy,
          context.collaboration.connectionStatus,
        ),
        state:
          context.collaboration.connectionStatus === "disconnected" ||
          context.collaboration.connectionStatus === "failed"
            ? "attention"
            : context.collaboration.connectionStatus === "connecting" ||
                context.collaboration.connectionStatus === "reconnecting" ||
                context.collaboration.connectionStatus === "idle"
              ? "working"
              : context.collaboration.connectionStatus === "suspended"
                ? "paused"
                : "steady",
        attention:
          context.collaboration.connectionStatus === "disconnected" ||
          context.collaboration.connectionStatus === "failed",
      }
    : null;
  const items = [browser, folder, collaboration].filter(
    (item): item is WorkspaceContextSummaryItem => Boolean(item),
  );
  const primary = context.runtime.kind === "room" && collaboration
    ? collaboration
    : folder ?? browser;

  return { primary, items };
};
