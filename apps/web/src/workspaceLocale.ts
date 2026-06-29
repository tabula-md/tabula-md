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
  },
};

export const getWorkspaceMenuCopy = (language: WorkspaceLanguage) => workspaceMenuCopy[language];
