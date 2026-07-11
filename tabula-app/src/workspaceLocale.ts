import type { WorkspaceLanguage } from "./hooks/useWorkspacePreferences";

type WorkspaceMenuCopy = {
  actions: {
    newFile: string;
    openFile: string;
    importProject: string;
    saveFile: string;
    exportProject: string;
    liveCollaboration: string;
    preferences: string;
    about: string;
    help: string;
    followUs: string;
    github: string;
  };
  aria: {
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
    openFile: string;
    browseFiles: string;
    help: string;
  };
  share: {
    trigger: string;
    modalTitle: string;
    live: {
      title: string;
      description: string;
      startSession: string;
      startDescription: string;
      roomDocumentsAria: string;
      roomDocumentsLabel: string;
      includedCount: (included: number, total: number) => string;
      inviteAgent: string;
      inviteAgentDescription: string;
      retrySession: string;
      nameLabel: string;
      nameAria: string;
      anonymousPlaceholder: string;
      inviteLabel: string;
      invalidInviteTitle: string;
      copyLink: string;
      copied: string;
      stopSession: string;
    };
    shareable: {
      title: string;
      description: string;
      noFileReason: string;
      exportToLink: string;
      exporting: string;
      linkLabel: string;
    };
    exportPanel: {
      title: string;
      description: string;
      projectArchiveTitle: string;
      projectArchiveDescription: string;
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
    actions: {
      newFile: "New File",
      openFile: "Open File...",
      importProject: "Restore workspace backup...",
      saveFile: "Save File...",
      exportProject: "Back up workspace...",
      liveCollaboration: "Live collaboration...",
      preferences: "Preferences",
      about: "About",
      help: "Help",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
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
      tagline:
        "A local-first workspace for files that people and coding agents can share safely.",
      newFile: "New File",
      openFile: "Open File",
      browseFiles: "Browse project files",
      help: "Help",
    },
    share: {
      trigger: "Share",
      modalTitle: "Share",
      live: {
        title: "Live collaboration",
        description:
          "Create an encrypted room for real-time collaboration.",
        startSession: "Start session",
        startDescription:
          "Included documents join the room. Excluded documents stay local.",
        roomDocumentsAria: "Workspace documents included in sharing",
        roomDocumentsLabel: "Included documents",
        includedCount: (included, total) => `${included}/${total} included`,
        inviteAgent: "Copy agent prompt",
        inviteAgentDescription:
          "Copy a room-aware prompt. The room URL is included only when you click.",
        retrySession: "Retry",
        nameLabel: "Your name",
        nameAria: "Your collaboration name",
        anonymousPlaceholder: "Anonymous",
        inviteLabel: "Invite link",
        invalidInviteTitle: "This live room does not have a valid invite link.",
        copyLink: "Copy link",
        copied: "Copied",
        stopSession: "Stop session",
      },
      shareable: {
        title: "Export to link",
        description:
          "Create an encrypted point-in-time copy. Changes do not sync back.",
        noFileReason: "Open a file before exporting to link.",
        exportToLink: "Export to link",
        exporting: "Exporting link",
        linkLabel: "Export link",
      },
      exportPanel: {
        title: "Export",
        description: "Create an encrypted copy of the included documents.",
        projectArchiveTitle: "Export to file",
        projectArchiveDescription: "Export to file downloads the included documents as a .zip.",
      },
    },
  },
  ko: {
    actions: {
      newFile: "새 파일",
      openFile: "파일 열기...",
      importProject: "워크스페이스 백업 복원...",
      saveFile: "파일 저장...",
      exportProject: "워크스페이스 백업...",
      liveCollaboration: "실시간 협업...",
      preferences: "환경설정",
      about: "소개",
      help: "도움말",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
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
      tagline:
        "사람과 코딩 에이전트가 안전하게 공유할 수 있는 로컬 우선 작업공간.",
      newFile: "새 파일",
      openFile: "파일 열기",
      browseFiles: "프로젝트 파일 보기",
      help: "도움말",
    },
    share: {
      trigger: "공유",
      modalTitle: "공유",
      live: {
        title: "실시간 협업",
        description:
          "실시간 협업을 위한 암호화된 room을 만듭니다.",
        startSession: "세션 시작",
        startDescription:
          "포함된 문서만 room에 들어갑니다. 제외한 문서는 로컬에 남습니다.",
        roomDocumentsAria: "실시간 room에 포함되는 워크스페이스 문서",
        roomDocumentsLabel: "포함할 문서",
        includedCount: (included, total) => `${included}/${total}개 포함`,
        inviteAgent: "에이전트 프롬프트 복사",
        inviteAgentDescription:
          "room용 프롬프트를 복사합니다. room URL은 이 버튼을 눌렀을 때만 포함됩니다.",
        retrySession: "다시 연결",
        nameLabel: "내 이름",
        nameAria: "협업에서 표시할 이름",
        anonymousPlaceholder: "익명",
        inviteLabel: "초대 링크",
        invalidInviteTitle: "이 실시간 room에는 유효한 초대 링크가 없습니다.",
        copyLink: "링크 복사",
        copied: "복사됨",
        stopSession: "세션 중지",
      },
      shareable: {
        title: "링크로 내보내기",
        description:
          "암호화된 시점 복사본을 만듭니다. 이후 변경은 원본에 동기화되지 않습니다.",
        noFileReason: "파일을 열면 링크로 내보낼 수 있습니다.",
        exportToLink: "링크로 내보내기",
        exporting: "링크 내보내는 중",
        linkLabel: "내보내기 링크",
      },
      exportPanel: {
        title: "내보내기",
        description: "포함된 문서의 암호화된 복사본을 만듭니다.",
        projectArchiveTitle: "파일로 내보내기",
        projectArchiveDescription: "파일로 내보내기는 포함된 문서를 .zip으로 다운로드합니다.",
      },
    },
  },
  ja: {
    actions: {
      newFile: "新規ファイル",
      openFile: "ファイルを開く...",
      importProject: "ワークスペースのバックアップを復元...",
      saveFile: "ファイルを保存...",
      exportProject: "ワークスペースをバックアップ...",
      liveCollaboration: "ライブ共同編集...",
      preferences: "環境設定",
      about: "このアプリについて",
      help: "ヘルプ",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
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
      tagline:
        "人とコーディングエージェントが安全に共有できるローカルファーストのワークスペース。",
      newFile: "新規ファイル",
      openFile: "ファイルを開く",
      browseFiles: "プロジェクトファイルを見る",
      help: "ヘルプ",
    },
    share: {
      trigger: "共有",
      modalTitle: "共有",
      live: {
        title: "ライブ共同編集",
        description:
          "リアルタイム共同編集用の暗号化 room を作成します。",
        startSession: "セッションを開始",
        startDescription:
          "含めたドキュメントだけが room に参加します。除外したものはローカルに残ります。",
        roomDocumentsAria: "ライブ room に含めるワークスペースドキュメント",
        roomDocumentsLabel: "含めるドキュメント",
        includedCount: (included, total) => `${included}/${total} 件を含む`,
        inviteAgent: "エージェント用プロンプトをコピー",
        inviteAgentDescription:
          "room 用プロンプトをコピーします。room URL はこのボタンを押したときだけ含まれます。",
        retrySession: "再試行",
        nameLabel: "あなたの名前",
        nameAria: "共同編集で表示する名前",
        anonymousPlaceholder: "匿名",
        inviteLabel: "招待リンク",
        invalidInviteTitle:
          "このライブ room には有効な招待リンクがありません。",
        copyLink: "リンクをコピー",
        copied: "コピー済み",
        stopSession: "セッションを停止",
      },
      shareable: {
        title: "リンクに書き出し",
        description:
          "暗号化された時点コピーを作成します。以後の変更は元には同期されません。",
        noFileReason:
          "ファイルを開くとリンクに書き出せます。",
        exportToLink: "リンクに書き出し",
        exporting: "リンクを書き出し中",
        linkLabel: "書き出しリンク",
      },
      exportPanel: {
        title: "書き出し",
        description: "含めたドキュメントの暗号化コピーを作成します。",
        projectArchiveTitle: "ファイルに書き出し",
        projectArchiveDescription:
          "ファイルに書き出すと、含めたドキュメントを .zip としてダウンロードします。",
      },
    },
  },
  zh: {
    actions: {
      newFile: "新建文件",
      openFile: "打开文件...",
      importProject: "恢复工作区备份...",
      saveFile: "保存文件...",
      exportProject: "备份工作区...",
      liveCollaboration: "实时协作...",
      preferences: "偏好设置",
      about: "关于",
      help: "帮助",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
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
      tagline: "让人与编码智能体安全共享文件的本地优先工作区。",
      newFile: "新建文件",
      openFile: "打开文件",
      browseFiles: "浏览项目文件",
      help: "帮助",
    },
    share: {
      trigger: "分享",
      modalTitle: "分享",
      live: {
        title: "实时协作",
        description: "创建用于实时协作的加密 room。",
        startSession: "启动协作",
        startDescription: "只有包含的文档会进入 room。排除的文档保留在本地。",
        roomDocumentsAria: "实时 room 中包含的工作区文档",
        roomDocumentsLabel: "包含的文档",
        includedCount: (included, total) => `已包含 ${included}/${total}`,
        inviteAgent: "复制智能体提示",
        inviteAgentDescription:
          "复制面向 room 的提示。只有点击此按钮时才会包含 room URL。",
        retrySession: "重试",
        nameLabel: "你的名字",
        nameAria: "协作显示名称",
        anonymousPlaceholder: "匿名",
        inviteLabel: "邀请链接",
        invalidInviteTitle: "此实时 room 没有有效的邀请链接。",
        copyLink: "复制链接",
        copied: "已复制",
        stopSession: "停止协作",
      },
      shareable: {
        title: "导出为链接",
        description: "创建加密的时间点副本。之后的更改不会同步回原工作区。",
        noFileReason: "打开文件后即可导出为链接。",
        exportToLink: "导出为链接",
        exporting: "正在导出链接",
        linkLabel: "导出链接",
      },
      exportPanel: {
        title: "导出",
        description: "创建已包含文档的加密副本。",
        projectArchiveTitle: "导出为文件",
        projectArchiveDescription: "导出为文件会将已包含的文档下载为 .zip。",
      },
    },
  },
  es: {
    actions: {
      newFile: "Nuevo archivo",
      openFile: "Abrir archivo...",
      importProject: "Restaurar copia del espacio...",
      saveFile: "Guardar archivo...",
      exportProject: "Crear copia del espacio...",
      liveCollaboration: "Colaboración en vivo...",
      preferences: "Preferencias",
      about: "Acerca de",
      help: "Ayuda",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
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
      tagline:
        "Un espacio local-first para compartir archivos con personas y agentes de código.",
      newFile: "Nuevo archivo",
      openFile: "Abrir archivo",
      browseFiles: "Ver archivos del proyecto",
      help: "Ayuda",
    },
    share: {
      trigger: "Compartir",
      modalTitle: "Compartir",
      live: {
        title: "Colaboración en vivo",
        description:
          "Crea una sala cifrada para colaboración en tiempo real.",
        startSession: "Iniciar colaboración",
        startDescription:
          "Los documentos incluidos entran en la sala. Los excluidos quedan locales.",
        roomDocumentsAria: "Documentos del workspace incluidos en la sala en vivo",
        roomDocumentsLabel: "Documentos incluidos",
        includedCount: (included, total) => `${included}/${total} incluidos`,
        inviteAgent: "Copiar prompt de agente",
        inviteAgentDescription:
          "Copia un prompt para la sala. La URL de la sala solo se incluye al hacer clic.",
        retrySession: "Reintentar",
        nameLabel: "Tu nombre",
        nameAria: "Tu nombre de colaboración",
        anonymousPlaceholder: "Anónimo",
        inviteLabel: "Enlace de invitación",
        invalidInviteTitle:
          "Esta sala en vivo no tiene un enlace de invitación válido.",
        copyLink: "Copiar enlace",
        copied: "Copiado",
        stopSession: "Detener colaboración",
      },
      shareable: {
        title: "Exportar a enlace",
        description:
          "Crea una copia cifrada en un momento dado. Los cambios no se sincronizan con el original.",
        noFileReason:
          "Abre un archivo antes de exportar a enlace.",
        exportToLink: "Exportar a enlace",
        exporting: "Exportando enlace",
        linkLabel: "Enlace de exportación",
      },
      exportPanel: {
        title: "Exportar",
        description: "Crea una copia cifrada de los documentos incluidos.",
        projectArchiveTitle: "Exportar a archivo",
        projectArchiveDescription: "Exportar a archivo descarga los documentos incluidos como .zip.",
      },
    },
  },
  fr: {
    actions: {
      newFile: "Nouveau fichier",
      openFile: "Ouvrir un fichier...",
      importProject: "Restaurer une sauvegarde...",
      saveFile: "Enregistrer le fichier...",
      exportProject: "Sauvegarder l’espace...",
      liveCollaboration: "Collaboration en direct...",
      preferences: "Préférences",
      about: "À propos",
      help: "Aide",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
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
      tagline:
        "Un espace local-first pour partager des fichiers avec des personnes et des agents de code.",
      newFile: "Nouveau fichier",
      openFile: "Ouvrir un fichier",
      browseFiles: "Parcourir les fichiers",
      help: "Aide",
    },
    share: {
      trigger: "Partager",
      modalTitle: "Partager",
      live: {
        title: "Collaboration en direct",
        description:
          "Créez une room chiffrée pour collaborer en temps réel.",
        startSession: "Démarrer la session",
        startDescription:
          "Les documents inclus rejoignent la room. Les documents exclus restent locaux.",
        roomDocumentsAria: "Documents du workspace inclus dans la room en direct",
        roomDocumentsLabel: "Documents inclus",
        includedCount: (included, total) => `${included}/${total} inclus`,
        inviteAgent: "Copier le prompt agent",
        inviteAgentDescription:
          "Copie un prompt pour la room. L'URL de la room est ajoutée seulement au clic.",
        retrySession: "Réessayer",
        nameLabel: "Votre nom",
        nameAria: "Votre nom de collaboration",
        anonymousPlaceholder: "Anonyme",
        inviteLabel: "Lien d'invitation",
        invalidInviteTitle:
          "Cette room en direct n'a pas de lien d'invitation valide.",
        copyLink: "Copier le lien",
        copied: "Copié",
        stopSession: "Arrêter la session",
      },
      shareable: {
        title: "Exporter vers un lien",
        description:
          "Créez une copie chiffrée à un instant donné. Les modifications ne sont pas resynchronisées.",
        noFileReason:
          "Ouvrez un fichier avant d'exporter vers un lien.",
        exportToLink: "Exporter vers un lien",
        exporting: "Export du lien",
        linkLabel: "Lien d'export",
      },
      exportPanel: {
        title: "Exporter",
        description: "Créez une copie chiffrée des documents inclus.",
        projectArchiveTitle: "Exporter vers un fichier",
        projectArchiveDescription: "Exporter vers un fichier télécharge les documents inclus en .zip.",
      },
    },
  },
  de: {
    actions: {
      newFile: "Neue Datei",
      openFile: "Datei öffnen...",
      importProject: "Workspace-Sicherung wiederherstellen...",
      saveFile: "Datei speichern...",
      exportProject: "Workspace sichern...",
      liveCollaboration: "Live-Zusammenarbeit...",
      preferences: "Einstellungen",
      about: "Info",
      help: "Hilfe",
      followUs: "Follow us",
      github: "GitHub",
    },
    aria: {
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
      tagline:
        "Ein local-first Workspace zum sicheren Teilen von Dateien mit Menschen und Coding-Agenten.",
      newFile: "Neue Datei",
      openFile: "Datei öffnen",
      browseFiles: "Projektdateien ansehen",
      help: "Hilfe",
    },
    share: {
      trigger: "Teilen",
      modalTitle: "Teilen",
      live: {
        title: "Live-Zusammenarbeit",
        description:
          "Erstelle einen verschlüsselten Room für Zusammenarbeit in Echtzeit.",
        startSession: "Sitzung starten",
        startDescription:
          "Eingeschlossene Dokumente treten dem Room bei. Ausgeschlossene bleiben lokal.",
        roomDocumentsAria: "Workspace-Dokumente im Live-Room",
        roomDocumentsLabel: "Eingeschlossene Dokumente",
        includedCount: (included, total) => `${included}/${total} enthalten`,
        inviteAgent: "Agent-Prompt kopieren",
        inviteAgentDescription:
          "Kopiert einen Room-Prompt. Die Room-URL wird nur beim Klick eingefügt.",
        retrySession: "Erneut versuchen",
        nameLabel: "Dein Name",
        nameAria: "Dein Name für die Zusammenarbeit",
        anonymousPlaceholder: "Anonym",
        inviteLabel: "Einladungslink",
        invalidInviteTitle:
          "Dieser Live-Room hat keinen gültigen Einladungslink.",
        copyLink: "Link kopieren",
        copied: "Kopiert",
        stopSession: "Sitzung beenden",
      },
      shareable: {
        title: "Als Link exportieren",
        description:
          "Erstelle eine verschlüsselte Momentaufnahme. Änderungen werden nicht zurücksynchronisiert.",
        noFileReason:
          "Öffne eine Datei, bevor du als Link exportierst.",
        exportToLink: "Als Link exportieren",
        exporting: "Link wird exportiert",
        linkLabel: "Exportlink",
      },
      exportPanel: {
        title: "Exportieren",
        description: "Erstelle eine verschlüsselte Kopie der enthaltenen Dokumente.",
        projectArchiveTitle: "Als Datei exportieren",
        projectArchiveDescription: "Als Datei exportieren lädt die enthaltenen Dokumente als .zip herunter.",
      },
    },
  },
};

export const getWorkspaceMenuCopy = (language: WorkspaceLanguage) =>
  workspaceMenuCopy[language];

export type WorkspaceChromeCopy = {
  common: {
    or: string;
    closeShareDialog: string;
  };
  topChrome: {
    openWorkspaceMenu: string;
    closeWorkspaceMenu: string;
    openProjectContext: string;
    closeProjectContext: string;
    collaborators: string;
    liveWith: (names: string) => string;
    liveAs: (name: string) => string;
  };
  documentControls: {
    documentToolbar: string;
    documentControlsLabel: string;
    split: string;
    edit: string;
    preview: string;
    copyFile: string;
    copyCurrentFile: string;
    nothingToCopy: string;
    editorControls: string;
    viewControls: string;
    layoutControls: string;
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
    savedLocally: string;
    roomOffline: string;
    word: string;
    words: string;
    comment: string;
    comments: string;
    line: string;
    lines: string;
    character: string;
    characters: string;
  };
};

const workspaceChromeCopy: Record<WorkspaceLanguage, WorkspaceChromeCopy> = {
  en: {
    common: { or: "Or", closeShareDialog: "Close share dialog" },
    topChrome: {
      openWorkspaceMenu: "Open Workspace menu",
      closeWorkspaceMenu: "Close Workspace menu",
      openProjectContext: "Open Project Context",
      closeProjectContext: "Close Project Context",
      collaborators: "Collaborators",
      liveWith: (names) => `Live with ${names}`,
      liveAs: (name) => `Live as ${name}`,
    },
    documentControls: {
      documentToolbar: "Document toolbar",
      documentControlsLabel: "Document controls",
      split: "Split",
      edit: "Edit",
      preview: "Preview",
      copyFile: "Copy File",
      copyCurrentFile: "Copy current file",
      nothingToCopy: "Add content to copy",
      editorControls: "Editor controls",
      viewControls: "View controls",
      layoutControls: "Layout controls",
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
      savedLocally: "Saved locally",
      roomOffline: "Disconnected",
      word: "word",
      words: "words",
      comment: "comment",
      comments: "comments",
      line: "line",
      lines: "lines",
      character: "character",
      characters: "characters",
    },
  },
  ko: {
    common: { or: "또는", closeShareDialog: "공유 창 닫기" },
    topChrome: {
      openWorkspaceMenu: "작업공간 메뉴 열기",
      closeWorkspaceMenu: "작업공간 메뉴 닫기",
      openProjectContext: "프로젝트 컨텍스트 열기",
      closeProjectContext: "프로젝트 컨텍스트 닫기",
      collaborators: "협업자",
      liveWith: (names) => `${names}와 협업 중`,
      liveAs: (name) => `${name}으로 접속 중`,
    },
    documentControls: {
      documentToolbar: "문서 툴바",
      documentControlsLabel: "문서 컨트롤",
      split: "분할",
      edit: "편집",
      preview: "미리보기",
      copyFile: "파일 복사",
      copyCurrentFile: "현재 파일 복사",
      nothingToCopy: "복사할 내용을 입력하세요",
      editorControls: "에디터 컨트롤",
      viewControls: "보기 컨트롤",
      layoutControls: "레이아웃 컨트롤",
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
      savedLocally: "로컬 저장됨",
      roomOffline: "연결 끊김",
      word: "단어",
      words: "단어",
      comment: "댓글",
      comments: "댓글",
      line: "줄",
      lines: "줄",
      character: "글자",
      characters: "글자",
    },
  },
  ja: {
    common: { or: "または", closeShareDialog: "共有ダイアログを閉じる" },
    topChrome: {
      openWorkspaceMenu: "ワークスペースメニューを開く",
      closeWorkspaceMenu: "ワークスペースメニューを閉じる",
      openProjectContext: "プロジェクトコンテキストを開く",
      closeProjectContext: "プロジェクトコンテキストを閉じる",
      collaborators: "共同編集者",
      liveWith: (names) => `${names} と共同編集中`,
      liveAs: (name) => `${name} として参加中`,
    },
    documentControls: {
      documentToolbar: "ドキュメントツールバー",
      documentControlsLabel: "ドキュメント操作",
      split: "分割",
      edit: "編集",
      preview: "プレビュー",
      copyFile: "ファイルをコピー",
      copyCurrentFile: "現在のファイルをコピー",
      nothingToCopy: "コピーする内容を入力してください",
      editorControls: "エディター設定",
      viewControls: "表示設定",
      layoutControls: "レイアウト設定",
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
      savedLocally: "ローカルに保存済み",
      roomOffline: "切断されました",
      word: "語",
      words: "語",
      comment: "コメント",
      comments: "コメント",
      line: "行",
      lines: "行",
      character: "文字",
      characters: "文字",
    },
  },
  zh: {
    common: { or: "或", closeShareDialog: "关闭分享对话框" },
    topChrome: {
      openWorkspaceMenu: "打开工作区菜单",
      closeWorkspaceMenu: "关闭工作区菜单",
      openProjectContext: "打开项目上下文",
      closeProjectContext: "关闭项目上下文",
      collaborators: "协作者",
      liveWith: (names) => `正在与 ${names} 协作`,
      liveAs: (name) => `以 ${name} 加入`,
    },
    documentControls: {
      documentToolbar: "文档工具栏",
      documentControlsLabel: "文档控制",
      split: "分屏",
      edit: "编辑",
      preview: "预览",
      copyFile: "复制文件",
      copyCurrentFile: "复制当前文件",
      nothingToCopy: "请输入可复制的内容",
      editorControls: "编辑器控制",
      viewControls: "视图控制",
      layoutControls: "布局控制",
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
      savedLocally: "已本地保存",
      roomOffline: "已断开连接",
      word: "词",
      words: "词",
      comment: "评论",
      comments: "评论",
      line: "行",
      lines: "行",
      character: "字符",
      characters: "字符",
    },
  },
  es: {
    common: { or: "O", closeShareDialog: "Cerrar diálogo de compartir" },
    topChrome: {
      openWorkspaceMenu: "Abrir menú del espacio",
      closeWorkspaceMenu: "Cerrar menú del espacio",
      openProjectContext: "Abrir contexto del proyecto",
      closeProjectContext: "Cerrar contexto del proyecto",
      collaborators: "Colaboradores",
      liveWith: (names) => `En vivo con ${names}`,
      liveAs: (name) => `En vivo como ${name}`,
    },
    documentControls: {
      documentToolbar: "Barra del documento",
      documentControlsLabel: "Controles del documento",
      split: "Dividir",
      edit: "Editar",
      preview: "Vista previa",
      copyFile: "Copiar archivo",
      copyCurrentFile: "Copiar archivo actual",
      nothingToCopy: "Agrega contenido para copiar",
      editorControls: "Controles del editor",
      viewControls: "Controles de vista",
      layoutControls: "Controles de diseño",
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
      savedLocally: "Guardado localmente",
      roomOffline: "Desconectado",
      word: "palabra",
      words: "palabras",
      comment: "comentario",
      comments: "comentarios",
      line: "línea",
      lines: "líneas",
      character: "carácter",
      characters: "caracteres",
    },
  },
  fr: {
    common: { or: "Ou", closeShareDialog: "Fermer la fenêtre de partage" },
    topChrome: {
      openWorkspaceMenu: "Ouvrir le menu de l’espace",
      closeWorkspaceMenu: "Fermer le menu de l’espace",
      openProjectContext: "Ouvrir le contexte du projet",
      closeProjectContext: "Fermer le contexte du projet",
      collaborators: "Collaborateurs",
      liveWith: (names) => `En direct avec ${names}`,
      liveAs: (name) => `En direct en tant que ${name}`,
    },
    documentControls: {
      documentToolbar: "Barre du document",
      documentControlsLabel: "Contrôles du document",
      split: "Scinder",
      edit: "Modifier",
      preview: "Aperçu",
      copyFile: "Copier le fichier",
      copyCurrentFile: "Copier le fichier actuel",
      nothingToCopy: "Ajoutez du contenu à copier",
      editorControls: "Contrôles de l’éditeur",
      viewControls: "Contrôles d’affichage",
      layoutControls: "Contrôles de mise en page",
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
      savedLocally: "Enregistré localement",
      roomOffline: "Déconnecté",
      word: "mot",
      words: "mots",
      comment: "commentaire",
      comments: "commentaires",
      line: "ligne",
      lines: "lignes",
      character: "caractère",
      characters: "caractères",
    },
  },
  de: {
    common: { or: "Oder", closeShareDialog: "Teilen-Dialog schließen" },
    topChrome: {
      openWorkspaceMenu: "Workspace-Menü öffnen",
      closeWorkspaceMenu: "Workspace-Menü schließen",
      openProjectContext: "Projektkontext öffnen",
      closeProjectContext: "Projektkontext schließen",
      collaborators: "Mitwirkende",
      liveWith: (names) => `Live mit ${names}`,
      liveAs: (name) => `Live als ${name}`,
    },
    documentControls: {
      documentToolbar: "Dokument-Toolbar",
      documentControlsLabel: "Dokumentsteuerung",
      split: "Teilen",
      edit: "Bearbeiten",
      preview: "Vorschau",
      copyFile: "Datei kopieren",
      copyCurrentFile: "Aktuelle Datei kopieren",
      nothingToCopy: "Inhalt zum Kopieren hinzufügen",
      editorControls: "Editorsteuerung",
      viewControls: "Ansichtssteuerung",
      layoutControls: "Layoutsteuerung",
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
      savedLocally: "Lokal gespeichert",
      roomOffline: "Getrennt",
      word: "Wort",
      words: "Wörter",
      comment: "Kommentar",
      comments: "Kommentare",
      line: "Zeile",
      lines: "Zeilen",
      character: "Zeichen",
      characters: "Zeichen",
    },
  },
};

export const getWorkspaceChromeCopy = (language: WorkspaceLanguage) =>
  workspaceChromeCopy[language];
