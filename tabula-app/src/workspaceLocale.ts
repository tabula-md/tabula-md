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
    modalTitle: (fileTitle: string) => string;
    purposeAria: string;
    tabs: {
      shareLink: string;
      export: string;
      sendTo: string;
    };
    live: {
      title: string;
      description: string;
      startSession: string;
      startDescription: string;
      nameLabel: string;
      nameAria: string;
      anonymousPlaceholder: string;
      inviteLabel: string;
      invalidInviteTitle: string;
      copyLink: string;
      copied: string;
      stopSession: string;
      stopConfirm: string;
    };
    shareable: {
      title: string;
      description: string;
      noFileReason: string;
      emptyFileReason: (fileTitle: string) => string;
      exportToLink: string;
      exporting: string;
      updateLink: string;
      openLink: string;
      linkLabel: string;
    };
    exportPanel: {
      title: string;
      description: string;
      fileTitle: string;
      fileDescription: string;
      copyFileTitle: string;
      copyFileDescription: string;
      projectArchiveTitle: string;
      projectArchiveDescription: string;
    };
    sendTo: {
      title: string;
      description: string;
      destinationTitle: string;
      destinationDescription: string;
      copyPrompt: string;
      currentFile: string;
      project: string;
      instructionLabel: string;
      instructionPlaceholder: (fileTitle: string) => string;
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
      importProject: "Import project...",
      saveFile: "Save File...",
      exportProject: "Export project...",
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
      modalTitle: (fileTitle) => `Share ${fileTitle}`,
      purposeAria: "Share purpose",
      tabs: {
        shareLink: "Share link",
        export: "Export",
        sendTo: "Send to...",
      },
      live: {
        title: "Live collaboration",
        description: "Invite people to edit this file together.",
        startSession: "Start session",
        startDescription: "Create an editable invite link for this file.",
        nameLabel: "Your name",
        nameAria: "Your collaboration name",
        anonymousPlaceholder: "Anonymous",
        inviteLabel: "Invite link",
        invalidInviteTitle: "This live file does not have a valid invite link.",
        copyLink: "Copy link",
        copied: "Copied",
        stopSession: "Stop session",
        stopConfirm:
          "Stop sharing this file?\n\nThis tab will leave the live room and keep the current file local. Other collaborators can continue in the room.",
      },
      shareable: {
        title: "Snapshot link",
        description:
          "Create an encrypted snapshot that opens as a local copy.",
        noFileReason: "Open a file before creating a snapshot link.",
        emptyFileReason: (fileTitle) =>
          `Add content to ${fileTitle} before creating a snapshot link.`,
        exportToLink: "Create snapshot link",
        exporting: "Creating link",
        updateLink: "New snapshot link",
        openLink: "Open snapshot",
        linkLabel: "Snapshot link",
      },
      exportPanel: {
        title: "Export File",
        description: "Take the current file out of Tabula.md.",
        fileTitle: "File",
        fileDescription: "Download the current file.",
        copyFileTitle: "Copy File",
        copyFileDescription: "Copy the current file to the clipboard.",
        projectArchiveTitle: "Project archive",
        projectArchiveDescription: "Bundle every project file.",
      },
      sendTo: {
        title: "Send to local coding agent",
        description:
          "Create a prompt for Codex, Claude Code, or another local coding agent.",
        destinationTitle: "Local coding agent",
        destinationDescription:
          "Hand off file context as a paste-ready prompt.",
        copyPrompt: "Copy prompt",
        currentFile: "Current file",
        project: "Project",
        instructionLabel: "What should the agent do?",
        instructionPlaceholder: (fileTitle) =>
          `Implement the next step for ${fileTitle}.`,
      },
    },
  },
  ko: {
    actions: {
      newFile: "새 파일",
      openFile: "파일 열기...",
      importProject: "프로젝트 가져오기...",
      saveFile: "파일 저장...",
      exportProject: "프로젝트 내보내기...",
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
      modalTitle: (fileTitle) => `${fileTitle} 공유`,
      purposeAria: "공유 목적",
      tabs: {
        shareLink: "공유 링크",
        export: "내보내기",
        sendTo: "보내기...",
      },
      live: {
        title: "실시간 협업",
        description: "사람들을 초대해 이 파일을 함께 편집합니다.",
        startSession: "세션 시작",
        startDescription: "이 파일을 함께 편집할 수 있는 초대 링크를 만듭니다.",
        nameLabel: "내 이름",
        nameAria: "협업에서 표시할 이름",
        anonymousPlaceholder: "익명",
        inviteLabel: "초대 링크",
        invalidInviteTitle: "이 실시간 파일에는 유효한 초대 링크가 없습니다.",
        copyLink: "링크 복사",
        copied: "복사됨",
        stopSession: "세션 중지",
        stopConfirm:
          "이 파일 공유를 중지할까요?\n\n이 탭은 실시간 room에서 나가고 현재 파일은 로컬에 유지됩니다. 다른 협업자는 room에서 계속 작업할 수 있습니다.",
      },
      shareable: {
        title: "스냅샷 링크",
        description:
          "로컬 복사본으로 열 암호화된 스냅샷을 만듭니다.",
        noFileReason: "파일을 열면 스냅샷 링크를 만들 수 있습니다.",
        emptyFileReason: (fileTitle) =>
          `${fileTitle}에 내용을 추가하면 스냅샷 링크를 만들 수 있습니다.`,
        exportToLink: "스냅샷 링크 만들기",
        exporting: "링크 만드는 중",
        updateLink: "새 스냅샷 링크",
        openLink: "스냅샷 열기",
        linkLabel: "스냅샷 링크",
      },
      exportPanel: {
        title: "파일 내보내기",
        description: "현재 파일을 Tabula.md 밖으로 가져갑니다.",
        fileTitle: "File",
        fileDescription: "현재 파일을 다운로드합니다.",
        copyFileTitle: "파일 복사",
        copyFileDescription: "현재 파일을 클립보드에 복사합니다.",
        projectArchiveTitle: "프로젝트 압축 파일",
        projectArchiveDescription: "프로젝트의 모든 파일을 묶습니다.",
      },
      sendTo: {
        title: "로컬 코딩 에이전트로 보내기",
        description:
          "Codex, Claude Code 또는 다른 로컬 코딩 에이전트용 프롬프트를 만듭니다.",
        destinationTitle: "로컬 코딩 에이전트",
        destinationDescription:
          "파일 컨텍스트를 바로 붙여넣을 수 있는 프롬프트로 전달합니다.",
        copyPrompt: "프롬프트 복사",
        currentFile: "현재 파일",
        project: "프로젝트",
        instructionLabel: "에이전트가 무엇을 하면 되나요?",
        instructionPlaceholder: (fileTitle) =>
          `${fileTitle}의 다음 단계를 구현하세요.`,
      },
    },
  },
  ja: {
    actions: {
      newFile: "新規ファイル",
      openFile: "ファイルを開く...",
      importProject: "プロジェクトを読み込む...",
      saveFile: "ファイルを保存...",
      exportProject: "プロジェクトを書き出す...",
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
      modalTitle: (fileTitle) => `${fileTitle} を共有`,
      purposeAria: "共有の目的",
      tabs: {
        shareLink: "共有リンク",
        export: "書き出し",
        sendTo: "送信先...",
      },
      live: {
        title: "ライブ共同編集",
        description: "このファイルを一緒に編集する人を招待します。",
        startSession: "セッション開始",
        startDescription: "このファイルを編集できる招待リンクを作成します。",
        nameLabel: "あなたの名前",
        nameAria: "共同編集で表示する名前",
        anonymousPlaceholder: "匿名",
        inviteLabel: "招待リンク",
        invalidInviteTitle:
          "このライブファイルには有効な招待リンクがありません。",
        copyLink: "リンクをコピー",
        copied: "コピー済み",
        stopSession: "セッション停止",
        stopConfirm:
          "このファイルの共有を停止しますか?\n\nこのタブはライブ room から退出し、現在のファイルはローカルに残ります。他の共同編集者は room で作業を続けられます。",
      },
      shareable: {
        title: "スナップショットリンク",
        description:
          "ローカルコピーとして開く暗号化スナップショットを作成します。",
        noFileReason:
          "ファイルを開くとスナップショットリンクを作成できます。",
        emptyFileReason: (fileTitle) =>
          `${fileTitle} に内容を追加するとスナップショットリンクを作成できます。`,
        exportToLink: "スナップショットリンクを作成",
        exporting: "リンクを作成中",
        updateLink: "新しいスナップショットリンク",
        openLink: "スナップショットを開く",
        linkLabel: "スナップショットリンク",
      },
      exportPanel: {
        title: "ファイルを書き出し",
        description: "現在のファイルを Tabula.md の外へ持ち出します。",
        fileTitle: "File",
        fileDescription:
          "現在のファイルをダウンロードします。",
        copyFileTitle: "ファイルをコピー",
        copyFileDescription:
          "現在のファイルをクリップボードへコピーします。",
        projectArchiveTitle: "プロジェクトアーカイブ",
        projectArchiveDescription:
          "プロジェクト内のすべてのファイルをまとめます。",
      },
      sendTo: {
        title: "ローカルコーディングエージェントに送信",
        description:
          "Codex、Claude Code、または他のローカルコーディングエージェント用のプロンプトを作成します。",
        destinationTitle: "ローカルコーディングエージェント",
        destinationDescription:
          "ファイルコンテキストを貼り付け可能なプロンプトとして渡します。",
        copyPrompt: "プロンプトをコピー",
        currentFile: "現在のファイル",
        project: "プロジェクト",
        instructionLabel: "エージェントに何をしてほしいですか?",
        instructionPlaceholder: (fileTitle) =>
          `${fileTitle} の次のステップを実装してください。`,
      },
    },
  },
  zh: {
    actions: {
      newFile: "新建文件",
      openFile: "打开文件...",
      importProject: "导入项目...",
      saveFile: "保存文件...",
      exportProject: "导出项目...",
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
      modalTitle: (fileTitle) => `分享 ${fileTitle}`,
      purposeAria: "分享目的",
      tabs: {
        shareLink: "分享链接",
        export: "导出",
        sendTo: "发送到...",
      },
      live: {
        title: "实时协作",
        description: "邀请他人一起编辑此文件。",
        startSession: "开始会话",
        startDescription: "为此文件创建可编辑的邀请链接。",
        nameLabel: "你的名字",
        nameAria: "协作显示名称",
        anonymousPlaceholder: "匿名",
        inviteLabel: "邀请链接",
        invalidInviteTitle: "此实时文件没有有效的邀请链接。",
        copyLink: "复制链接",
        copied: "已复制",
        stopSession: "停止会话",
        stopConfirm:
          "停止分享此文件吗？\n\n此标签页将离开实时 room，并把当前文件保留在本地。其他协作者仍可在 room 中继续。",
      },
      shareable: {
        title: "快照链接",
        description: "创建可作为本地副本打开的加密快照。",
        noFileReason: "打开文件后即可创建快照链接。",
        emptyFileReason: (fileTitle) =>
          `向 ${fileTitle} 添加内容后即可创建快照链接。`,
        exportToLink: "创建快照链接",
        exporting: "正在创建链接",
        updateLink: "新建快照链接",
        openLink: "打开快照",
        linkLabel: "快照链接",
      },
      exportPanel: {
        title: "导出文件",
        description: "将当前文件带出 Tabula.md。",
        fileTitle: "File",
        fileDescription: "下载当前文件。",
        copyFileTitle: "复制文件",
        copyFileDescription: "将当前文件复制到剪贴板。",
        projectArchiveTitle: "项目归档",
        projectArchiveDescription: "打包项目中的所有文件。",
      },
      sendTo: {
        title: "发送到本地编码智能体",
        description: "为 Codex、Claude Code 或其他本地编码智能体创建提示词。",
        destinationTitle: "本地编码智能体",
        destinationDescription: "把文件上下文交给可直接粘贴的提示词。",
        copyPrompt: "复制提示词",
        currentFile: "当前文件",
        project: "项目",
        instructionLabel: "希望智能体做什么？",
        instructionPlaceholder: (fileTitle) => `实现 ${fileTitle} 的下一步。`,
      },
    },
  },
  es: {
    actions: {
      newFile: "Nuevo archivo",
      openFile: "Abrir archivo...",
      importProject: "Importar proyecto...",
      saveFile: "Guardar archivo...",
      exportProject: "Exportar proyecto...",
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
      modalTitle: (fileTitle) => `Compartir ${fileTitle}`,
      purposeAria: "Propósito para compartir",
      tabs: {
        shareLink: "Enlace",
        export: "Exportar",
        sendTo: "Enviar a...",
      },
      live: {
        title: "Colaboración en vivo",
        description: "Invita a otros a editar este archivo contigo.",
        startSession: "Iniciar sesión",
        startDescription:
          "Crea un enlace editable de invitación para este archivo.",
        nameLabel: "Tu nombre",
        nameAria: "Tu nombre de colaboración",
        anonymousPlaceholder: "Anónimo",
        inviteLabel: "Enlace de invitación",
        invalidInviteTitle:
          "Este archivo en vivo no tiene un enlace de invitación válido.",
        copyLink: "Copiar enlace",
        copied: "Copiado",
        stopSession: "Detener sesión",
        stopConfirm:
          "¿Dejar de compartir este archivo?\n\nEsta pestaña saldrá del room en vivo y conservará el archivo actual en local. Otros colaboradores pueden continuar en el room.",
      },
      shareable: {
        title: "Enlace de snapshot",
        description:
          "Crea un snapshot cifrado que se abre como copia local.",
        noFileReason:
          "Abre un archivo antes de crear un enlace de snapshot.",
        emptyFileReason: (fileTitle) =>
          `Añade contenido a ${fileTitle} antes de crear un enlace de snapshot.`,
        exportToLink: "Crear enlace de snapshot",
        exporting: "Creando enlace",
        updateLink: "Nuevo enlace de snapshot",
        openLink: "Abrir snapshot",
        linkLabel: "Enlace de snapshot",
      },
      exportPanel: {
        title: "Exportar archivo",
        description: "Saca el archivo actual de Tabula.md.",
        fileTitle: "File",
        fileDescription: "Descarga el archivo actual.",
        copyFileTitle: "Copiar archivo",
        copyFileDescription: "Copia el archivo actual al portapapeles.",
        projectArchiveTitle: "Archivo del proyecto",
        projectArchiveDescription: "Empaqueta todos los archivos del proyecto.",
      },
      sendTo: {
        title: "Enviar a un agente local de código",
        description:
          "Crea un prompt para Codex, Claude Code u otro agente local de código.",
        destinationTitle: "Agente local de código",
        destinationDescription:
          "Entrega el contexto del archivo como prompt listo para pegar.",
        copyPrompt: "Copiar prompt",
        currentFile: "Archivo actual",
        project: "Proyecto",
        instructionLabel: "¿Qué debe hacer el agente?",
        instructionPlaceholder: (fileTitle) =>
          `Implementa el siguiente paso para ${fileTitle}.`,
      },
    },
  },
  fr: {
    actions: {
      newFile: "Nouveau fichier",
      openFile: "Ouvrir un fichier...",
      importProject: "Importer un projet...",
      saveFile: "Enregistrer le fichier...",
      exportProject: "Exporter le projet...",
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
      modalTitle: (fileTitle) => `Partager ${fileTitle}`,
      purposeAria: "Objectif du partage",
      tabs: {
        shareLink: "Lien",
        export: "Exporter",
        sendTo: "Envoyer à...",
      },
      live: {
        title: "Collaboration en direct",
        description: "Invitez des personnes à modifier ce fichier avec vous.",
        startSession: "Démarrer la session",
        startDescription:
          "Créez un lien d'invitation modifiable pour ce fichier.",
        nameLabel: "Votre nom",
        nameAria: "Votre nom de collaboration",
        anonymousPlaceholder: "Anonyme",
        inviteLabel: "Lien d'invitation",
        invalidInviteTitle:
          "Ce fichier en direct n'a pas de lien d'invitation valide.",
        copyLink: "Copier le lien",
        copied: "Copié",
        stopSession: "Arrêter la session",
        stopConfirm:
          "Arrêter le partage de ce fichier ?\n\nCet onglet quittera le room en direct et gardera le fichier actuel en local. Les autres collaborateurs peuvent continuer dans le room.",
      },
      shareable: {
        title: "Lien de snapshot",
        description:
          "Créez un snapshot chiffré qui s'ouvre comme copie locale.",
        noFileReason:
          "Ouvrez un fichier avant de créer un lien de snapshot.",
        emptyFileReason: (fileTitle) =>
          `Ajoutez du contenu à ${fileTitle} avant de créer un lien de snapshot.`,
        exportToLink: "Créer un lien de snapshot",
        exporting: "Création du lien",
        updateLink: "Nouveau lien de snapshot",
        openLink: "Ouvrir le snapshot",
        linkLabel: "Lien de snapshot",
      },
      exportPanel: {
        title: "Exporter le fichier",
        description: "Sortez le fichier actuel de Tabula.md.",
        fileTitle: "File",
        fileDescription:
          "Téléchargez le fichier actuel.",
        copyFileTitle: "Copier le fichier",
        copyFileDescription:
          "Copiez le fichier actuel dans le presse-papiers.",
        projectArchiveTitle: "Archive du projet",
        projectArchiveDescription: "Regroupez tous les fichiers du projet.",
      },
      sendTo: {
        title: "Envoyer à un agent de code local",
        description:
          "Créez un prompt pour Codex, Claude Code ou un autre agent de code local.",
        destinationTitle: "Agent de code local",
        destinationDescription:
          "Transmettez le contexte du fichier comme prompt prêt à coller.",
        copyPrompt: "Copier le prompt",
        currentFile: "Fichier actuel",
        project: "Projet",
        instructionLabel: "Que doit faire l'agent ?",
        instructionPlaceholder: (fileTitle) =>
          `Implémentez la prochaine étape pour ${fileTitle}.`,
      },
    },
  },
  de: {
    actions: {
      newFile: "Neue Datei",
      openFile: "Datei öffnen...",
      importProject: "Projekt importieren...",
      saveFile: "Datei speichern...",
      exportProject: "Projekt exportieren...",
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
      modalTitle: (fileTitle) => `${fileTitle} teilen`,
      purposeAria: "Teilen-Zweck",
      tabs: {
        shareLink: "Teilen-Link",
        export: "Exportieren",
        sendTo: "Senden an...",
      },
      live: {
        title: "Live-Zusammenarbeit",
        description: "Lade Personen ein, diese Datei gemeinsam zu bearbeiten.",
        startSession: "Sitzung starten",
        startDescription:
          "Erstelle einen bearbeitbaren Einladungslink für diese Datei.",
        nameLabel: "Dein Name",
        nameAria: "Dein Name für die Zusammenarbeit",
        anonymousPlaceholder: "Anonym",
        inviteLabel: "Einladungslink",
        invalidInviteTitle:
          "Diese Live-Datei hat keinen gültigen Einladungslink.",
        copyLink: "Link kopieren",
        copied: "Kopiert",
        stopSession: "Sitzung stoppen",
        stopConfirm:
          "Diese Datei nicht mehr teilen?\n\nDieser Tab verlässt den Live-room und behält die aktuelle Datei lokal. Andere können im room weiterarbeiten.",
      },
      shareable: {
        title: "Snapshot-Link",
        description:
          "Erstelle einen verschlüsselten Snapshot, der als lokale Kopie geöffnet wird.",
        noFileReason:
          "Öffne eine Datei, bevor du einen Snapshot-Link erstellst.",
        emptyFileReason: (fileTitle) =>
          `Füge Inhalt zu ${fileTitle} hinzu, bevor du einen Snapshot-Link erstellst.`,
        exportToLink: "Snapshot-Link erstellen",
        exporting: "Link wird erstellt",
        updateLink: "Neuer Snapshot-Link",
        openLink: "Snapshot öffnen",
        linkLabel: "Snapshot-Link",
      },
      exportPanel: {
        title: "Datei exportieren",
        description: "Nimm die aktuelle Datei aus Tabula.md heraus.",
        fileTitle: "File",
        fileDescription:
          "Lade die aktuelle Datei herunter.",
        copyFileTitle: "Datei kopieren",
        copyFileDescription:
          "Kopiere die aktuelle Datei in die Zwischenablage.",
        projectArchiveTitle: "Projektarchiv",
        projectArchiveDescription: "Bündle alle Projektdateien.",
      },
      sendTo: {
        title: "An lokalen Coding-Agent senden",
        description:
          "Erstelle einen Prompt für Codex, Claude Code oder einen anderen lokalen Coding-Agent.",
        destinationTitle: "Lokaler Coding-Agent",
        destinationDescription:
          "Übergib Dateikontext als einfügbaren Prompt.",
        copyPrompt: "Prompt kopieren",
        currentFile: "Aktuelle Datei",
        project: "Projekt",
        instructionLabel: "Was soll der Agent tun?",
        instructionPlaceholder: (fileTitle) =>
          `Implementiere den nächsten Schritt für ${fileTitle}.`,
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
    textWidth: string;
    focusWidth: string;
    standardWidth: string;
    fillWidth: string;
    findInFile: string;
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
      textWidth: "Text Width",
      focusWidth: "Focus",
      standardWidth: "Standard",
      fillWidth: "Fill",
      findInFile: "Find in file",
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
      textWidth: "텍스트 폭",
      focusWidth: "집중",
      standardWidth: "표준",
      fillWidth: "채우기",
      findInFile: "파일에서 찾기",
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
      textWidth: "テキスト幅",
      focusWidth: "集中",
      standardWidth: "標準",
      fillWidth: "全幅",
      findInFile: "ファイル内検索",
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
      textWidth: "文本宽度",
      focusWidth: "专注",
      standardWidth: "标准",
      fillWidth: "填满",
      findInFile: "在文件中查找",
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
      textWidth: "Ancho de texto",
      focusWidth: "Enfoque",
      standardWidth: "Estándar",
      fillWidth: "Llenar",
      findInFile: "Buscar en archivo",
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
      textWidth: "Largeur du texte",
      focusWidth: "Focus",
      standardWidth: "Standard",
      fillWidth: "Remplir",
      findInFile: "Rechercher dans le fichier",
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
      textWidth: "Textbreite",
      focusWidth: "Fokus",
      standardWidth: "Standard",
      fillWidth: "Füllen",
      findInFile: "In Datei suchen",
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
