import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";

type WorkspaceMenuCopy = {
  sections: {
    documents: string;
    workspace: string;
    localFolder: string;
  };
  actions: {
    newFile: string;
    importFile: string;
    importWorkspace: string;
    openLiveWorkspace: string;
    saveLiveWorkspace: string;
    reviewLiveFolderConflict: string;
    disconnectLiveWorkspace: string;
    autoSaveLiveWorkspace: string;
    exportFile: string;
    exportWorkspace: string;
    clearWorkspace: string;
    liveCollaboration: string;
    preferences: string;
    about: string;
    help: string;
    followUs: string;
    github: string;
  };
  aria: {
    workspaceMenu: string;
    workspaceActions: string;
    openX: string;
    openGithub: string;
  };
  preferences: {
    theme: string;
    language: string;
    system: string;
    light: string;
    dark: string;
  };
  emptyState: {
    tagline: string;
    newFile: string;
    newFileDescription: string;
    openFile: string;
    openFileDescription: string;
    openWorkspace: string;
    openWorkspaceDescription: string;
    importWorkspaceDescription: string;
    browseFiles: string;
    help: string;
  };
  clearWorkspace: {
    title: string;
    description: string;
    cancel: string;
    confirm: string;
    cleared: string;
    undo: string;
    restored: string;
  };
  disconnectFolder: {
    title: string;
    description: string;
    cancel: string;
    confirm: string;
    disconnected: string;
  };
  share: {
    trigger: string;
    modalTitle: string;
    close: string;
    copyFailed: string;
    loadError: string;
    nothingToShare: string;
    chooserSecurityDescription: string;
    shareLinkLabel: string;
    live: {
      title: string;
      description: string;
      startSession: string;
      copyAgentInvite: string;
      retrySession: string;
      unavailable: string;
      reconnectingTitle: string;
      reconnectedTitle: string;
      pausedDescription: string;
      disconnectedTitle: string;
      statusLabel: (
        status: "connected" | "reconnecting" | "suspended" | "disconnected",
      ) => string;
      nameLabel: string;
      nameAria: string;
      anonymousPlaceholder: string;
      invalidInviteTitle: string;
      copyLink: string;
      copied: string;
      stopSession: string;
      stopDescription: string;
      stopConfirmTitle: string;
      stopConfirmDescription: string;
      stopJoinedConfirmDescription: string;
      afterLeaving: string;
      restoreLocalWorkspace: string;
      restoreLocalWorkspaceDescription: string;
      keepRoomCopy: string;
      keepRoomCopyDescription: string;
      cancelStop: string;
      confirmStop: string;
    };
    shareable: {
      title: string;
      description: string;
      expiryDescription: (formattedExpiry: string) => string;
      noFileReason: string;
      exportToLink: string;
      preparing: string;
      unavailable: string;
      copied: string;
      failed: string;
    };
  };
};

export type WorkspaceShareCopy = WorkspaceMenuCopy["share"];

export const WORKSPACE_LANGUAGE_OPTIONS: Array<{
  value: WorkspaceLanguage;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "ko", label: "한국어" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
];

const workspaceMenuCopy: Record<WorkspaceLanguage, WorkspaceMenuCopy> = {
  en: {
    sections: {
      documents: "Documents",
      workspace: "Workspace",
      localFolder: "Local folder",
    },
    actions: {
      newFile: "New document",
      importFile: "Import document (.md)…",
      importWorkspace: "Import folder copy…",
      openLiveWorkspace: "Connect local folder…",
      saveLiveWorkspace: "Save to folder",
      reviewLiveFolderConflict: "Review folder conflict",
      disconnectLiveWorkspace: "Disconnect folder",
      autoSaveLiveWorkspace: "Auto-save to folder",
      exportFile: "Export document (.md)",
      exportWorkspace: "Export workspace (.zip)",
      clearWorkspace: "Clear local workspace…",
      liveCollaboration: "Live collaboration…",
      preferences: "Preferences",
      about: "About",
      help: "Help",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
      workspaceMenu: "Workspace menu",
      workspaceActions: "Workspace actions",
      openX: "Open Tabula.md on X",
      openGithub: "Open Tabula.md on GitHub",
    },
    preferences: {
      theme: "Theme",
      language: "Language",
      system: "System",
      light: "Light",
      dark: "Dark",
    },
    emptyState: {
      tagline: "Open Markdown. Share one link. Edit with people or agents.",
      newFile: "New document",
      newFileDescription: "Start a blank Markdown document in this browser.",
      openFile: "Open Markdown file",
      openFileDescription: "Open one .md file without creating a project.",
      openWorkspace: "Connect folder",
      openWorkspaceDescription: "Edit Markdown in a local folder and save changes back to it.",
      importWorkspaceDescription: "Import a separate browser copy that will not stay in sync.",
      browseFiles: "Browse project files",
      help: "Help",
    },
    clearWorkspace: {
      title: "Clear local workspace?",
      description: "Remove all documents, folders, and comments from this browser. You can undo immediately after clearing.",
      cancel: "Cancel",
      confirm: "Clear workspace",
      cleared: "Local workspace cleared.",
      undo: "Undo",
      restored: "Local workspace restored.",
    },
    disconnectFolder: {
      title: "Disconnect local folder?",
      description: "Keep the current browser copy, but stop saving changes to the folder. Files already in the folder are not deleted.",
      cancel: "Cancel",
      confirm: "Disconnect folder",
      disconnected: "Folder disconnected. The browser copy is still here.",
    },
    share: {
      trigger: "Share",
      modalTitle: "Share",
      close: "Close Share",
      copyFailed: "Couldn’t copy. Try again.",
      loadError: "Couldn’t open sharing.",
      nothingToShare:
        "Nothing to share yet. Create or open a document first.",
      chooserSecurityDescription:
        "Your workspace is encrypted before it leaves this browser. Only people with the link can open it—not even Tabula.md’s servers can read it.",
      shareLinkLabel: "Share link",
      live: {
        title: "Open a live collaboration room",
        description:
          "This private room keeps the workspace’s documents and comments in sync while people are connected. You can also invite an agent with the prompt.",
        startSession: "Start session",
        copyAgentInvite: "Copy prompt",
        retrySession: "Retry",
        unavailable: "Live collaboration isn’t available right now.",
        reconnectingTitle: "Reconnecting to live room",
        reconnectedTitle: "Live room reconnected",
        pausedDescription: "It reconnects automatically when you return.",
        disconnectedTitle: "Live room disconnected",
        statusLabel: (status) => ({
          connected: "live collaboration active",
          reconnecting: "reconnecting",
          suspended: "paused",
          disconnected: "disconnected",
        })[status],
        nameLabel: "Your name",
        nameAria: "Your collaboration name",
        anonymousPlaceholder: "Anonymous",
        invalidInviteTitle: "This live room does not have a valid invite link.",
        copyLink: "Copy link",
        copied: "Copied",
        stopSession: "Leave room",
        stopDescription:
          "Leaving disconnects this browser from the room. You’ll keep working with a local copy, and everyone else can continue collaborating.",
        stopConfirmTitle: "Leave live collaboration?",
        stopConfirmDescription:
          "You’ll leave the live room and keep the latest workspace on this device as a local copy. Everyone else can continue collaborating.",
        stopJoinedConfirmDescription:
          "Choose what this browser should show after it disconnects. The live room and its invite link continue to work.",
        afterLeaving: "After leaving",
        restoreLocalWorkspace: "Return to my previous workspace",
        restoreLocalWorkspaceDescription:
          "Restore the browser workspace you had before opening this room.",
        keepRoomCopy: "Keep this room as my local workspace",
        keepRoomCopyDescription:
          "Replace the previous browser workspace with the latest room contents.",
        cancelStop: "Cancel",
        confirmStop: "Leave room",
      },
      shareable: {
        title: "Share a snapshot by link",
        description:
          "Create an encrypted copy of the workspace, including comments. People with the link can open that snapshot, but later changes won’t sync.",
        expiryDescription: (formattedExpiry) => `Expires ${formattedExpiry}`,
        noFileReason: "Open a file before exporting to link.",
        exportToLink: "Create link",
        preparing: "Preparing encrypted link…",
        unavailable: "Export to link isn’t available right now.",
        copied: "Export link copied.",
        failed: "Couldn’t export to link.",
      },
    },
  },
  ko: {
    sections: {
      documents: "문서",
      workspace: "워크스페이스",
      localFolder: "로컬 폴더",
    },
    actions: {
      newFile: "새 문서",
      importFile: "문서 가져오기 (.md)…",
      importWorkspace: "폴더 복사본 가져오기…",
      openLiveWorkspace: "로컬 폴더 연결…",
      saveLiveWorkspace: "폴더에 저장",
      reviewLiveFolderConflict: "폴더 충돌 검토",
      disconnectLiveWorkspace: "폴더 연결 해제",
      autoSaveLiveWorkspace: "폴더에 자동 저장",
      exportFile: "문서 내보내기 (.md)",
      exportWorkspace: "워크스페이스 내보내기 (.zip)",
      clearWorkspace: "로컬 워크스페이스 비우기…",
      liveCollaboration: "실시간 협업…",
      preferences: "환경설정",
      about: "소개",
      help: "도움말",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
      workspaceMenu: "작업공간 메뉴",
      workspaceActions: "작업공간 작업",
      openX: "X에서 Tabula.md 열기",
      openGithub: "GitHub에서 Tabula.md 열기",
    },
    preferences: {
      theme: "테마",
      language: "언어",
      system: "시스템",
      light: "라이트",
      dark: "다크",
    },
    emptyState: {
      tagline: "Markdown을 여세요. 링크 하나로 사람이나 에이전트와 함께 편집하세요.",
      newFile: "새 문서",
      newFileDescription: "이 브라우저에서 빈 Markdown 문서를 시작합니다.",
      openFile: "Markdown 파일 열기",
      openFileDescription: "프로젝트를 만들지 않고 .md 파일 하나를 엽니다.",
      openWorkspace: "폴더 연결",
      openWorkspaceDescription: "로컬 폴더의 Markdown을 편집하고 변경 사항을 다시 저장합니다.",
      importWorkspaceDescription: "동기화되지 않는 별도의 브라우저 복사본을 가져옵니다.",
      browseFiles: "프로젝트 파일 보기",
      help: "도움말",
    },
    clearWorkspace: {
      title: "로컬 워크스페이스를 비울까요?",
      description: "이 브라우저의 모든 문서, 폴더, 댓글을 제거합니다. 비운 직후에는 되돌릴 수 있습니다.",
      cancel: "취소",
      confirm: "워크스페이스 비우기",
      cleared: "로컬 워크스페이스를 비웠습니다.",
      undo: "되돌리기",
      restored: "로컬 워크스페이스를 복구했습니다.",
    },
    disconnectFolder: {
      title: "로컬 폴더 연결을 해제할까요?",
      description: "현재 브라우저 복사본은 유지하지만 폴더에 변경 사항을 저장하지 않습니다. 폴더의 기존 파일은 삭제되지 않습니다.",
      cancel: "취소",
      confirm: "폴더 연결 해제",
      disconnected: "폴더 연결을 해제했습니다. 브라우저 복사본은 그대로 유지됩니다.",
    },
    share: {
      trigger: "공유",
      modalTitle: "공유",
      close: "공유 닫기",
      copyFailed: "복사하지 못했습니다. 다시 시도하세요.",
      loadError: "공유를 열지 못했습니다.",
      nothingToShare:
        "아직 공유할 내용이 없습니다. 먼저 문서를 만들거나 여세요.",
      chooserSecurityDescription:
        "워크스페이스는 이 브라우저를 벗어나기 전에 암호화됩니다. 링크를 가진 사람만 열 수 있으며 Tabula.md 서버에서도 내용을 읽을 수 없습니다.",
      shareLinkLabel: "공유 링크",
      live: {
        title: "실시간 협업 룸 열기",
        description:
          "비공개 룸에 연결된 동안 워크스페이스의 문서와 댓글이 함께 동기화됩니다. 프롬프트를 보내 에이전트도 초대할 수 있습니다.",
        startSession: "세션 시작",
        copyAgentInvite: "프롬프트 복사",
        retrySession: "다시 연결",
        unavailable: "지금은 실시간 협업을 사용할 수 없습니다.",
        reconnectingTitle: "실시간 룸에 다시 연결하는 중",
        reconnectedTitle: "실시간 룸에 다시 연결했습니다",
        pausedDescription: "돌아오면 자동으로 다시 연결됩니다.",
        disconnectedTitle: "실시간 룸 연결이 끊어졌습니다",
        statusLabel: (status) => ({
          connected: "실시간 협업 중",
          reconnecting: "다시 연결하는 중",
          suspended: "일시 중지됨",
          disconnected: "연결 끊김",
        })[status],
        nameLabel: "내 이름",
        nameAria: "협업에서 표시할 이름",
        anonymousPlaceholder: "익명",
        invalidInviteTitle: "이 실시간 룸에는 유효한 초대 링크가 없습니다.",
        copyLink: "링크 복사",
        copied: "복사됨",
        stopSession: "룸 나가기",
        stopDescription:
          "나가면 이 브라우저만 룸에서 연결이 끊깁니다. 로컬 복사본으로 계속 작업할 수 있고 다른 참여자는 협업을 이어갈 수 있습니다.",
        stopConfirmTitle: "실시간 협업에서 나갈까요?",
        stopConfirmDescription:
          "실시간 룸에서 나가고 최신 워크스페이스를 이 기기에 로컬 복사본으로 남깁니다. 다른 참여자는 계속 협업할 수 있습니다.",
        stopJoinedConfirmDescription:
          "연결을 끊은 뒤 이 브라우저에 무엇을 표시할지 선택하세요. 실시간 룸과 초대 링크는 그대로 유지됩니다.",
        afterLeaving: "나간 뒤",
        restoreLocalWorkspace: "이전 워크스페이스로 돌아가기",
        restoreLocalWorkspaceDescription:
          "이 룸을 열기 전에 사용하던 브라우저 워크스페이스를 복원합니다.",
        keepRoomCopy: "이 룸을 로컬 워크스페이스로 유지",
        keepRoomCopyDescription:
          "이전 브라우저 워크스페이스를 최신 룸 내용으로 교체합니다.",
        cancelStop: "취소",
        confirmStop: "룸 나가기",
      },
      shareable: {
        title: "스냅샷 링크로 공유하기",
        description:
          "댓글을 포함한 워크스페이스의 암호화된 복사본을 만듭니다. 링크를 가진 사람은 스냅샷을 열 수 있지만 이후 변경 사항은 동기화되지 않습니다.",
        expiryDescription: (formattedExpiry) => `만료: ${formattedExpiry}`,
        noFileReason: "파일을 열면 링크로 내보낼 수 있습니다.",
        exportToLink: "링크 만들기",
        preparing: "암호화된 링크 준비 중…",
        unavailable: "지금은 링크로 내보낼 수 없습니다.",
        copied: "내보내기 링크를 복사했습니다.",
        failed: "링크로 내보내지 못했습니다.",
      },
    },
  },
  ja: {
    sections: {
      documents: "ドキュメント",
      workspace: "ワークスペース",
      localFolder: "ローカルフォルダー",
    },
    actions: {
      newFile: "新規ドキュメント",
      importFile: "ドキュメントを読み込む (.md)…",
      importWorkspace: "フォルダーのコピーを読み込む…",
      openLiveWorkspace: "ローカルフォルダーを接続…",
      saveLiveWorkspace: "フォルダーに保存",
      reviewLiveFolderConflict: "フォルダーの競合を確認",
      disconnectLiveWorkspace: "フォルダーの接続を解除",
      autoSaveLiveWorkspace: "フォルダーに自動保存",
      exportFile: "ドキュメントを書き出す (.md)",
      exportWorkspace: "ワークスペースを書き出す (.zip)",
      clearWorkspace: "ローカルワークスペースを消去…",
      liveCollaboration: "ライブ共同編集…",
      preferences: "環境設定",
      about: "このアプリについて",
      help: "ヘルプ",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
      workspaceMenu: "ワークスペースメニュー",
      workspaceActions: "ワークスペース操作",
      openX: "X で Tabula.md を開く",
      openGithub: "GitHub で Tabula.md を開く",
    },
    preferences: {
      theme: "テーマ",
      language: "言語",
      system: "システム",
      light: "ライト",
      dark: "ダーク",
    },
    emptyState: {
      tagline: "Markdownを開く。リンクを共有して、人やエージェントと編集。",
      newFile: "新規ドキュメント",
      newFileDescription: "このブラウザーで空の Markdown ドキュメントを作成します。",
      openFile: "Markdownファイルを開く",
      openFileDescription: "プロジェクトを作らずに .md ファイルを1つ開きます。",
      openWorkspace: "フォルダーを接続",
      openWorkspaceDescription: "ローカルフォルダーの Markdown を編集し、変更を保存します。",
      importWorkspaceDescription: "同期されない別のブラウザーコピーを読み込みます。",
      browseFiles: "プロジェクトファイルを見る",
      help: "ヘルプ",
    },
    clearWorkspace: {
      title: "ローカルワークスペースを消去しますか？",
      description: "このブラウザーのすべてのドキュメント、フォルダー、コメントを削除します。消去直後は元に戻せます。",
      cancel: "キャンセル",
      confirm: "ワークスペースを消去",
      cleared: "ローカルワークスペースを消去しました。",
      undo: "元に戻す",
      restored: "ローカルワークスペースを復元しました。",
    },
    disconnectFolder: {
      title: "ローカルフォルダーを切断しますか？",
      description: "現在のブラウザーコピーは保持しますが、変更をフォルダーへ保存しなくなります。フォルダー内の既存ファイルは削除されません。",
      cancel: "キャンセル",
      confirm: "フォルダーを切断",
      disconnected: "フォルダーを切断しました。ブラウザーコピーは保持されています。",
    },
    share: {
      trigger: "共有",
      modalTitle: "共有",
      close: "共有を閉じる",
      copyFailed: "コピーできませんでした。もう一度お試しください。",
      loadError: "共有を開けませんでした。",
      nothingToShare:
        "まだ共有できる内容がありません。まずドキュメントを作成するか開いてください。",
      chooserSecurityDescription:
        "ワークスペースはこのブラウザーを離れる前に暗号化されます。リンクを持つ人だけが開くことができ、Tabula.md のサーバーも内容を読み取れません。",
      shareLinkLabel: "共有リンク",
      live: {
        title: "ライブ共同編集ルームを開く",
        description:
          "非公開ルームへの接続中は、ワークスペースのドキュメントとコメントが同期されます。プロンプトを送ってエージェントも招待できます。",
        startSession: "セッションを開始",
        copyAgentInvite: "プロンプトをコピー",
        retrySession: "再試行",
        unavailable: "現在、ライブ共同編集は利用できません。",
        reconnectingTitle: "ライブ共同編集ルームに再接続中",
        reconnectedTitle: "ライブ共同編集ルームに再接続しました",
        pausedDescription: "戻ると自動的に再接続します。",
        disconnectedTitle: "ライブ共同編集ルームから切断されました",
        statusLabel: (status) => ({
          connected: "ライブ共同編集が有効",
          reconnecting: "再接続中",
          suspended: "一時停止",
          disconnected: "切断済み",
        })[status],
        nameLabel: "あなたの名前",
        nameAria: "共同編集で表示する名前",
        anonymousPlaceholder: "匿名",
        invalidInviteTitle:
          "このライブ共同編集ルームには有効な招待リンクがありません。",
        copyLink: "リンクをコピー",
        copied: "コピー済み",
        stopSession: "ルームを退出",
        stopDescription:
          "退出すると、このブラウザーだけがルームから切断されます。ローカルコピーで作業を続けられ、他の参加者も共同編集を続けられます。",
        stopConfirmTitle: "ライブ共同編集から退出しますか？",
        stopConfirmDescription:
          "ライブルームを退出し、最新のワークスペースをこの端末にローカルコピーとして残します。他の参加者は共同編集を続けられます。",
        stopJoinedConfirmDescription:
          "切断後にこのブラウザーに表示する内容を選択してください。ライブルームと招待リンクは引き続き利用できます。",
        afterLeaving: "退出後",
        restoreLocalWorkspace: "以前のワークスペースに戻る",
        restoreLocalWorkspaceDescription:
          "このルームを開く前のブラウザーワークスペースを復元します。",
        keepRoomCopy: "このルームをローカルワークスペースとして保持",
        keepRoomCopyDescription:
          "以前のブラウザーワークスペースを最新のルーム内容で置き換えます。",
        cancelStop: "キャンセル",
        confirmStop: "ルームを退出",
      },
      shareable: {
        title: "スナップショットをリンクで共有する",
        description:
          "コメントを含むワークスペースの暗号化コピーを作成します。リンクを持つ人はスナップショットを開けますが、以後の変更は同期されません。",
        expiryDescription: (formattedExpiry) => `有効期限 ${formattedExpiry}`,
        noFileReason:
          "ファイルを開くとリンクに書き出せます。",
        exportToLink: "リンクを作成",
        preparing: "暗号化リンクを準備中…",
        unavailable: "現在、リンクへの書き出しは利用できません。",
        copied: "書き出しリンクをコピーしました。",
        failed: "リンクに書き出せませんでした。",
      },
    },
  },
  zh: {
    sections: {
      documents: "文档",
      workspace: "工作区",
      localFolder: "本地文件夹",
    },
    actions: {
      newFile: "新建文档",
      importFile: "导入文档 (.md)…",
      importWorkspace: "导入文件夹副本…",
      openLiveWorkspace: "连接本地文件夹…",
      saveLiveWorkspace: "保存到文件夹",
      reviewLiveFolderConflict: "检查文件夹冲突",
      disconnectLiveWorkspace: "断开文件夹连接",
      autoSaveLiveWorkspace: "自动保存到文件夹",
      exportFile: "导出文档 (.md)",
      exportWorkspace: "导出工作区 (.zip)",
      clearWorkspace: "清空本地工作区…",
      liveCollaboration: "实时协作…",
      preferences: "偏好设置",
      about: "关于",
      help: "帮助",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
      workspaceMenu: "工作区菜单",
      workspaceActions: "工作区操作",
      openX: "在 X 打开 Tabula.md",
      openGithub: "在 GitHub 打开 Tabula.md",
    },
    preferences: {
      theme: "主题",
      language: "语言",
      system: "系统",
      light: "浅色",
      dark: "深色",
    },
    emptyState: {
      tagline: "打开 Markdown。分享一个链接，与人或智能体一起编辑。",
      newFile: "新建文档",
      newFileDescription: "在此浏览器中创建空白 Markdown 文档。",
      openFile: "打开 Markdown 文件",
      openFileDescription: "直接打开一个 .md 文件，无需创建项目。",
      openWorkspace: "连接文件夹",
      openWorkspaceDescription: "编辑本地文件夹中的 Markdown，并将更改保存回去。",
      importWorkspaceDescription: "导入一个不会保持同步的独立浏览器副本。",
      browseFiles: "浏览项目文件",
      help: "帮助",
    },
    clearWorkspace: {
      title: "清空本地工作区？",
      description: "移除此浏览器中的所有文档、文件夹和评论。清空后可立即撤销。",
      cancel: "取消",
      confirm: "清空工作区",
      cleared: "本地工作区已清空。",
      undo: "撤销",
      restored: "本地工作区已恢复。",
    },
    disconnectFolder: {
      title: "断开本地文件夹？",
      description: "保留当前浏览器副本，但停止将更改保存到文件夹。文件夹中的现有文件不会被删除。",
      cancel: "取消",
      confirm: "断开文件夹",
      disconnected: "文件夹已断开。浏览器副本仍然保留。",
    },
    share: {
      trigger: "分享",
      modalTitle: "分享",
      close: "关闭分享",
      copyFailed: "复制失败，请重试。",
      loadError: "无法打开分享。",
      nothingToShare: "暂无可分享的内容。请先创建或打开一个文档。",
      chooserSecurityDescription:
        "工作区会在离开此浏览器前加密。只有拥有链接的人才能打开，Tabula.md 的服务器也无法读取内容。",
      shareLinkLabel: "分享链接",
      live: {
        title: "打开实时协作房间",
        description:
          "连接到私密房间期间，工作区的文档和评论会保持同步。你也可以发送提示词来邀请智能体。",
        startSession: "启动协作",
        copyAgentInvite: "复制提示词",
        retrySession: "重试",
        unavailable: "实时协作目前不可用。",
        reconnectingTitle: "正在重新连接实时协作房间",
        reconnectedTitle: "已重新连接实时协作房间",
        pausedDescription: "返回时会自动重新连接。",
        disconnectedTitle: "实时协作房间已断开连接",
        statusLabel: (status) => ({
          connected: "实时协作已启用",
          reconnecting: "正在重新连接",
          suspended: "已暂停",
          disconnected: "已断开连接",
        })[status],
        nameLabel: "你的名字",
        nameAria: "协作显示名称",
        anonymousPlaceholder: "匿名",
        invalidInviteTitle: "此实时协作空间没有有效的邀请链接。",
        copyLink: "复制链接",
        copied: "已复制",
        stopSession: "离开协作空间",
        stopDescription:
          "离开后仅此浏览器会断开连接。你可以继续使用本地副本，其他参与者仍可继续协作。",
        stopConfirmTitle: "离开实时协作？",
        stopConfirmDescription:
          "你将离开实时房间，并在此设备上保留最新工作区的本地副本。其他参与者仍可继续协作。",
        stopJoinedConfirmDescription:
          "选择断开连接后此浏览器显示的内容。实时房间和邀请链接仍可继续使用。",
        afterLeaving: "离开后",
        restoreLocalWorkspace: "返回之前的工作区",
        restoreLocalWorkspaceDescription:
          "恢复打开此房间之前使用的浏览器工作区。",
        keepRoomCopy: "将此房间保留为本地工作区",
        keepRoomCopyDescription:
          "用最新的房间内容替换之前的浏览器工作区。",
        cancelStop: "取消",
        confirmStop: "离开协作空间",
      },
      shareable: {
        title: "通过链接分享快照",
        description:
          "创建包含评论的工作区加密副本。拥有链接的人可以打开该快照，但之后的更改不会同步。",
        expiryDescription: (formattedExpiry) => `到期日 ${formattedExpiry}`,
        noFileReason: "打开文件后即可导出为链接。",
        exportToLink: "创建链接",
        preparing: "正在准备加密链接…",
        unavailable: "目前无法导出为链接。",
        copied: "已复制导出链接。",
        failed: "无法导出为链接。",
      },
    },
  },
  es: {
    sections: {
      documents: "Documentos",
      workspace: "Espacio de trabajo",
      localFolder: "Carpeta local",
    },
    actions: {
      newFile: "Nuevo documento",
      importFile: "Importar documento (.md)…",
      importWorkspace: "Importar copia de carpeta…",
      openLiveWorkspace: "Conectar carpeta local…",
      saveLiveWorkspace: "Guardar en la carpeta",
      reviewLiveFolderConflict: "Revisar conflicto de carpeta",
      disconnectLiveWorkspace: "Desconectar carpeta",
      autoSaveLiveWorkspace: "Guardar automáticamente en la carpeta",
      exportFile: "Exportar documento (.md)",
      exportWorkspace: "Exportar espacio de trabajo (.zip)",
      clearWorkspace: "Vaciar espacio local…",
      liveCollaboration: "Colaboración en vivo…",
      preferences: "Preferencias",
      about: "Acerca de",
      help: "Ayuda",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
      workspaceMenu: "Menú del espacio",
      workspaceActions: "Acciones del espacio",
      openX: "Abrir Tabula.md en X",
      openGithub: "Abrir Tabula.md en GitHub",
    },
    preferences: {
      theme: "Tema",
      language: "Idioma",
      system: "Sistema",
      light: "Claro",
      dark: "Oscuro",
    },
    emptyState: {
      tagline: "Abre Markdown. Comparte un enlace. Edita con personas o agentes.",
      newFile: "Nuevo documento",
      newFileDescription: "Crea un documento Markdown vacío en este navegador.",
      openFile: "Abrir archivo Markdown",
      openFileDescription: "Abre un archivo .md sin crear un proyecto.",
      openWorkspace: "Conectar carpeta",
      openWorkspaceDescription: "Edita Markdown en una carpeta local y guarda allí los cambios.",
      importWorkspaceDescription: "Importa una copia separada del navegador que no se sincronizará.",
      browseFiles: "Ver archivos del proyecto",
      help: "Ayuda",
    },
    clearWorkspace: {
      title: "¿Vaciar el espacio local?",
      description: "Elimina del navegador todos los documentos, carpetas y comentarios. Puedes deshacerlo inmediatamente.",
      cancel: "Cancelar",
      confirm: "Vaciar espacio",
      cleared: "Espacio local vaciado.",
      undo: "Deshacer",
      restored: "Espacio local restaurado.",
    },
    disconnectFolder: {
      title: "¿Desconectar la carpeta local?",
      description: "Conserva la copia del navegador, pero deja de guardar cambios en la carpeta. Los archivos existentes no se eliminan.",
      cancel: "Cancelar",
      confirm: "Desconectar carpeta",
      disconnected: "Carpeta desconectada. La copia del navegador se conserva.",
    },
    share: {
      trigger: "Compartir",
      modalTitle: "Compartir",
      close: "Cerrar Compartir",
      copyFailed: "No se pudo copiar. Inténtalo de nuevo.",
      loadError: "No se pudo abrir Compartir.",
      nothingToShare:
        "Aún no hay nada que compartir. Crea o abre un documento primero.",
      chooserSecurityDescription:
        "El espacio se cifra antes de salir de este navegador. Solo quienes tengan el enlace pueden abrirlo; ni los servidores de Tabula.md pueden leer el contenido.",
      shareLinkLabel: "Enlace para compartir",
      live: {
        title: "Abrir una sala de colaboración en vivo",
        description:
          "Esta sala privada mantiene sincronizados los documentos y comentarios mientras haya personas conectadas. También puedes invitar a un agente con el prompt.",
        startSession: "Iniciar colaboración",
        copyAgentInvite: "Copiar prompt",
        retrySession: "Reintentar",
        unavailable: "La colaboración en vivo no está disponible ahora.",
        reconnectingTitle: "Reconectando a la sala en vivo",
        reconnectedTitle: "Sala en vivo reconectada",
        pausedDescription: "Se reconecta automáticamente cuando vuelvas.",
        disconnectedTitle: "Sala en vivo desconectada",
        statusLabel: (status) => ({
          connected: "colaboración en vivo activa",
          reconnecting: "reconectando",
          suspended: "en pausa",
          disconnected: "desconectada",
        })[status],
        nameLabel: "Tu nombre",
        nameAria: "Tu nombre de colaboración",
        anonymousPlaceholder: "Anónimo",
        invalidInviteTitle:
          "Esta sala en vivo no tiene un enlace de invitación válido.",
        copyLink: "Copiar enlace",
        copied: "Copiado",
        stopSession: "Salir de la sala",
        stopDescription:
          "Al salir, este navegador se desconecta de la sala. Puedes seguir trabajando con una copia local y los demás pueden continuar colaborando.",
        stopConfirmTitle: "¿Salir de la colaboración en vivo?",
        stopConfirmDescription:
          "Saldrás de la sala y conservarás el espacio más reciente como copia local en este dispositivo. Los demás pueden continuar colaborando.",
        stopJoinedConfirmDescription:
          "Elige qué mostrará este navegador después de desconectarse. La sala y su enlace de invitación seguirán funcionando.",
        afterLeaving: "Después de salir",
        restoreLocalWorkspace: "Volver a mi espacio anterior",
        restoreLocalWorkspaceDescription:
          "Restaura el espacio del navegador que usabas antes de abrir esta sala.",
        keepRoomCopy: "Conservar esta sala como espacio local",
        keepRoomCopyDescription:
          "Reemplaza el espacio anterior del navegador con el contenido más reciente de la sala.",
        cancelStop: "Cancelar",
        confirmStop: "Salir de la sala",
      },
      shareable: {
        title: "Compartir una instantánea por enlace",
        description:
          "Crea una copia cifrada del espacio, incluidos los comentarios. Quienes tengan el enlace pueden abrirla, pero los cambios posteriores no se sincronizan.",
        expiryDescription: (formattedExpiry) => `Caduca el ${formattedExpiry}`,
        noFileReason:
          "Abre un archivo antes de exportar a enlace.",
        exportToLink: "Crear enlace",
        preparing: "Preparando enlace cifrado…",
        unavailable: "La exportación a enlace no está disponible ahora.",
        copied: "Enlace de exportación copiado.",
        failed: "No se pudo exportar a un enlace.",
      },
    },
  },
  fr: {
    sections: {
      documents: "Documents",
      workspace: "Espace de travail",
      localFolder: "Dossier local",
    },
    actions: {
      newFile: "Nouveau document",
      importFile: "Importer un document (.md)…",
      importWorkspace: "Importer une copie du dossier…",
      openLiveWorkspace: "Connecter un dossier local…",
      saveLiveWorkspace: "Enregistrer dans le dossier",
      reviewLiveFolderConflict: "Examiner le conflit du dossier",
      disconnectLiveWorkspace: "Déconnecter le dossier",
      autoSaveLiveWorkspace: "Enregistrement automatique dans le dossier",
      exportFile: "Exporter le document (.md)",
      exportWorkspace: "Exporter l’espace de travail (.zip)",
      clearWorkspace: "Effacer l’espace local…",
      liveCollaboration: "Collaboration en direct…",
      preferences: "Préférences",
      about: "À propos",
      help: "Aide",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
      workspaceMenu: "Menu de l’espace",
      workspaceActions: "Actions de l’espace",
      openX: "Ouvrir Tabula.md sur X",
      openGithub: "Ouvrir Tabula.md sur GitHub",
    },
    preferences: {
      theme: "Thème",
      language: "Langue",
      system: "Système",
      light: "Clair",
      dark: "Sombre",
    },
    emptyState: {
      tagline: "Ouvrez Markdown. Partagez un lien. Modifiez avec des personnes ou des agents.",
      newFile: "Nouveau document",
      newFileDescription: "Créez un document Markdown vierge dans ce navigateur.",
      openFile: "Ouvrir un fichier Markdown",
      openFileDescription: "Ouvrez un fichier .md sans créer de projet.",
      openWorkspace: "Connecter un dossier",
      openWorkspaceDescription: "Modifiez le Markdown d’un dossier local et enregistrez-y les changements.",
      importWorkspaceDescription: "Importez une copie distincte dans le navigateur, sans synchronisation.",
      browseFiles: "Parcourir les fichiers",
      help: "Aide",
    },
    clearWorkspace: {
      title: "Effacer l’espace local ?",
      description: "Supprime du navigateur tous les documents, dossiers et commentaires. Vous pouvez annuler immédiatement.",
      cancel: "Annuler",
      confirm: "Effacer l’espace",
      cleared: "Espace local effacé.",
      undo: "Annuler",
      restored: "Espace local restauré.",
    },
    disconnectFolder: {
      title: "Déconnecter le dossier local ?",
      description: "Conserve la copie du navigateur, mais cesse d’enregistrer les changements dans le dossier. Les fichiers existants ne sont pas supprimés.",
      cancel: "Annuler",
      confirm: "Déconnecter le dossier",
      disconnected: "Dossier déconnecté. La copie du navigateur est conservée.",
    },
    share: {
      trigger: "Partager",
      modalTitle: "Partager",
      close: "Fermer le partage",
      copyFailed: "Impossible de copier. Réessayez.",
      loadError: "Impossible d’ouvrir le partage.",
      nothingToShare:
        "Rien à partager pour le moment. Créez ou ouvrez d’abord un document.",
      chooserSecurityDescription:
        "L’espace est chiffré avant de quitter ce navigateur. Seules les personnes ayant le lien peuvent l’ouvrir ; même les serveurs de Tabula.md ne peuvent pas lire le contenu.",
      shareLinkLabel: "Lien de partage",
      live: {
        title: "Ouvrir une salle de collaboration en direct",
        description:
          "Cette salle privée synchronise les documents et commentaires tant que des personnes sont connectées. Vous pouvez aussi inviter un agent avec le prompt.",
        startSession: "Démarrer la session",
        copyAgentInvite: "Copier le prompt",
        retrySession: "Réessayer",
        unavailable: "La collaboration en direct n’est pas disponible actuellement.",
        reconnectingTitle: "Reconnexion à l’espace en direct",
        reconnectedTitle: "Espace en direct reconnecté",
        pausedDescription: "La reconnexion est automatique à votre retour.",
        disconnectedTitle: "Espace en direct déconnecté",
        statusLabel: (status) => ({
          connected: "collaboration en direct active",
          reconnecting: "reconnexion",
          suspended: "en pause",
          disconnected: "déconnectée",
        })[status],
        nameLabel: "Votre nom",
        nameAria: "Votre nom de collaboration",
        anonymousPlaceholder: "Anonyme",
        invalidInviteTitle:
          "Cette salle en direct n’a pas de lien d’invitation valide.",
        copyLink: "Copier le lien",
        copied: "Copié",
        stopSession: "Quitter la salle",
        stopDescription:
          "Quitter déconnecte ce navigateur de la salle. Vous pouvez continuer avec une copie locale et les autres peuvent poursuivre la collaboration.",
        stopConfirmTitle: "Quitter la collaboration en direct ?",
        stopConfirmDescription:
          "Vous quitterez la salle et conserverez l’espace le plus récent comme copie locale sur cet appareil. Les autres peuvent poursuivre la collaboration.",
        stopJoinedConfirmDescription:
          "Choisissez ce que ce navigateur affichera après la déconnexion. La salle et son lien d’invitation continueront de fonctionner.",
        afterLeaving: "Après avoir quitté",
        restoreLocalWorkspace: "Revenir à mon espace précédent",
        restoreLocalWorkspaceDescription:
          "Restaure l’espace du navigateur utilisé avant d’ouvrir cette salle.",
        keepRoomCopy: "Conserver cette salle comme espace local",
        keepRoomCopyDescription:
          "Remplace l’espace précédent du navigateur par le contenu actuel de la salle.",
        cancelStop: "Annuler",
        confirmStop: "Quitter la salle",
      },
      shareable: {
        title: "Partager un instantané par lien",
        description:
          "Créez une copie chiffrée de l’espace, commentaires inclus. Les personnes ayant le lien peuvent l’ouvrir, mais les modifications ultérieures ne seront pas synchronisées.",
        expiryDescription: (formattedExpiry) => `Expire le ${formattedExpiry}`,
        noFileReason:
          "Ouvrez un fichier avant d'exporter vers un lien.",
        exportToLink: "Créer un lien",
        preparing: "Préparation du lien chiffré…",
        unavailable: "L’export vers un lien n’est pas disponible actuellement.",
        copied: "Lien d’export copié.",
        failed: "Impossible d’exporter vers un lien.",
      },
    },
  },
  de: {
    sections: {
      documents: "Dokumente",
      workspace: "Workspace",
      localFolder: "Lokaler Ordner",
    },
    actions: {
      newFile: "Neues Dokument",
      importFile: "Dokument importieren (.md)…",
      importWorkspace: "Ordnerkopie importieren…",
      openLiveWorkspace: "Lokalen Ordner verbinden…",
      saveLiveWorkspace: "Im Ordner speichern",
      reviewLiveFolderConflict: "Ordnerkonflikt prüfen",
      disconnectLiveWorkspace: "Ordner trennen",
      autoSaveLiveWorkspace: "Automatisch im Ordner speichern",
      exportFile: "Dokument exportieren (.md)",
      exportWorkspace: "Workspace exportieren (.zip)",
      clearWorkspace: "Lokalen Workspace leeren…",
      liveCollaboration: "Live-Zusammenarbeit…",
      preferences: "Einstellungen",
      about: "Info",
      help: "Hilfe",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
      workspaceMenu: "Workspace-Menü",
      workspaceActions: "Workspace-Aktionen",
      openX: "Tabula.md auf X öffnen",
      openGithub: "Tabula.md auf GitHub öffnen",
    },
    preferences: {
      theme: "Design",
      language: "Sprache",
      system: "System",
      light: "Hell",
      dark: "Dunkel",
    },
    emptyState: {
      tagline: "Markdown öffnen. Einen Link teilen. Mit Menschen oder Agenten bearbeiten.",
      newFile: "Neues Dokument",
      newFileDescription: "Ein leeres Markdown-Dokument in diesem Browser erstellen.",
      openFile: "Markdown-Datei öffnen",
      openFileDescription: "Eine .md-Datei öffnen, ohne ein Projekt anzulegen.",
      openWorkspace: "Ordner verbinden",
      openWorkspaceDescription: "Markdown im lokalen Ordner bearbeiten und Änderungen zurückspeichern.",
      importWorkspaceDescription: "Eine separate Browserkopie ohne Synchronisierung importieren.",
      browseFiles: "Projektdateien ansehen",
      help: "Hilfe",
    },
    clearWorkspace: {
      title: "Lokalen Workspace leeren?",
      description: "Entfernt alle Dokumente, Ordner und Kommentare aus diesem Browser. Direkt danach ist Rückgängig möglich.",
      cancel: "Abbrechen",
      confirm: "Workspace leeren",
      cleared: "Lokaler Workspace geleert.",
      undo: "Rückgängig",
      restored: "Lokaler Workspace wiederhergestellt.",
    },
    disconnectFolder: {
      title: "Lokalen Ordner trennen?",
      description: "Behält die Browserkopie, speichert Änderungen aber nicht mehr im Ordner. Vorhandene Dateien werden nicht gelöscht.",
      cancel: "Abbrechen",
      confirm: "Ordner trennen",
      disconnected: "Ordner getrennt. Die Browserkopie bleibt erhalten.",
    },
    share: {
      trigger: "Teilen",
      modalTitle: "Teilen",
      close: "Teilen schließen",
      copyFailed: "Kopieren fehlgeschlagen. Versuche es erneut.",
      loadError: "Teilen konnte nicht geöffnet werden.",
      nothingToShare:
        "Noch nichts zum Teilen vorhanden. Erstelle oder öffne zuerst ein Dokument.",
      chooserSecurityDescription:
        "Der Workspace wird verschlüsselt, bevor er diesen Browser verlässt. Nur Personen mit dem Link können ihn öffnen; auch die Server von Tabula.md können den Inhalt nicht lesen.",
      shareLinkLabel: "Freigabelink",
      live: {
        title: "Live-Raum für Zusammenarbeit öffnen",
        description:
          "Dieser private Raum hält Dokumente und Kommentare synchron, solange Personen verbunden sind. Du kannst mit dem Prompt auch einen Agenten einladen.",
        startSession: "Sitzung starten",
        copyAgentInvite: "Prompt kopieren",
        retrySession: "Erneut versuchen",
        unavailable: "Live-Zusammenarbeit ist derzeit nicht verfügbar.",
        reconnectingTitle: "Live-Raum wird erneut verbunden",
        reconnectedTitle: "Live-Raum wieder verbunden",
        pausedDescription: "Bei deiner Rückkehr wird die Verbindung automatisch wiederhergestellt.",
        disconnectedTitle: "Verbindung zum Live-Raum getrennt",
        statusLabel: (status) => ({
          connected: "Live-Zusammenarbeit aktiv",
          reconnecting: "Verbindung wird wiederhergestellt",
          suspended: "pausiert",
          disconnected: "getrennt",
        })[status],
        nameLabel: "Dein Name",
        nameAria: "Dein Name für die Zusammenarbeit",
        anonymousPlaceholder: "Anonym",
        invalidInviteTitle:
          "Dieser Live-Room hat keinen gültigen Einladungslink.",
        copyLink: "Link kopieren",
        copied: "Kopiert",
        stopSession: "Raum verlassen",
        stopDescription:
          "Beim Verlassen wird dieser Browser vom Raum getrennt. Du kannst mit einer lokalen Kopie weiterarbeiten und alle anderen können weiter zusammenarbeiten.",
        stopConfirmTitle: "Live-Zusammenarbeit verlassen?",
        stopConfirmDescription:
          "Du verlässt den Live-Raum und behältst den aktuellen Workspace als lokale Kopie auf diesem Gerät. Alle anderen können weiter zusammenarbeiten.",
        stopJoinedConfirmDescription:
          "Wähle, was dieser Browser nach dem Trennen anzeigen soll. Der Live-Raum und sein Einladungslink bleiben bestehen.",
        afterLeaving: "Nach dem Verlassen",
        restoreLocalWorkspace: "Zum vorherigen Workspace zurückkehren",
        restoreLocalWorkspaceDescription:
          "Stellt den Browser-Workspace wieder her, der vor diesem Raum geöffnet war.",
        keepRoomCopy: "Diesen Raum als lokalen Workspace behalten",
        keepRoomCopyDescription:
          "Ersetzt den vorherigen Browser-Workspace durch den aktuellen Rauminhalt.",
        cancelStop: "Abbrechen",
        confirmStop: "Raum verlassen",
      },
      shareable: {
        title: "Momentaufnahme per Link teilen",
        description:
          "Erstellt eine verschlüsselte Kopie des Workspace einschließlich Kommentaren. Personen mit dem Link können sie öffnen; spätere Änderungen werden nicht synchronisiert.",
        expiryDescription: (formattedExpiry) => `Läuft am ${formattedExpiry} ab`,
        noFileReason:
          "Öffne eine Datei, bevor du als Link exportierst.",
        exportToLink: "Link erstellen",
        preparing: "Verschlüsselten Link vorbereiten…",
        unavailable: "Der Export als Link ist derzeit nicht verfügbar.",
        copied: "Exportlink kopiert.",
        failed: "Export als Link fehlgeschlagen.",
      },
    },
  },
};

export const getWorkspaceMenuCopy = (language: WorkspaceLanguage) =>
  workspaceMenuCopy[language];

export type WorkspaceChromeCopy = {
  topChrome: {
    openWorkspaceMenu: string;
    closeWorkspaceMenu: string;
    toggleWorkspacePanel: string;
    toggleSidePanel: string;
    closeSidePanel: string;
    collaborators: string;
    agent: string;
    active: string;
    idle: string;
    away: string;
    inWorkspace: string;
    agentInWorkspace: string;
    viewing: (name: string) => string;
    agentViewing: (name: string) => string;
    line: (lineNumber: number) => string;
    inThisFile: string;
    liveWith: (names: string) => string;
    liveAs: (name: string) => string;
    follow: (name: string) => string;
    stopFollowing: (name: string) => string;
  };
  documentControls: {
    documentToolbar: string;
    documentControlsLabel: string;
    editingMode: string;
    editor: string;
    split: string;
    source: string;
    visual: string;
    preview: string;
    editorControls: string;
    viewControls: string;
    layoutControls: string;
    sourceOptions: string;
    sourcePreview: string;
    search: string;
    lineNumbers: string;
    lineWrapping: string;
    syncScrolling: string;
    textWidth: string;
    focusWidth: string;
    standardWidth: string;
    fillWidth: string;
    findInFile: string;
    toggleReplace: string;
    replaceWith: string;
    replaceMatch: string;
    replaceAllMatches: string;
    selectAllMatches: string;
    matchCase: string;
    matchWholeWord: string;
    useRegularExpression: string;
    previousMatch: string;
    nextMatch: string;
    closeSearch: string;
  };
  statusBar: {
    statusFor: (title: string) => string;
    savedLocally: string;
    roomOffline: string;
    statistics: string;
    word: string;
    words: string;
    tokens: string;
    line: string;
    lines: string;
    character: string;
    characters: string;
  };
};

const workspaceChromeCopy: Record<WorkspaceLanguage, WorkspaceChromeCopy> = {
  en: {
    topChrome: {
      openWorkspaceMenu: "Open Workspace menu",
      closeWorkspaceMenu: "Close Workspace menu",
      toggleWorkspacePanel: "Toggle workspace panel",
      toggleSidePanel: "Toggle side panel",
      closeSidePanel: "Close side panel",
      collaborators: "Collaborators",
      agent: "Agent",
      active: "Active",
      idle: "Idle",
      away: "Away",
      inWorkspace: "In workspace",
      agentInWorkspace: "Agent in workspace",
      viewing: (name) => `Viewing ${name}`,
      agentViewing: (name) => `Agent viewing ${name}`,
      line: (lineNumber) => `Line ${lineNumber}`,
      inThisFile: "In this file",
      liveWith: (names) => `Live with ${names}`,
      liveAs: (name) => `Live as ${name}`,
      follow: (name) => `Follow ${name}`,
      stopFollowing: (name) => `Stop following ${name}`,
    },
    documentControls: {
      documentToolbar: "Document toolbar",
      documentControlsLabel: "Document controls",
      editingMode: "Editing mode",
      editor: "Editor",
      split: "Split",
      source: "Source",
      visual: "Write",
      preview: "Read",
      editorControls: "Editor controls",
      viewControls: "View controls",
      layoutControls: "Layout controls",
      sourceOptions: "Source options",
      sourcePreview: "Preview alongside source",
      search: "Search",
      lineNumbers: "Line Numbers",
      lineWrapping: "Line Wrapping",
      syncScrolling: "Sync Scrolling",
      textWidth: "Text Width",
      focusWidth: "Focus",
      standardWidth: "Standard",
      fillWidth: "Fill",
      findInFile: "Find in file",
      toggleReplace: "Toggle replace",
      replaceWith: "Replace with",
      replaceMatch: "Replace match",
      replaceAllMatches: "Replace all",
      selectAllMatches: "Select all matches",
      matchCase: "Match case",
      matchWholeWord: "Match whole word",
      useRegularExpression: "Use regular expression",
      previousMatch: "Previous match",
      nextMatch: "Next match",
      closeSearch: "Close search",
    },
    statusBar: {
      statusFor: (title) => `Status for ${title}`,
      savedLocally: "Saved locally",
      roomOffline: "Disconnected",
      statistics: "Document statistics",
      word: "word",
      words: "words",
      tokens: "tokens",
      line: "line",
      lines: "lines",
      character: "character",
      characters: "characters",
    },
  },
  ko: {
    topChrome: {
      openWorkspaceMenu: "작업공간 메뉴 열기",
      closeWorkspaceMenu: "작업공간 메뉴 닫기",
      toggleWorkspacePanel: "작업공간 패널 전환",
      toggleSidePanel: "사이드 패널 전환",
      closeSidePanel: "사이드 패널 닫기",
      collaborators: "협업자",
      agent: "에이전트",
      active: "활동 중",
      idle: "자리 비움",
      away: "다른 곳에 있음",
      inWorkspace: "워크스페이스에 있음",
      agentInWorkspace: "에이전트가 워크스페이스에 있음",
      viewing: (name) => `${name} 보는 중`,
      agentViewing: (name) => `에이전트가 ${name} 보는 중`,
      line: (lineNumber) => `${lineNumber}줄`,
      inThisFile: "이 파일에 있음",
      liveWith: (names) => `${names}와 협업 중`,
      liveAs: (name) => `${name}으로 접속 중`,
      follow: (name) => `${name} 따라가기`,
      stopFollowing: (name) => `${name} 따라가기 중지`,
    },
    documentControls: {
      documentToolbar: "문서 툴바",
      documentControlsLabel: "문서 컨트롤",
      editingMode: "편집 모드",
      editor: "편집기",
      split: "분할",
      source: "소스",
      visual: "쓰기",
      preview: "읽기",
      editorControls: "에디터 컨트롤",
      viewControls: "보기 컨트롤",
      layoutControls: "레이아웃 컨트롤",
      sourceOptions: "원문 옵션",
      sourcePreview: "소스 옆에서 미리보기",
      search: "검색",
      lineNumbers: "줄 번호",
      lineWrapping: "줄 바꿈",
      syncScrolling: "스크롤 동기화",
      textWidth: "텍스트 폭",
      focusWidth: "집중",
      standardWidth: "표준",
      fillWidth: "채우기",
      findInFile: "파일에서 찾기",
      toggleReplace: "바꾸기 열기",
      replaceWith: "바꿀 내용",
      replaceMatch: "현재 결과 바꾸기",
      replaceAllMatches: "모두 바꾸기",
      selectAllMatches: "모든 결과 선택",
      matchCase: "대소문자 구분",
      matchWholeWord: "단어 단위 검색",
      useRegularExpression: "정규식 사용",
      previousMatch: "이전 결과",
      nextMatch: "다음 결과",
      closeSearch: "검색 닫기",
    },
    statusBar: {
      statusFor: (title) => `${title} 상태`,
      savedLocally: "로컬 저장됨",
      roomOffline: "연결 끊김",
      statistics: "문서 통계",
      word: "단어",
      words: "단어",
      tokens: "토큰",
      line: "줄",
      lines: "줄",
      character: "글자",
      characters: "글자",
    },
  },
  ja: {
    topChrome: {
      openWorkspaceMenu: "ワークスペースメニューを開く",
      closeWorkspaceMenu: "ワークスペースメニューを閉じる",
      toggleWorkspacePanel: "ワークスペースパネルを切り替える",
      toggleSidePanel: "サイドパネルを切り替える",
      closeSidePanel: "サイドパネルを閉じる",
      collaborators: "共同編集者",
      agent: "エージェント",
      active: "アクティブ",
      idle: "アイドル",
      away: "離席中",
      inWorkspace: "ワークスペース内",
      agentInWorkspace: "エージェントがワークスペース内にいます",
      viewing: (name) => `${name} を表示中`,
      agentViewing: (name) => `エージェントが ${name} を表示中`,
      line: (lineNumber) => `${lineNumber} 行目`,
      inThisFile: "このファイル内",
      liveWith: (names) => `${names} と共同編集中`,
      liveAs: (name) => `${name} として参加中`,
      follow: (name) => `${name} をフォロー`,
      stopFollowing: (name) => `${name} のフォローを停止`,
    },
    documentControls: {
      documentToolbar: "ドキュメントツールバー",
      documentControlsLabel: "ドキュメント操作",
      editingMode: "編集モード",
      editor: "エディター",
      split: "分割",
      source: "ソース",
      visual: "書く",
      preview: "読む",
      editorControls: "エディター設定",
      viewControls: "表示設定",
      layoutControls: "レイアウト設定",
      sourceOptions: "ソース設定",
      sourcePreview: "ソースの横にプレビュー",
      search: "検索",
      lineNumbers: "行番号",
      lineWrapping: "行折り返し",
      syncScrolling: "スクロール同期",
      textWidth: "テキスト幅",
      focusWidth: "集中",
      standardWidth: "標準",
      fillWidth: "全幅",
      findInFile: "ファイル内検索",
      toggleReplace: "置換を切り替え",
      replaceWith: "置換後の文字列",
      replaceMatch: "現在の一致を置換",
      replaceAllMatches: "すべて置換",
      selectAllMatches: "すべての一致を選択",
      matchCase: "大文字小文字を区別",
      matchWholeWord: "単語単位で検索",
      useRegularExpression: "正規表現を使用",
      previousMatch: "前の一致",
      nextMatch: "次の一致",
      closeSearch: "検索を閉じる",
    },
    statusBar: {
      statusFor: (title) => `${title} の状態`,
      savedLocally: "ローカルに保存済み",
      roomOffline: "切断されました",
      statistics: "ドキュメント統計",
      word: "語",
      words: "語",
      tokens: "トークン",
      line: "行",
      lines: "行",
      character: "文字",
      characters: "文字",
    },
  },
  zh: {
    topChrome: {
      openWorkspaceMenu: "打开工作区菜单",
      closeWorkspaceMenu: "关闭工作区菜单",
      toggleWorkspacePanel: "切换工作区面板",
      toggleSidePanel: "切换侧边栏",
      closeSidePanel: "关闭侧边栏",
      collaborators: "协作者",
      agent: "代理",
      active: "活跃",
      idle: "空闲",
      away: "离开",
      inWorkspace: "在工作区中",
      agentInWorkspace: "代理在工作区中",
      viewing: (name) => `正在查看 ${name}`,
      agentViewing: (name) => `代理正在查看 ${name}`,
      line: (lineNumber) => `第 ${lineNumber} 行`,
      inThisFile: "在此文件中",
      liveWith: (names) => `正在与 ${names} 协作`,
      liveAs: (name) => `以 ${name} 加入`,
      follow: (name) => `跟随 ${name}`,
      stopFollowing: (name) => `停止跟随 ${name}`,
    },
    documentControls: {
      documentToolbar: "文档工具栏",
      documentControlsLabel: "文档控制",
      editingMode: "编辑模式",
      editor: "编辑器",
      split: "分屏",
      source: "源代码",
      visual: "写作",
      preview: "阅读",
      editorControls: "编辑器控制",
      viewControls: "视图控制",
      layoutControls: "布局控制",
      sourceOptions: "源码选项",
      sourcePreview: "在源代码旁预览",
      search: "搜索",
      lineNumbers: "行号",
      lineWrapping: "自动换行",
      syncScrolling: "同步滚动",
      textWidth: "文本宽度",
      focusWidth: "专注",
      standardWidth: "标准",
      fillWidth: "填满",
      findInFile: "在文件中查找",
      toggleReplace: "切换替换",
      replaceWith: "替换为",
      replaceMatch: "替换当前匹配",
      replaceAllMatches: "全部替换",
      selectAllMatches: "选择所有匹配项",
      matchCase: "区分大小写",
      matchWholeWord: "全词匹配",
      useRegularExpression: "使用正则表达式",
      previousMatch: "上一个匹配",
      nextMatch: "下一个匹配",
      closeSearch: "关闭搜索",
    },
    statusBar: {
      statusFor: (title) => `${title} 的状态`,
      savedLocally: "已本地保存",
      roomOffline: "已断开连接",
      statistics: "文档统计",
      word: "词",
      words: "词",
      tokens: "词元",
      line: "行",
      lines: "行",
      character: "字符",
      characters: "字符",
    },
  },
  es: {
    topChrome: {
      openWorkspaceMenu: "Abrir menú del espacio",
      closeWorkspaceMenu: "Cerrar menú del espacio",
      toggleWorkspacePanel: "Alternar panel del espacio",
      toggleSidePanel: "Alternar panel lateral",
      closeSidePanel: "Cerrar panel lateral",
      collaborators: "Colaboradores",
      agent: "Agente",
      active: "Activo",
      idle: "Inactivo",
      away: "Ausente",
      inWorkspace: "En el espacio",
      agentInWorkspace: "Agente en el espacio",
      viewing: (name) => `Viendo ${name}`,
      agentViewing: (name) => `Agente viendo ${name}`,
      line: (lineNumber) => `Línea ${lineNumber}`,
      inThisFile: "En este archivo",
      liveWith: (names) => `En vivo con ${names}`,
      liveAs: (name) => `En vivo como ${name}`,
      follow: (name) => `Seguir a ${name}`,
      stopFollowing: (name) => `Dejar de seguir a ${name}`,
    },
    documentControls: {
      documentToolbar: "Barra del documento",
      documentControlsLabel: "Controles del documento",
      editingMode: "Modo de edición",
      editor: "Editor",
      split: "Dividir",
      source: "Fuente",
      visual: "Escribir",
      preview: "Leer",
      editorControls: "Controles del editor",
      viewControls: "Controles de vista",
      layoutControls: "Controles de diseño",
      sourceOptions: "Opciones de fuente",
      sourcePreview: "Vista previa junto al código fuente",
      search: "Buscar",
      lineNumbers: "Números de línea",
      lineWrapping: "Ajuste de línea",
      syncScrolling: "Sincronizar desplazamiento",
      textWidth: "Ancho de texto",
      focusWidth: "Enfoque",
      standardWidth: "Estándar",
      fillWidth: "Llenar",
      findInFile: "Buscar en archivo",
      toggleReplace: "Alternar reemplazo",
      replaceWith: "Reemplazar con",
      replaceMatch: "Reemplazar coincidencia",
      replaceAllMatches: "Reemplazar todo",
      selectAllMatches: "Seleccionar todas las coincidencias",
      matchCase: "Coincidir mayúsculas",
      matchWholeWord: "Palabra completa",
      useRegularExpression: "Usar expresión regular",
      previousMatch: "Coincidencia anterior",
      nextMatch: "Siguiente coincidencia",
      closeSearch: "Cerrar búsqueda",
    },
    statusBar: {
      statusFor: (title) => `Estado de ${title}`,
      savedLocally: "Guardado localmente",
      roomOffline: "Desconectado",
      statistics: "Estadísticas del documento",
      word: "palabra",
      words: "palabras",
      tokens: "tokens",
      line: "línea",
      lines: "líneas",
      character: "carácter",
      characters: "caracteres",
    },
  },
  fr: {
    topChrome: {
      openWorkspaceMenu: "Ouvrir le menu de l’espace",
      closeWorkspaceMenu: "Fermer le menu de l’espace",
      toggleWorkspacePanel: "Afficher ou masquer le panneau de l’espace",
      toggleSidePanel: "Afficher ou masquer le panneau latéral",
      closeSidePanel: "Fermer le panneau latéral",
      collaborators: "Collaborateurs",
      agent: "Agent",
      active: "Actif",
      idle: "Inactif",
      away: "Absent",
      inWorkspace: "Dans l’espace",
      agentInWorkspace: "Agent dans l’espace",
      viewing: (name) => `Affiche ${name}`,
      agentViewing: (name) => `Agent sur ${name}`,
      line: (lineNumber) => `Ligne ${lineNumber}`,
      inThisFile: "Dans ce fichier",
      liveWith: (names) => `En direct avec ${names}`,
      liveAs: (name) => `En direct en tant que ${name}`,
      follow: (name) => `Suivre ${name}`,
      stopFollowing: (name) => `Ne plus suivre ${name}`,
    },
    documentControls: {
      documentToolbar: "Barre du document",
      documentControlsLabel: "Contrôles du document",
      editingMode: "Mode d’édition",
      editor: "Éditeur",
      split: "Scinder",
      source: "Source",
      visual: "Écrire",
      preview: "Lire",
      editorControls: "Contrôles de l’éditeur",
      viewControls: "Contrôles d’affichage",
      layoutControls: "Contrôles de mise en page",
      sourceOptions: "Options de la source",
      sourcePreview: "Aperçu à côté du code source",
      search: "Rechercher",
      lineNumbers: "Numéros de ligne",
      lineWrapping: "Retour à la ligne",
      syncScrolling: "Synchroniser le défilement",
      textWidth: "Largeur du texte",
      focusWidth: "Focus",
      standardWidth: "Standard",
      fillWidth: "Remplir",
      findInFile: "Rechercher dans le fichier",
      toggleReplace: "Afficher/masquer le remplacement",
      replaceWith: "Remplacer par",
      replaceMatch: "Remplacer ce résultat",
      replaceAllMatches: "Tout remplacer",
      selectAllMatches: "Sélectionner tous les résultats",
      matchCase: "Respecter la casse",
      matchWholeWord: "Mot entier",
      useRegularExpression: "Utiliser une expression régulière",
      previousMatch: "Résultat précédent",
      nextMatch: "Résultat suivant",
      closeSearch: "Fermer la recherche",
    },
    statusBar: {
      statusFor: (title) => `État de ${title}`,
      savedLocally: "Enregistré localement",
      roomOffline: "Déconnecté",
      statistics: "Statistiques du document",
      word: "mot",
      words: "mots",
      tokens: "jetons",
      line: "ligne",
      lines: "lignes",
      character: "caractère",
      characters: "caractères",
    },
  },
  de: {
    topChrome: {
      openWorkspaceMenu: "Workspace-Menü öffnen",
      closeWorkspaceMenu: "Workspace-Menü schließen",
      toggleWorkspacePanel: "Workspace-Bereich ein-/ausblenden",
      toggleSidePanel: "Seitenleiste ein-/ausblenden",
      closeSidePanel: "Seitenleiste schließen",
      collaborators: "Mitwirkende",
      agent: "Agent",
      active: "Aktiv",
      idle: "Inaktiv",
      away: "Abwesend",
      inWorkspace: "Im Workspace",
      agentInWorkspace: "Agent im Workspace",
      viewing: (name) => `Zeigt ${name} an`,
      agentViewing: (name) => `Agent zeigt ${name} an`,
      line: (lineNumber) => `Zeile ${lineNumber}`,
      inThisFile: "In dieser Datei",
      liveWith: (names) => `Live mit ${names}`,
      liveAs: (name) => `Live als ${name}`,
      follow: (name) => `${name} folgen`,
      stopFollowing: (name) => `${name} nicht mehr folgen`,
    },
    documentControls: {
      documentToolbar: "Dokument-Toolbar",
      documentControlsLabel: "Dokumentsteuerung",
      editingMode: "Bearbeitungsmodus",
      editor: "Editor",
      split: "Teilen",
      source: "Quelltext",
      visual: "Schreiben",
      preview: "Lesen",
      editorControls: "Editorsteuerung",
      viewControls: "Ansichtssteuerung",
      layoutControls: "Layoutsteuerung",
      sourceOptions: "Quelltextoptionen",
      sourcePreview: "Vorschau neben dem Quelltext",
      search: "Suchen",
      lineNumbers: "Zeilennummern",
      lineWrapping: "Zeilenumbruch",
      syncScrolling: "Scrollen synchronisieren",
      textWidth: "Textbreite",
      focusWidth: "Fokus",
      standardWidth: "Standard",
      fillWidth: "Füllen",
      findInFile: "In Datei suchen",
      toggleReplace: "Ersetzen umschalten",
      replaceWith: "Ersetzen durch",
      replaceMatch: "Treffer ersetzen",
      replaceAllMatches: "Alle ersetzen",
      selectAllMatches: "Alle Treffer auswählen",
      matchCase: "Groß-/Kleinschreibung beachten",
      matchWholeWord: "Ganzes Wort",
      useRegularExpression: "Regulären Ausdruck verwenden",
      previousMatch: "Vorheriger Treffer",
      nextMatch: "Nächster Treffer",
      closeSearch: "Suche schließen",
    },
    statusBar: {
      statusFor: (title) => `Status für ${title}`,
      savedLocally: "Lokal gespeichert",
      roomOffline: "Getrennt",
      statistics: "Dokumentstatistik",
      word: "Wort",
      words: "Wörter",
      tokens: "Tokens",
      line: "Zeile",
      lines: "Zeilen",
      character: "Zeichen",
      characters: "Zeichen",
    },
  },
};

export const getWorkspaceChromeCopy = (language: WorkspaceLanguage) =>
  workspaceChromeCopy[language];
