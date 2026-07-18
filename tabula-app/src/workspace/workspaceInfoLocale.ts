import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";

export type WorkspaceInfoCopy = {
  close: string;
  about: {
    title: string;
    description: string;
    points: [string, string, string];
  };
  help: {
    title: string;
    description: string;
    newDocument: string;
    openMarkdown: string;
    browseFiles: string;
    editModes: string;
    share: string;
  };
};

const copies: Record<WorkspaceLanguage, WorkspaceInfoCopy> = {
  en: {
    close: "Close",
    about: {
      title: "About Tabula.md",
      description: "Open a Markdown folder, share one link, and edit together with people or AI.",
      points: [
        "Markdown files remain the primary unit of work.",
        "Local work stays in this browser until you export or share it.",
        "Live rooms relay encrypted workspace updates.",
      ],
    },
    help: {
      title: "Help",
      description: "Start with a document, then toggle the side panel when you need files, outline, or comments.",
      newDocument: "Create a new document",
      openMarkdown: "Open a Markdown file",
      browseFiles: "Browse workspace files",
      editModes: "Switch between Edit, Split, and Preview",
      share: "Use Share for live collaboration or export",
    },
  },
  ko: {
    close: "닫기",
    about: {
      title: "Tabula.md 소개",
      description: "Markdown 폴더를 열고 링크 하나로 사람이나 AI와 함께 편집하세요.",
      points: [
        "Markdown 파일이 작업의 기본 단위입니다.",
        "내보내거나 공유하기 전까지 로컬 작업은 이 브라우저에 저장됩니다.",
        "실시간 room은 암호화된 워크스페이스 변경만 전달합니다.",
      ],
    },
    help: {
      title: "도움말",
      description: "문서에서 시작하고 파일, 개요, 댓글이 필요할 때 사이드 패널을 여세요.",
      newDocument: "새 문서 만들기",
      openMarkdown: "Markdown 파일 열기",
      browseFiles: "워크스페이스 파일 찾아보기",
      editModes: "편집, 분할, 미리보기 전환",
      share: "공유에서 실시간 협업 또는 내보내기",
    },
  },
  ja: {
    close: "閉じる",
    about: {
      title: "Tabula.md について",
      description: "Markdown フォルダーを開き、リンクを共有して、人や AI と一緒に編集できます。",
      points: [
        "Markdown ファイルが作業の基本単位です。",
        "エクスポートまたは共有するまで、ローカル作業はこのブラウザーに保存されます。",
        "ライブ room は暗号化されたワークスペース更新のみを中継します。",
      ],
    },
    help: {
      title: "ヘルプ",
      description: "ドキュメントから始め、ファイル、アウトライン、コメントが必要なときにサイドパネルを開きます。",
      newDocument: "新しいドキュメントを作成",
      openMarkdown: "Markdown ファイルを開く",
      browseFiles: "ワークスペースのファイルを参照",
      editModes: "編集、分割、プレビューを切り替える",
      share: "共有からライブ共同編集またはエクスポート",
    },
  },
  zh: {
    close: "关闭",
    about: {
      title: "关于 Tabula.md",
      description: "打开 Markdown 文件夹，分享一个链接，即可与他人或 AI 一起编辑。",
      points: [
        "Markdown 文件是工作的基本单位。",
        "在导出或共享之前，本地工作保存在此浏览器中。",
        "实时 room 只中继加密的工作区更新。",
      ],
    },
    help: {
      title: "帮助",
      description: "从文档开始，需要文件、提纲或评论时再打开侧边栏。",
      newDocument: "新建文档",
      openMarkdown: "打开 Markdown 文件",
      browseFiles: "浏览工作区文件",
      editModes: "切换编辑、分栏和预览",
      share: "通过共享进行实时协作或导出",
    },
  },
  es: {
    close: "Cerrar",
    about: {
      title: "Acerca de Tabula.md",
      description: "Abre una carpeta Markdown, comparte un enlace y edita con personas o IA.",
      points: [
        "Los archivos Markdown son la unidad principal de trabajo.",
        "El trabajo local permanece en este navegador hasta que se exporta o comparte.",
        "Las salas en vivo solo retransmiten actualizaciones cifradas.",
      ],
    },
    help: {
      title: "Ayuda",
      description: "Empieza con un documento y abre el panel lateral cuando necesites archivos, esquema o comentarios.",
      newDocument: "Crear un documento",
      openMarkdown: "Abrir un archivo Markdown",
      browseFiles: "Explorar archivos del espacio",
      editModes: "Cambiar entre Edición, División y Vista previa",
      share: "Usar Compartir para colaborar o exportar",
    },
  },
  fr: {
    close: "Fermer",
    about: {
      title: "À propos de Tabula.md",
      description: "Ouvrez un dossier Markdown, partagez un lien et modifiez-le avec des personnes ou une IA.",
      points: [
        "Les fichiers Markdown restent l’unité de travail principale.",
        "Le travail local reste dans ce navigateur jusqu’à son export ou partage.",
        "Les salons en direct relaient uniquement des mises à jour chiffrées.",
      ],
    },
    help: {
      title: "Aide",
      description: "Commencez par un document, puis ouvrez le panneau latéral pour les fichiers, le plan ou les commentaires.",
      newDocument: "Créer un document",
      openMarkdown: "Ouvrir un fichier Markdown",
      browseFiles: "Parcourir les fichiers de l’espace",
      editModes: "Basculer entre Édition, Fractionné et Aperçu",
      share: "Utiliser Partager pour collaborer ou exporter",
    },
  },
  de: {
    close: "Schließen",
    about: {
      title: "Über Tabula.md",
      description: "Öffne einen Markdown-Ordner, teile einen Link und bearbeite ihn gemeinsam mit Menschen oder KI.",
      points: [
        "Markdown-Dateien bleiben die zentrale Arbeitseinheit.",
        "Lokale Arbeit bleibt bis zum Export oder Teilen in diesem Browser.",
        "Live-Räume übertragen nur verschlüsselte Workspace-Updates.",
      ],
    },
    help: {
      title: "Hilfe",
      description: "Beginnen Sie mit einem Dokument und öffnen Sie die Seitenleiste für Dateien, Gliederung oder Kommentare.",
      newDocument: "Neues Dokument erstellen",
      openMarkdown: "Markdown-Datei öffnen",
      browseFiles: "Workspace-Dateien durchsuchen",
      editModes: "Zwischen Bearbeiten, Teilen und Vorschau wechseln",
      share: "Teilen für Zusammenarbeit oder Export verwenden",
    },
  },
};

export const getWorkspaceInfoCopy = (language: WorkspaceLanguage) => copies[language];
