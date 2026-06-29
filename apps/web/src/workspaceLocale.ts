import type { WorkspaceLanguage } from "./hooks/useWorkspacePreferences";

type WorkspaceMenuCopy = {
  actions: {
    newMarkdown: string;
    openMarkdown: string;
    importProject: string;
    saveMarkdown: string;
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
    newMarkdown: string;
    openMarkdown: string;
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
      exportToLink: string;
      exporting: string;
      updateLink: string;
      openLink: string;
      linkLabel: string;
    };
    exportPanel: {
      title: string;
      description: string;
      markdownTitle: string;
      markdownDescription: string;
      copyMarkdownTitle: string;
      copyMarkdownDescription: string;
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
      newMarkdown: "New Markdown",
      openMarkdown: "Open Markdown...",
      importProject: "Import project...",
      saveMarkdown: "Save Markdown...",
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
      tagline: "A local-first Markdown workspace for files that people and coding agents can share safely.",
      newMarkdown: "New Markdown",
      openMarkdown: "Open .md file",
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
          "Stop sharing this file?\n\nThis tab will leave the live room and keep the current Markdown local. Other collaborators can continue in the room.",
      },
      shareable: {
        title: "Shareable link",
        description: "Export an encrypted copy of this file.",
        exportToLink: "Export to link",
        exporting: "Exporting",
        updateLink: "Update link",
        openLink: "Open link",
        linkLabel: "Shareable link",
      },
      exportPanel: {
        title: "Export Markdown",
        description: "Take the current file out of Tabula.md.",
        markdownTitle: "Markdown",
        markdownDescription: "Download the current file as source Markdown.",
        copyMarkdownTitle: "Copy Markdown",
        copyMarkdownDescription: "Copy the current file to the clipboard.",
        projectArchiveTitle: "Project archive",
        projectArchiveDescription: "Bundle every project file.",
      },
      sendTo: {
        title: "Send to local coding agent",
        description: "Create a prompt for Codex, Claude Code, or another local coding agent.",
        destinationTitle: "Local coding agent",
        destinationDescription: "Hand off Markdown context as a paste-ready prompt.",
        copyPrompt: "Copy prompt",
        currentFile: "Current file",
        project: "Project",
        instructionLabel: "What should the agent do?",
        instructionPlaceholder: (fileTitle) => `Implement the next step for ${fileTitle}.`,
      },
    },
  },
  ko: {
    actions: {
      newMarkdown: "새 Markdown",
      openMarkdown: "Markdown 열기...",
      importProject: "프로젝트 가져오기...",
      saveMarkdown: "Markdown 저장...",
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
      tagline: "사람과 코딩 에이전트가 안전하게 공유할 수 있는 로컬 우선 Markdown 작업공간.",
      newMarkdown: "새 Markdown",
      openMarkdown: ".md 파일 열기",
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
          "이 파일 공유를 중지할까요?\n\n이 탭은 실시간 room에서 나가고 현재 Markdown은 로컬에 유지됩니다. 다른 협업자는 room에서 계속 작업할 수 있습니다.",
      },
      shareable: {
        title: "공유 가능한 링크",
        description: "이 파일의 암호화된 복사본을 내보냅니다.",
        exportToLink: "링크로 내보내기",
        exporting: "내보내는 중",
        updateLink: "링크 업데이트",
        openLink: "링크 열기",
        linkLabel: "공유 가능한 링크",
      },
      exportPanel: {
        title: "Markdown 내보내기",
        description: "현재 파일을 Tabula.md 밖으로 가져갑니다.",
        markdownTitle: "Markdown",
        markdownDescription: "현재 파일을 원본 Markdown으로 다운로드합니다.",
        copyMarkdownTitle: "Markdown 복사",
        copyMarkdownDescription: "현재 파일을 클립보드에 복사합니다.",
        projectArchiveTitle: "프로젝트 압축 파일",
        projectArchiveDescription: "프로젝트의 모든 파일을 묶습니다.",
      },
      sendTo: {
        title: "로컬 코딩 에이전트로 보내기",
        description: "Codex, Claude Code 또는 다른 로컬 코딩 에이전트용 프롬프트를 만듭니다.",
        destinationTitle: "로컬 코딩 에이전트",
        destinationDescription: "Markdown 컨텍스트를 바로 붙여넣을 수 있는 프롬프트로 전달합니다.",
        copyPrompt: "프롬프트 복사",
        currentFile: "현재 파일",
        project: "프로젝트",
        instructionLabel: "에이전트가 무엇을 하면 되나요?",
        instructionPlaceholder: (fileTitle) => `${fileTitle}의 다음 단계를 구현하세요.`,
      },
    },
  },
  ja: {
    actions: {
      newMarkdown: "新規 Markdown",
      openMarkdown: "Markdown を開く...",
      importProject: "プロジェクトを読み込む...",
      saveMarkdown: "Markdown を保存...",
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
      tagline: "人とコーディングエージェントが安全に共有できるローカルファースト Markdown ワークスペース。",
      newMarkdown: "新規 Markdown",
      openMarkdown: ".md ファイルを開く",
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
        invalidInviteTitle: "このライブファイルには有効な招待リンクがありません。",
        copyLink: "リンクをコピー",
        copied: "コピー済み",
        stopSession: "セッション停止",
        stopConfirm:
          "このファイルの共有を停止しますか?\n\nこのタブはライブ room から退出し、現在の Markdown はローカルに残ります。他の共同編集者は room で作業を続けられます。",
      },
      shareable: {
        title: "共有可能リンク",
        description: "このファイルの暗号化コピーを書き出します。",
        exportToLink: "リンクに書き出す",
        exporting: "書き出し中",
        updateLink: "リンクを更新",
        openLink: "リンクを開く",
        linkLabel: "共有可能リンク",
      },
      exportPanel: {
        title: "Markdown を書き出し",
        description: "現在のファイルを Tabula.md の外へ持ち出します。",
        markdownTitle: "Markdown",
        markdownDescription: "現在のファイルを Markdown ソースとしてダウンロードします。",
        copyMarkdownTitle: "Markdown をコピー",
        copyMarkdownDescription: "現在のファイルをクリップボードへコピーします。",
        projectArchiveTitle: "プロジェクトアーカイブ",
        projectArchiveDescription: "プロジェクト内のすべてのファイルをまとめます。",
      },
      sendTo: {
        title: "ローカルコーディングエージェントに送信",
        description: "Codex、Claude Code、または他のローカルコーディングエージェント用のプロンプトを作成します。",
        destinationTitle: "ローカルコーディングエージェント",
        destinationDescription: "Markdown コンテキストを貼り付け可能なプロンプトとして渡します。",
        copyPrompt: "プロンプトをコピー",
        currentFile: "現在のファイル",
        project: "プロジェクト",
        instructionLabel: "エージェントに何をしてほしいですか?",
        instructionPlaceholder: (fileTitle) => `${fileTitle} の次のステップを実装してください。`,
      },
    },
  },
  zh: {
    actions: {
      newMarkdown: "新建 Markdown",
      openMarkdown: "打开 Markdown...",
      importProject: "导入项目...",
      saveMarkdown: "保存 Markdown...",
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
      tagline: "让人与编码智能体安全共享文件的本地优先 Markdown 工作区。",
      newMarkdown: "新建 Markdown",
      openMarkdown: "打开 .md 文件",
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
          "停止分享此文件吗？\n\n此标签页将离开实时 room，并把当前 Markdown 保留在本地。其他协作者仍可在 room 中继续。",
      },
      shareable: {
        title: "可分享链接",
        description: "导出此文件的加密副本。",
        exportToLink: "导出为链接",
        exporting: "正在导出",
        updateLink: "更新链接",
        openLink: "打开链接",
        linkLabel: "可分享链接",
      },
      exportPanel: {
        title: "导出 Markdown",
        description: "将当前文件带出 Tabula.md。",
        markdownTitle: "Markdown",
        markdownDescription: "将当前文件下载为 Markdown 源文件。",
        copyMarkdownTitle: "复制 Markdown",
        copyMarkdownDescription: "将当前文件复制到剪贴板。",
        projectArchiveTitle: "项目归档",
        projectArchiveDescription: "打包项目中的所有文件。",
      },
      sendTo: {
        title: "发送到本地编码智能体",
        description: "为 Codex、Claude Code 或其他本地编码智能体创建提示词。",
        destinationTitle: "本地编码智能体",
        destinationDescription: "把 Markdown 上下文交给可直接粘贴的提示词。",
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
      newMarkdown: "Nuevo Markdown",
      openMarkdown: "Abrir Markdown...",
      importProject: "Importar proyecto...",
      saveMarkdown: "Guardar Markdown...",
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
      tagline: "Un espacio Markdown local-first para compartir archivos con personas y agentes de código.",
      newMarkdown: "Nuevo Markdown",
      openMarkdown: "Abrir archivo .md",
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
        startDescription: "Crea un enlace editable de invitación para este archivo.",
        nameLabel: "Tu nombre",
        nameAria: "Tu nombre de colaboración",
        anonymousPlaceholder: "Anónimo",
        inviteLabel: "Enlace de invitación",
        invalidInviteTitle: "Este archivo en vivo no tiene un enlace de invitación válido.",
        copyLink: "Copiar enlace",
        copied: "Copiado",
        stopSession: "Detener sesión",
        stopConfirm:
          "¿Dejar de compartir este archivo?\n\nEsta pestaña saldrá del room en vivo y conservará el Markdown actual en local. Otros colaboradores pueden continuar en el room.",
      },
      shareable: {
        title: "Enlace compartible",
        description: "Exporta una copia cifrada de este archivo.",
        exportToLink: "Exportar a enlace",
        exporting: "Exportando",
        updateLink: "Actualizar enlace",
        openLink: "Abrir enlace",
        linkLabel: "Enlace compartible",
      },
      exportPanel: {
        title: "Exportar Markdown",
        description: "Saca el archivo actual de Tabula.md.",
        markdownTitle: "Markdown",
        markdownDescription: "Descarga el archivo actual como Markdown fuente.",
        copyMarkdownTitle: "Copiar Markdown",
        copyMarkdownDescription: "Copia el archivo actual al portapapeles.",
        projectArchiveTitle: "Archivo del proyecto",
        projectArchiveDescription: "Empaqueta todos los archivos del proyecto.",
      },
      sendTo: {
        title: "Enviar a un agente local de código",
        description: "Crea un prompt para Codex, Claude Code u otro agente local de código.",
        destinationTitle: "Agente local de código",
        destinationDescription: "Entrega el contexto Markdown como prompt listo para pegar.",
        copyPrompt: "Copiar prompt",
        currentFile: "Archivo actual",
        project: "Proyecto",
        instructionLabel: "¿Qué debe hacer el agente?",
        instructionPlaceholder: (fileTitle) => `Implementa el siguiente paso para ${fileTitle}.`,
      },
    },
  },
  fr: {
    actions: {
      newMarkdown: "Nouveau Markdown",
      openMarkdown: "Ouvrir Markdown...",
      importProject: "Importer un projet...",
      saveMarkdown: "Enregistrer Markdown...",
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
      tagline: "Un espace Markdown local-first pour partager des fichiers avec des personnes et des agents de code.",
      newMarkdown: "Nouveau Markdown",
      openMarkdown: "Ouvrir un fichier .md",
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
        startDescription: "Créez un lien d'invitation modifiable pour ce fichier.",
        nameLabel: "Votre nom",
        nameAria: "Votre nom de collaboration",
        anonymousPlaceholder: "Anonyme",
        inviteLabel: "Lien d'invitation",
        invalidInviteTitle: "Ce fichier en direct n'a pas de lien d'invitation valide.",
        copyLink: "Copier le lien",
        copied: "Copié",
        stopSession: "Arrêter la session",
        stopConfirm:
          "Arrêter le partage de ce fichier ?\n\nCet onglet quittera le room en direct et gardera le Markdown actuel en local. Les autres collaborateurs peuvent continuer dans le room.",
      },
      shareable: {
        title: "Lien partageable",
        description: "Exportez une copie chiffrée de ce fichier.",
        exportToLink: "Exporter en lien",
        exporting: "Exportation",
        updateLink: "Mettre à jour le lien",
        openLink: "Ouvrir le lien",
        linkLabel: "Lien partageable",
      },
      exportPanel: {
        title: "Exporter Markdown",
        description: "Sortez le fichier actuel de Tabula.md.",
        markdownTitle: "Markdown",
        markdownDescription: "Téléchargez le fichier actuel en Markdown source.",
        copyMarkdownTitle: "Copier Markdown",
        copyMarkdownDescription: "Copiez le fichier actuel dans le presse-papiers.",
        projectArchiveTitle: "Archive du projet",
        projectArchiveDescription: "Regroupez tous les fichiers du projet.",
      },
      sendTo: {
        title: "Envoyer à un agent de code local",
        description: "Créez un prompt pour Codex, Claude Code ou un autre agent de code local.",
        destinationTitle: "Agent de code local",
        destinationDescription: "Transmettez le contexte Markdown comme prompt prêt à coller.",
        copyPrompt: "Copier le prompt",
        currentFile: "Fichier actuel",
        project: "Projet",
        instructionLabel: "Que doit faire l'agent ?",
        instructionPlaceholder: (fileTitle) => `Implémentez la prochaine étape pour ${fileTitle}.`,
      },
    },
  },
  de: {
    actions: {
      newMarkdown: "Neues Markdown",
      openMarkdown: "Markdown öffnen...",
      importProject: "Projekt importieren...",
      saveMarkdown: "Markdown speichern...",
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
      tagline: "Ein local-first Markdown-Workspace zum sicheren Teilen von Dateien mit Menschen und Coding-Agenten.",
      newMarkdown: "Neues Markdown",
      openMarkdown: ".md-Datei öffnen",
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
        startDescription: "Erstelle einen bearbeitbaren Einladungslink für diese Datei.",
        nameLabel: "Dein Name",
        nameAria: "Dein Name für die Zusammenarbeit",
        anonymousPlaceholder: "Anonym",
        inviteLabel: "Einladungslink",
        invalidInviteTitle: "Diese Live-Datei hat keinen gültigen Einladungslink.",
        copyLink: "Link kopieren",
        copied: "Kopiert",
        stopSession: "Sitzung stoppen",
        stopConfirm:
          "Diese Datei nicht mehr teilen?\n\nDieser Tab verlässt den Live-room und behält das aktuelle Markdown lokal. Andere können im room weiterarbeiten.",
      },
      shareable: {
        title: "Teilbarer Link",
        description: "Exportiere eine verschlüsselte Kopie dieser Datei.",
        exportToLink: "Als Link exportieren",
        exporting: "Exportiert",
        updateLink: "Link aktualisieren",
        openLink: "Link öffnen",
        linkLabel: "Teilbarer Link",
      },
      exportPanel: {
        title: "Markdown exportieren",
        description: "Nimm die aktuelle Datei aus Tabula.md heraus.",
        markdownTitle: "Markdown",
        markdownDescription: "Lade die aktuelle Datei als Markdown-Quelle herunter.",
        copyMarkdownTitle: "Markdown kopieren",
        copyMarkdownDescription: "Kopiere die aktuelle Datei in die Zwischenablage.",
        projectArchiveTitle: "Projektarchiv",
        projectArchiveDescription: "Bündle alle Projektdateien.",
      },
      sendTo: {
        title: "An lokalen Coding-Agent senden",
        description: "Erstelle einen Prompt für Codex, Claude Code oder einen anderen lokalen Coding-Agent.",
        destinationTitle: "Lokaler Coding-Agent",
        destinationDescription: "Übergib Markdown-Kontext als einfügbaren Prompt.",
        copyPrompt: "Prompt kopieren",
        currentFile: "Aktuelle Datei",
        project: "Projekt",
        instructionLabel: "Was soll der Agent tun?",
        instructionPlaceholder: (fileTitle) => `Implementiere den nächsten Schritt für ${fileTitle}.`,
      },
    },
  },
};

export const getWorkspaceMenuCopy = (language: WorkspaceLanguage) => workspaceMenuCopy[language];
