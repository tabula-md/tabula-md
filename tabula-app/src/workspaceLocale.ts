import type { WorkspaceLanguage } from "./hooks/useWorkspacePreferences";

type WorkspaceMenuCopy = {
  actions: {
    newFile: string;
    importFile: string;
    importWorkspace: string;
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
    openFile: string;
    openWorkspace: string;
    browseFiles: string;
    help: string;
  };
  clearWorkspace: {
    title: string;
    description: string;
    cancel: string;
    confirm: string;
    cleared: string;
  };
  share: {
    trigger: string;
    modalTitle: string;
    loadError: string;
    live: {
      title: string;
      description: string;
      startSession: string;
      startDescription: string;
      securityDescription: string;
      temporarySessionDescription: string;
      inviteAgent: string;
      inviteAgentDescription: string;
      retrySession: string;
      unavailable: string;
      reconnectingTitle: string;
      reconnectingDescription: string;
      disconnectedTitle: string;
      disconnectedDescription: string;
      nameLabel: string;
      nameAria: string;
      anonymousPlaceholder: string;
      inviteLabel: string;
      invalidInviteTitle: string;
      copyLink: string;
      copied: string;
      stopSession: string;
      stopDescription: string;
      stopConfirmTitle: string;
      stopConfirmDescription: string;
      cancelStop: string;
      confirmStop: string;
    };
    shareable: {
      title: string;
      description: string;
      noFileReason: string;
      exportToLink: string;
      preparing: string;
      linkLabel: string;
      securityDescription: string;
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
    actions: {
      newFile: "New document",
      importFile: "Import document (.md)…",
      importWorkspace: "Import workspace…",
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
      tagline:
        "A local-first workspace for files that people and agents can share safely.",
      newFile: "New document",
      openFile: "Open Markdown file",
      openWorkspace: "Open workspace",
      browseFiles: "Browse project files",
      help: "Help",
    },
    clearWorkspace: {
      title: "Clear local workspace?",
      description: "Delete all local documents, folders, and comments. This cannot be undone.",
      cancel: "Cancel",
      confirm: "Clear workspace",
      cleared: "Local workspace cleared.",
    },
    share: {
      trigger: "Share",
      modalTitle: "Share",
      loadError: "Couldn’t open sharing.",
      live: {
        title: "Live collaboration",
        description:
          "Create an encrypted room for real-time collaboration.",
        startSession: "Start session",
        startDescription: "The whole workspace joins the encrypted room.",
        securityDescription:
          "End-to-end encrypted. Tabula relays encrypted updates and cannot read your documents or comments.",
        temporarySessionDescription:
          "Temporary session. Keep at least one participant connected.",
        inviteAgent: "Invite an agent",
        inviteAgentDescription:
          "Connect Tabula MCP, choose a task, and hand off this live workspace.",
        retrySession: "Retry",
        unavailable: "Live collaboration isn’t available right now.",
        reconnectingTitle: "Reconnecting to live room",
        reconnectingDescription: "Changes stay local until the room reconnects.",
        disconnectedTitle: "Live room disconnected",
        disconnectedDescription: "Reconnect before inviting people or agents.",
        nameLabel: "Your name",
        nameAria: "Your collaboration name",
        anonymousPlaceholder: "Anonymous",
        inviteLabel: "Invite link",
        invalidInviteTitle: "This live room does not have a valid invite link.",
        copyLink: "Copy link",
        copied: "Copied",
        stopSession: "Stop session",
        stopDescription:
          "Stopping disconnects only this browser. Other participants can continue in the room.",
        stopConfirmTitle: "Stop live collaboration?",
        stopConfirmDescription:
          "This browser will leave the room. The shared workspace will replace the local workspace currently saved on this device. Other participants can continue working in the room.",
        cancelStop: "Cancel",
        confirmStop: "Stop session",
      },
      shareable: {
        title: "Export link",
        description:
          "Create an encrypted point-in-time copy. Changes do not sync back.",
        noFileReason: "Open a file before exporting to link.",
        exportToLink: "Export to link",
        preparing: "Preparing encrypted link…",
        linkLabel: "Export link",
        securityDescription:
          "Encrypted in this browser before upload. The server stores only the encrypted copy; the decryption key stays in the link.",
        unavailable: "Export to link isn’t available right now.",
        copied: "Export link copied.",
        failed: "Couldn’t export to link.",
      },
    },
  },
  ko: {
    actions: {
      newFile: "새 문서",
      importFile: "문서 가져오기 (.md)…",
      importWorkspace: "워크스페이스 가져오기…",
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
      tagline:
        "사람과 에이전트가 안전하게 공유할 수 있는 로컬 우선 작업공간.",
      newFile: "새 문서",
      openFile: "Markdown 파일 열기",
      openWorkspace: "워크스페이스 열기",
      browseFiles: "프로젝트 파일 보기",
      help: "도움말",
    },
    clearWorkspace: {
      title: "로컬 워크스페이스를 비울까요?",
      description: "이 기기의 모든 문서, 폴더, 댓글을 삭제합니다. 이 작업은 되돌릴 수 없습니다.",
      cancel: "취소",
      confirm: "워크스페이스 비우기",
      cleared: "로컬 워크스페이스를 비웠습니다.",
    },
    share: {
      trigger: "공유",
      modalTitle: "공유",
      loadError: "공유를 열지 못했습니다.",
      live: {
        title: "실시간 협업",
        description:
          "실시간 협업을 위한 암호화된 room을 만듭니다.",
        startSession: "세션 시작",
        startDescription: "워크스페이스 전체가 암호화된 room에 들어갑니다.",
        securityDescription:
          "종단간 암호화됩니다. Tabula는 암호화된 변경만 전달하며 문서나 댓글을 읽을 수 없습니다.",
        temporarySessionDescription:
          "임시 세션입니다. 최소 한 명의 참여자가 연결된 상태를 유지하세요.",
        inviteAgent: "에이전트 초대",
        inviteAgentDescription:
          "Tabula MCP를 연결하고 작업을 정해 이 실시간 워크스페이스를 전달합니다.",
        retrySession: "다시 연결",
        unavailable: "지금은 실시간 협업을 사용할 수 없습니다.",
        reconnectingTitle: "실시간 room에 다시 연결하는 중",
        reconnectingDescription: "다시 연결될 때까지 변경 내용은 이 기기에 유지됩니다.",
        disconnectedTitle: "실시간 room 연결이 끊어졌습니다",
        disconnectedDescription: "사람이나 에이전트를 초대하기 전에 다시 연결하세요.",
        nameLabel: "내 이름",
        nameAria: "협업에서 표시할 이름",
        anonymousPlaceholder: "익명",
        inviteLabel: "초대 링크",
        invalidInviteTitle: "이 실시간 room에는 유효한 초대 링크가 없습니다.",
        copyLink: "링크 복사",
        copied: "복사됨",
        stopSession: "세션 중지",
        stopDescription:
          "중지하면 이 브라우저만 room에서 나갑니다. 다른 참여자는 계속 협업할 수 있습니다.",
        stopConfirmTitle: "실시간 협업을 중지할까요?",
        stopConfirmDescription:
          "이 브라우저가 room에서 나갑니다. 공유 워크스페이스가 이 기기에 저장된 기존 로컬 워크스페이스를 대신하며, 다른 참여자는 room에서 계속 작업할 수 있습니다.",
        cancelStop: "취소",
        confirmStop: "세션 중지",
      },
      shareable: {
        title: "내보내기 링크",
        description:
          "암호화된 시점 복사본을 만듭니다. 이후 변경은 원본에 동기화되지 않습니다.",
        noFileReason: "파일을 열면 링크로 내보낼 수 있습니다.",
        exportToLink: "링크로 내보내기",
        preparing: "암호화된 링크 준비 중…",
        linkLabel: "내보내기 링크",
        securityDescription:
          "업로드 전에 이 브라우저에서 암호화됩니다. 서버에는 암호화된 복사본만 저장되며 복호화 키는 링크에만 남습니다.",
        unavailable: "지금은 링크로 내보낼 수 없습니다.",
        copied: "내보내기 링크를 복사했습니다.",
        failed: "링크로 내보내지 못했습니다.",
      },
    },
  },
  ja: {
    actions: {
      newFile: "新規ドキュメント",
      importFile: "ドキュメントを読み込む (.md)…",
      importWorkspace: "ワークスペースを読み込む…",
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
      tagline:
        "人とエージェントが安全に共有できるローカルファーストのワークスペース。",
      newFile: "新規ドキュメント",
      openFile: "Markdownファイルを開く",
      openWorkspace: "ワークスペースを開く",
      browseFiles: "プロジェクトファイルを見る",
      help: "ヘルプ",
    },
    clearWorkspace: {
      title: "ローカルワークスペースを消去しますか？",
      description: "この端末のすべてのドキュメント、フォルダー、コメントを削除します。この操作は元に戻せません。",
      cancel: "キャンセル",
      confirm: "ワークスペースを消去",
      cleared: "ローカルワークスペースを消去しました。",
    },
    share: {
      trigger: "共有",
      modalTitle: "共有",
      loadError: "共有を開けませんでした。",
      live: {
        title: "ライブ共同編集",
        description:
          "リアルタイム共同編集用の暗号化 room を作成します。",
        startSession: "セッションを開始",
        startDescription: "ワークスペース全体が暗号化 room に参加します。",
        securityDescription:
          "エンドツーエンドで暗号化されます。Tabula は暗号化された更新を中継するだけで、文書やコメントを読むことはできません。",
        temporarySessionDescription:
          "一時セッションです。少なくとも1人は接続したままにしてください。",
        inviteAgent: "エージェントを招待",
        inviteAgentDescription:
          "Tabula MCP を接続し、タスクを選んでこのライブワークスペースを引き継ぎます。",
        retrySession: "再試行",
        unavailable: "現在、ライブ共同編集は利用できません。",
        reconnectingTitle: "ライブ共同編集ルームに再接続中",
        reconnectingDescription: "再接続するまで変更はこの端末に保持されます。",
        disconnectedTitle: "ライブ共同編集ルームから切断されました",
        disconnectedDescription: "人やエージェントを招待する前に再接続してください。",
        nameLabel: "あなたの名前",
        nameAria: "共同編集で表示する名前",
        anonymousPlaceholder: "匿名",
        inviteLabel: "招待リンク",
        invalidInviteTitle:
          "このライブ room には有効な招待リンクがありません。",
        copyLink: "リンクをコピー",
        copied: "コピー済み",
        stopSession: "セッションを停止",
        stopDescription:
          "停止すると、このブラウザだけが room から退出します。他の参加者はそのまま共同編集を続けられます。",
        stopConfirmTitle: "ライブ共同編集を停止しますか？",
        stopConfirmDescription:
          "このブラウザは room から退出します。共有ワークスペースはこの端末に保存されたローカルワークスペースを置き換え、他の参加者は room で作業を続けられます。",
        cancelStop: "キャンセル",
        confirmStop: "セッションを停止",
      },
      shareable: {
        title: "書き出しリンク",
        description:
          "暗号化された時点コピーを作成します。以後の変更は元には同期されません。",
        noFileReason:
          "ファイルを開くとリンクに書き出せます。",
        exportToLink: "リンクに書き出し",
        preparing: "暗号化リンクを準備中…",
        linkLabel: "書き出しリンク",
        securityDescription:
          "アップロード前にこのブラウザで暗号化されます。サーバーには暗号化されたコピーだけが保存され、復号キーはリンク内に残ります。",
        unavailable: "現在、リンクへの書き出しは利用できません。",
        copied: "書き出しリンクをコピーしました。",
        failed: "リンクに書き出せませんでした。",
      },
    },
  },
  zh: {
    actions: {
      newFile: "新建文档",
      importFile: "导入文档 (.md)…",
      importWorkspace: "导入工作区…",
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
      tagline: "让人与编码智能体安全共享文件的本地优先工作区。",
      newFile: "新建文档",
      openFile: "打开 Markdown 文件",
      openWorkspace: "打开工作区",
      browseFiles: "浏览项目文件",
      help: "帮助",
    },
    clearWorkspace: {
      title: "清空本地工作区？",
      description: "删除此设备上的所有文档、文件夹和评论。此操作无法撤销。",
      cancel: "取消",
      confirm: "清空工作区",
      cleared: "本地工作区已清空。",
    },
    share: {
      trigger: "分享",
      modalTitle: "分享",
      loadError: "无法打开分享。",
      live: {
        title: "实时协作",
        description: "创建用于实时协作的加密 room。",
        startSession: "启动协作",
        startDescription: "整个工作区会加入加密 room。",
        securityDescription:
          "采用端到端加密。Tabula 只中继加密更新，无法读取你的文档或评论。",
        temporarySessionDescription:
          "这是临时会话。请确保至少一名参与者保持连接。",
        inviteAgent: "邀请智能体",
        inviteAgentDescription:
          "连接 Tabula MCP，选择任务，并交接此实时工作区。",
        retrySession: "重试",
        unavailable: "实时协作目前不可用。",
        reconnectingTitle: "正在重新连接实时协作房间",
        reconnectingDescription: "重新连接前，更改会保留在此设备上。",
        disconnectedTitle: "实时协作房间已断开连接",
        disconnectedDescription: "邀请用户或代理前请先重新连接。",
        nameLabel: "你的名字",
        nameAria: "协作显示名称",
        anonymousPlaceholder: "匿名",
        inviteLabel: "邀请链接",
        invalidInviteTitle: "此实时 room 没有有效的邀请链接。",
        copyLink: "复制链接",
        copied: "已复制",
        stopSession: "停止协作",
        stopDescription:
          "停止后仅此浏览器会离开 room，其他参与者仍可继续协作。",
        stopConfirmTitle: "停止实时协作？",
        stopConfirmDescription:
          "此浏览器将离开 room。共享工作区会替换此设备上当前保存的本地工作区，其他参与者仍可在 room 中继续工作。",
        cancelStop: "取消",
        confirmStop: "停止协作",
      },
      shareable: {
        title: "导出链接",
        description: "创建加密的时间点副本。之后的更改不会同步回原工作区。",
        noFileReason: "打开文件后即可导出为链接。",
        exportToLink: "导出为链接",
        preparing: "正在准备加密链接…",
        linkLabel: "导出链接",
        securityDescription:
          "上传前会在此浏览器中加密。服务器只保存加密副本，解密密钥仅保留在链接中。",
        unavailable: "目前无法导出为链接。",
        copied: "已复制导出链接。",
        failed: "无法导出为链接。",
      },
    },
  },
  es: {
    actions: {
      newFile: "Nuevo documento",
      importFile: "Importar documento (.md)…",
      importWorkspace: "Importar espacio de trabajo…",
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
      tagline:
        "Un espacio local-first para compartir archivos con personas y agentes.",
      newFile: "Nuevo documento",
      openFile: "Abrir archivo Markdown",
      openWorkspace: "Abrir espacio de trabajo",
      browseFiles: "Ver archivos del proyecto",
      help: "Ayuda",
    },
    clearWorkspace: {
      title: "¿Vaciar el espacio local?",
      description: "Elimina todos los documentos, carpetas y comentarios locales. Esta acción no se puede deshacer.",
      cancel: "Cancelar",
      confirm: "Vaciar espacio",
      cleared: "Espacio local vaciado.",
    },
    share: {
      trigger: "Compartir",
      modalTitle: "Compartir",
      loadError: "No se pudo abrir Compartir.",
      live: {
        title: "Colaboración en vivo",
        description:
          "Crea una sala cifrada para colaboración en tiempo real.",
        startSession: "Iniciar colaboración",
        startDescription: "Todo el workspace entra en la sala cifrada.",
        securityDescription:
          "Cifrado de extremo a extremo. Tabula solo retransmite cambios cifrados y no puede leer tus documentos ni comentarios.",
        temporarySessionDescription:
          "Sesión temporal. Mantén al menos un participante conectado.",
        inviteAgent: "Invitar a un agente",
        inviteAgentDescription:
          "Conecta Tabula MCP, elige una tarea y entrega este espacio de trabajo en vivo.",
        retrySession: "Reintentar",
        unavailable: "La colaboración en vivo no está disponible ahora.",
        reconnectingTitle: "Reconectando a la sala en vivo",
        reconnectingDescription: "Los cambios permanecen en este dispositivo hasta reconectar.",
        disconnectedTitle: "Sala en vivo desconectada",
        disconnectedDescription: "Vuelve a conectar antes de invitar a personas o agentes.",
        nameLabel: "Tu nombre",
        nameAria: "Tu nombre de colaboración",
        anonymousPlaceholder: "Anónimo",
        inviteLabel: "Enlace de invitación",
        invalidInviteTitle:
          "Esta sala en vivo no tiene un enlace de invitación válido.",
        copyLink: "Copiar enlace",
        copied: "Copiado",
        stopSession: "Detener colaboración",
        stopDescription:
          "Al detenerla, solo este navegador sale de la sala. Los demás participantes pueden continuar.",
        stopConfirmTitle: "¿Detener la colaboración en vivo?",
        stopConfirmDescription:
          "Este navegador saldrá de la sala. El workspace compartido reemplazará el workspace local guardado en este dispositivo y los demás participantes podrán seguir trabajando en la sala.",
        cancelStop: "Cancelar",
        confirmStop: "Detener colaboración",
      },
      shareable: {
        title: "Enlace de exportación",
        description:
          "Crea una copia cifrada en un momento dado. Los cambios no se sincronizan con el original.",
        noFileReason:
          "Abre un archivo antes de exportar a enlace.",
        exportToLink: "Exportar a enlace",
        preparing: "Preparando enlace cifrado…",
        linkLabel: "Enlace de exportación",
        securityDescription:
          "Se cifra en este navegador antes de subirlo. El servidor solo guarda la copia cifrada; la clave de descifrado permanece en el enlace.",
        unavailable: "La exportación a enlace no está disponible ahora.",
        copied: "Enlace de exportación copiado.",
        failed: "No se pudo exportar a un enlace.",
      },
    },
  },
  fr: {
    actions: {
      newFile: "Nouveau document",
      importFile: "Importer un document (.md)…",
      importWorkspace: "Importer un espace de travail…",
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
      tagline:
        "Un espace local-first pour partager des fichiers avec des personnes et des agents.",
      newFile: "Nouveau document",
      openFile: "Ouvrir un fichier Markdown",
      openWorkspace: "Ouvrir un espace de travail",
      browseFiles: "Parcourir les fichiers",
      help: "Aide",
    },
    clearWorkspace: {
      title: "Effacer l’espace local ?",
      description: "Supprime tous les documents, dossiers et commentaires locaux. Cette action est irréversible.",
      cancel: "Annuler",
      confirm: "Effacer l’espace",
      cleared: "Espace local effacé.",
    },
    share: {
      trigger: "Partager",
      modalTitle: "Partager",
      loadError: "Impossible d’ouvrir le partage.",
      live: {
        title: "Collaboration en direct",
        description:
          "Créez une room chiffrée pour collaborer en temps réel.",
        startSession: "Démarrer la session",
        startDescription: "Tout le workspace rejoint la room chiffrée.",
        securityDescription:
          "Chiffré de bout en bout. Tabula ne fait que relayer des mises à jour chiffrées et ne peut lire ni vos documents ni vos commentaires.",
        temporarySessionDescription:
          "Session temporaire. Gardez au moins un participant connecté.",
        inviteAgent: "Inviter un agent",
        inviteAgentDescription:
          "Connectez Tabula MCP, choisissez une tâche et transmettez cet espace en direct.",
        retrySession: "Réessayer",
        unavailable: "La collaboration en direct n’est pas disponible actuellement.",
        reconnectingTitle: "Reconnexion à l’espace en direct",
        reconnectingDescription: "Les modifications restent sur cet appareil jusqu’à la reconnexion.",
        disconnectedTitle: "Espace en direct déconnecté",
        disconnectedDescription: "Reconnectez-vous avant d’inviter des personnes ou des agents.",
        nameLabel: "Votre nom",
        nameAria: "Votre nom de collaboration",
        anonymousPlaceholder: "Anonyme",
        inviteLabel: "Lien d'invitation",
        invalidInviteTitle:
          "Cette room en direct n'a pas de lien d'invitation valide.",
        copyLink: "Copier le lien",
        copied: "Copié",
        stopSession: "Arrêter la session",
        stopDescription:
          "L’arrêt déconnecte uniquement ce navigateur. Les autres participants peuvent continuer dans la room.",
        stopConfirmTitle: "Arrêter la collaboration en direct ?",
        stopConfirmDescription:
          "Ce navigateur quittera la room. Le workspace partagé remplacera le workspace local enregistré sur cet appareil et les autres participants pourront continuer dans la room.",
        cancelStop: "Annuler",
        confirmStop: "Arrêter la session",
      },
      shareable: {
        title: "Lien d’export",
        description:
          "Créez une copie chiffrée à un instant donné. Les modifications ne sont pas resynchronisées.",
        noFileReason:
          "Ouvrez un fichier avant d'exporter vers un lien.",
        exportToLink: "Exporter vers un lien",
        preparing: "Préparation du lien chiffré…",
        linkLabel: "Lien d'export",
        securityDescription:
          "Le contenu est chiffré dans ce navigateur avant l’envoi. Le serveur ne conserve que la copie chiffrée ; la clé de déchiffrement reste dans le lien.",
        unavailable: "L’export vers un lien n’est pas disponible actuellement.",
        copied: "Lien d’export copié.",
        failed: "Impossible d’exporter vers un lien.",
      },
    },
  },
  de: {
    actions: {
      newFile: "Neues Dokument",
      importFile: "Dokument importieren (.md)…",
      importWorkspace: "Workspace importieren…",
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
      tagline:
        "Ein local-first Workspace zum sicheren Teilen von Dateien mit Menschen und Agenten.",
      newFile: "Neues Dokument",
      openFile: "Markdown-Datei öffnen",
      openWorkspace: "Workspace öffnen",
      browseFiles: "Projektdateien ansehen",
      help: "Hilfe",
    },
    clearWorkspace: {
      title: "Lokalen Workspace leeren?",
      description: "Löscht alle lokalen Dokumente, Ordner und Kommentare. Diese Aktion kann nicht rückgängig gemacht werden.",
      cancel: "Abbrechen",
      confirm: "Workspace leeren",
      cleared: "Lokaler Workspace geleert.",
    },
    share: {
      trigger: "Teilen",
      modalTitle: "Teilen",
      loadError: "Teilen konnte nicht geöffnet werden.",
      live: {
        title: "Live-Zusammenarbeit",
        description:
          "Erstelle einen verschlüsselten Room für Zusammenarbeit in Echtzeit.",
        startSession: "Sitzung starten",
        startDescription: "Der gesamte Workspace tritt dem verschlüsselten Room bei.",
        securityDescription:
          "Ende-zu-Ende verschlüsselt. Tabula leitet nur verschlüsselte Änderungen weiter und kann Dokumente oder Kommentare nicht lesen.",
        temporarySessionDescription:
          "Temporäre Sitzung. Mindestens eine Person muss verbunden bleiben.",
        inviteAgent: "Agent einladen",
        inviteAgentDescription:
          "Verbinde Tabula MCP, wähle eine Aufgabe und übergib diesen Live-Workspace.",
        retrySession: "Erneut versuchen",
        unavailable: "Live-Zusammenarbeit ist derzeit nicht verfügbar.",
        reconnectingTitle: "Live-Raum wird erneut verbunden",
        reconnectingDescription: "Änderungen bleiben bis zur Wiederverbindung auf diesem Gerät.",
        disconnectedTitle: "Verbindung zum Live-Raum getrennt",
        disconnectedDescription: "Stellen Sie die Verbindung wieder her, bevor Sie Personen oder Agenten einladen.",
        nameLabel: "Dein Name",
        nameAria: "Dein Name für die Zusammenarbeit",
        anonymousPlaceholder: "Anonym",
        inviteLabel: "Einladungslink",
        invalidInviteTitle:
          "Dieser Live-Room hat keinen gültigen Einladungslink.",
        copyLink: "Link kopieren",
        copied: "Kopiert",
        stopSession: "Sitzung beenden",
        stopDescription:
          "Beim Beenden verlässt nur dieser Browser den Room. Andere Teilnehmende können weiterarbeiten.",
        stopConfirmTitle: "Live-Zusammenarbeit beenden?",
        stopConfirmDescription:
          "Dieser Browser verlässt den Room. Der geteilte Workspace ersetzt den aktuell auf diesem Gerät gespeicherten lokalen Workspace; andere Teilnehmende können im Room weiterarbeiten.",
        cancelStop: "Abbrechen",
        confirmStop: "Sitzung beenden",
      },
      shareable: {
        title: "Exportlink",
        description:
          "Erstelle eine verschlüsselte Momentaufnahme. Änderungen werden nicht zurücksynchronisiert.",
        noFileReason:
          "Öffne eine Datei, bevor du als Link exportierst.",
        exportToLink: "Als Link exportieren",
        preparing: "Verschlüsselten Link vorbereiten…",
        linkLabel: "Exportlink",
        securityDescription:
          "Vor dem Upload wird in diesem Browser verschlüsselt. Der Server speichert nur die verschlüsselte Kopie; der Entschlüsselungsschlüssel bleibt im Link.",
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
  common: {
    or: string;
    closeShareDialog: string;
  };
  topChrome: {
    openWorkspaceMenu: string;
    closeWorkspaceMenu: string;
    toggleSidePanel: string;
    collaborators: string;
    agent: string;
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
    split: string;
    edit: string;
    preview: string;
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
    statusFor: (title: string) => string;
    savedLocally: string;
    roomOffline: string;
    word: string;
    words: string;
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
      toggleSidePanel: "Toggle side panel",
      collaborators: "Collaborators",
      agent: "Agent",
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
      split: "Split",
      edit: "Edit",
      preview: "Preview",
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
      statusFor: (title) => `Status for ${title}`,
      savedLocally: "Saved locally",
      roomOffline: "Disconnected",
      word: "word",
      words: "words",
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
      toggleSidePanel: "사이드 패널 전환",
      collaborators: "협업자",
      agent: "에이전트",
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
      split: "분할",
      edit: "편집",
      preview: "미리보기",
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
      statusFor: (title) => `${title} 상태`,
      savedLocally: "로컬 저장됨",
      roomOffline: "연결 끊김",
      word: "단어",
      words: "단어",
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
      toggleSidePanel: "サイドパネルを切り替える",
      collaborators: "共同編集者",
      agent: "エージェント",
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
      split: "分割",
      edit: "編集",
      preview: "プレビュー",
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
      statusFor: (title) => `${title} の状態`,
      savedLocally: "ローカルに保存済み",
      roomOffline: "切断されました",
      word: "語",
      words: "語",
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
      toggleSidePanel: "切换侧边栏",
      collaborators: "协作者",
      agent: "代理",
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
      split: "分屏",
      edit: "编辑",
      preview: "预览",
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
      statusFor: (title) => `${title} 的状态`,
      savedLocally: "已本地保存",
      roomOffline: "已断开连接",
      word: "词",
      words: "词",
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
      toggleSidePanel: "Alternar panel lateral",
      collaborators: "Colaboradores",
      agent: "Agente",
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
      split: "Dividir",
      edit: "Editar",
      preview: "Vista previa",
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
      statusFor: (title) => `Estado de ${title}`,
      savedLocally: "Guardado localmente",
      roomOffline: "Desconectado",
      word: "palabra",
      words: "palabras",
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
      toggleSidePanel: "Afficher ou masquer le panneau latéral",
      collaborators: "Collaborateurs",
      agent: "Agent",
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
      split: "Scinder",
      edit: "Modifier",
      preview: "Aperçu",
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
      statusFor: (title) => `État de ${title}`,
      savedLocally: "Enregistré localement",
      roomOffline: "Déconnecté",
      word: "mot",
      words: "mots",
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
      toggleSidePanel: "Seitenleiste ein-/ausblenden",
      collaborators: "Mitwirkende",
      agent: "Agent",
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
      split: "Teilen",
      edit: "Bearbeiten",
      preview: "Vorschau",
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
      statusFor: (title) => `Status für ${title}`,
      savedLocally: "Lokal gespeichert",
      roomOffline: "Getrennt",
      word: "Wort",
      words: "Wörter",
      line: "Zeile",
      lines: "Zeilen",
      character: "Zeichen",
      characters: "Zeichen",
    },
  },
};

export const getWorkspaceChromeCopy = (language: WorkspaceLanguage) =>
  workspaceChromeCopy[language];
