import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type {
  WorkspaceImportConvention,
  WorkspaceImportEvidence,
  WorkspaceImportEvidenceCode,
  WorkspaceImportFormat,
  WorkspaceImportLinkSyntax,
  WorkspaceImportProfile,
} from "./workspaceImportProfile";

type WorkspaceFolderImportCopy = {
  close: string;
  title: string;
  description: string;
  summary: (markdown: number, support: number, excluded: number) => string;
  markdownPaths: string;
  supportPaths: string;
  excludedPaths: string;
  supportNote: string;
  replacementWarning: string;
  exportCurrentWorkspace: string;
  cancel: string;
  importAndReplace: string;
  profileLabel: string;
  detected: string;
  conventions: string;
  links: string;
  contents: string;
  format: (profile: WorkspaceImportProfile) => string;
  convention: (value: WorkspaceImportConvention) => string;
  linkSyntax: (value: WorkspaceImportLinkSyntax) => string;
  evidence: (value: WorkspaceImportEvidence) => string;
};

type RawWorkspaceFolderImportCopy = Omit<
  WorkspaceFolderImportCopy,
  "format" | "convention" | "linkSyntax" | "evidence"
> & {
  formats: Record<WorkspaceImportFormat, string>;
  conventionLabels: Record<WorkspaceImportConvention, string>;
  linkLabels: Record<WorkspaceImportLinkSyntax, string>;
  evidenceLabels: Record<
    WorkspaceImportEvidenceCode,
    (value: WorkspaceImportEvidence) => string
  >;
};

const count = (value: WorkspaceImportEvidence) => value.count ?? 0;

const copies: Record<WorkspaceLanguage, RawWorkspaceFolderImportCopy> = {
  en: {
    close: "Close folder import",
    title: "Import folder",
    description: "Tabula.md imports a copy into this browser. The original folder stays separate: later changes in either place are not synchronized.",
    summary: (markdown, support, excluded) =>
      `${markdown} Markdown · ${support} support · ${excluded} excluded`,
    markdownPaths: "Markdown documents",
    supportPaths: "Preserved support files",
    excludedPaths: "Excluded files",
    supportNote: "Recognized files under references/ and workspace metadata are preserved in exports, but are not treated as Markdown documents.",
    replacementWarning: "Importing replaces the current browser workspace, including its documents and comments. Export it first if you may need it again.",
    exportCurrentWorkspace: "Export current workspace",
    cancel: "Cancel",
    importAndReplace: "Import and replace",
    profileLabel: "Detected workspace",
    detected: "Detected",
    conventions: "Conventions",
    links: "Links",
    contents: "Contents",
    formats: {
      "plain-markdown": "Plain Markdown",
      "markdown-wiki": "Markdown wiki",
      okf: "OKF",
    },
    conventionLabels: {
      openwiki: "OpenWiki",
      obsidian: "Obsidian",
    },
    linkLabels: {
      "markdown-links": "Markdown links",
      wikilinks: "Wikilinks",
      embeds: "Embeds",
    },
    evidenceLabels: {
      "okf-version": (value) => `Root index declares OKF ${value.value ?? ""}.`,
      "typed-concepts": (value) => `${count(value)} typed concept ${count(value) === 1 ? "document" : "documents"} found.`,
      "directory-indexes": (value) => `${count(value)} directory ${count(value) === 1 ? "index" : "indexes"} found.`,
      "activity-log": () => "An activity log is present.",
      "openwiki-state": () => "OpenWiki update state is present.",
      "obsidian-config": () => "An Obsidian configuration folder is present.",
      "internal-links": (value) => `${count(value)} internal ${count(value) === 1 ? "link" : "links"} found.`,
      wikilinks: () => "Wikilink syntax is in use.",
    },
  },
  ko: {
    close: "폴더 가져오기 닫기",
    title: "폴더 가져오기",
    description: "Tabula.md가 이 브라우저로 사본을 가져옵니다. 원본 폴더와 브라우저 사본은 서로 분리되며 이후 변경 사항은 동기화되지 않습니다.",
    summary: (markdown, support, excluded) =>
      `Markdown ${markdown}개 · 지원 파일 ${support}개 · 제외 ${excluded}개`,
    markdownPaths: "Markdown 문서",
    supportPaths: "보존할 지원 파일",
    excludedPaths: "제외할 파일",
    supportNote: "references/ 아래의 인식 가능한 파일과 워크스페이스 메타데이터는 내보낼 때 보존되지만 Markdown 문서로 취급하지 않습니다.",
    replacementWarning: "가져오면 문서와 댓글을 포함한 현재 브라우저 워크스페이스를 대체합니다. 다시 필요할 수 있다면 먼저 내보내세요.",
    exportCurrentWorkspace: "현재 워크스페이스 내보내기",
    cancel: "취소",
    importAndReplace: "가져와서 대체",
    profileLabel: "감지된 워크스페이스",
    detected: "감지됨",
    conventions: "관습",
    links: "링크",
    contents: "내용",
    formats: {
      "plain-markdown": "일반 Markdown",
      "markdown-wiki": "Markdown 위키",
      okf: "OKF",
    },
    conventionLabels: {
      openwiki: "OpenWiki",
      obsidian: "Obsidian",
    },
    linkLabels: {
      "markdown-links": "Markdown 링크",
      wikilinks: "위키링크",
      embeds: "임베드",
    },
    evidenceLabels: {
      "okf-version": (value) => `루트 index가 OKF ${value.value ?? ""}을 선언합니다.`,
      "typed-concepts": (value) => `type이 있는 concept 문서 ${count(value)}개를 찾았습니다.`,
      "directory-indexes": (value) => `디렉터리 index ${count(value)}개를 찾았습니다.`,
      "activity-log": () => "활동 log가 있습니다.",
      "openwiki-state": () => "OpenWiki 업데이트 상태 파일이 있습니다.",
      "obsidian-config": () => "Obsidian 설정 폴더가 있습니다.",
      "internal-links": (value) => `내부 링크 ${count(value)}개를 찾았습니다.`,
      wikilinks: () => "위키링크 문법을 사용합니다.",
    },
  },
  ja: {
    close: "フォルダーのインポートを閉じる",
    title: "フォルダーをインポート",
    description: "Tabula.md はこのブラウザーにコピーをインポートします。元のフォルダーとは別に保存され、その後の変更は同期されません。",
    summary: (markdown, support, excluded) => `Markdown ${markdown} 件 · 補助 ${support} 件 · 除外 ${excluded} 件`,
    markdownPaths: "Markdown 文書",
    supportPaths: "保持する補助ファイル",
    excludedPaths: "除外するファイル",
    supportNote: "references/ 内の認識可能なファイルとワークスペースメタデータはエクスポート時に保持されますが、Markdown 文書としては扱われません。",
    replacementWarning: "インポートすると、文書とコメントを含む現在のブラウザーワークスペースが置き換わります。必要な場合は先にエクスポートしてください。",
    exportCurrentWorkspace: "現在のワークスペースをエクスポート",
    cancel: "キャンセル",
    importAndReplace: "インポートして置き換える",
    profileLabel: "検出したワークスペース",
    detected: "検出",
    conventions: "規約",
    links: "リンク",
    contents: "内容",
    formats: { "plain-markdown": "プレーン Markdown", "markdown-wiki": "Markdown Wiki", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Markdown リンク", wikilinks: "Wiki リンク", embeds: "埋め込み" },
    evidenceLabels: {
      "okf-version": (value) => `ルート index が OKF ${value.value ?? ""} を宣言しています。`,
      "typed-concepts": (value) => `type 付き concept 文書を ${count(value)} 件検出しました。`,
      "directory-indexes": (value) => `ディレクトリ index を ${count(value)} 件検出しました。`,
      "activity-log": () => "アクティビティ log があります。",
      "openwiki-state": () => "OpenWiki の更新状態があります。",
      "obsidian-config": () => "Obsidian 設定フォルダーがあります。",
      "internal-links": (value) => `内部リンクを ${count(value)} 件検出しました。`,
      wikilinks: () => "Wiki リンク構文が使われています。",
    },
  },
  zh: {
    close: "关闭文件夹导入",
    title: "导入文件夹",
    description: "Tabula.md 会将副本导入此浏览器。它与原文件夹分开保存，之后的更改不会同步。",
    summary: (markdown, support, excluded) => `${markdown} 个 Markdown · ${support} 个支持文件 · ${excluded} 个已排除`,
    markdownPaths: "Markdown 文档",
    supportPaths: "保留的支持文件",
    excludedPaths: "排除的文件",
    supportNote: "references/ 下可识别的文件和工作区元数据会在导出时保留，但不会被视为 Markdown 文档。",
    replacementWarning: "导入将替换当前浏览器工作区，包括其中的文档和评论。如以后可能需要，请先导出。",
    exportCurrentWorkspace: "导出当前工作区",
    cancel: "取消",
    importAndReplace: "导入并替换",
    profileLabel: "检测到的工作区",
    detected: "检测到",
    conventions: "约定",
    links: "链接",
    contents: "内容",
    formats: { "plain-markdown": "纯 Markdown", "markdown-wiki": "Markdown Wiki", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Markdown 链接", wikilinks: "Wiki 链接", embeds: "嵌入" },
    evidenceLabels: {
      "okf-version": (value) => `根 index 声明 OKF ${value.value ?? ""}。`,
      "typed-concepts": (value) => `发现 ${count(value)} 个带 type 的 concept 文档。`,
      "directory-indexes": (value) => `发现 ${count(value)} 个目录 index。`,
      "activity-log": () => "存在活动 log。",
      "openwiki-state": () => "存在 OpenWiki 更新状态。",
      "obsidian-config": () => "存在 Obsidian 配置文件夹。",
      "internal-links": (value) => `发现 ${count(value)} 个内部链接。`,
      wikilinks: () => "正在使用 Wiki 链接语法。",
    },
  },
  es: {
    close: "Cerrar importación de carpeta",
    title: "Importar carpeta",
    description: "Tabula.md importa una copia en este navegador. Se guarda por separado de la carpeta original y los cambios posteriores no se sincronizan.",
    summary: (markdown, support, excluded) => `${markdown} Markdown · ${support} auxiliares · ${excluded} excluidos`,
    markdownPaths: "Documentos Markdown",
    supportPaths: "Archivos auxiliares conservados",
    excludedPaths: "Archivos excluidos",
    supportNote: "Los archivos reconocidos de references/ y los metadatos del espacio se conservan al exportar, pero no se tratan como documentos Markdown.",
    replacementWarning: "La importación reemplaza el espacio de trabajo actual del navegador, incluidos sus documentos y comentarios. Expórtalo primero si puedes necesitarlo.",
    exportCurrentWorkspace: "Exportar espacio actual",
    cancel: "Cancelar",
    importAndReplace: "Importar y reemplazar",
    profileLabel: "Espacio detectado",
    detected: "Detectado",
    conventions: "Convenciones",
    links: "Enlaces",
    contents: "Contenido",
    formats: { "plain-markdown": "Markdown simple", "markdown-wiki": "Wiki Markdown", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Enlaces Markdown", wikilinks: "Wikilinks", embeds: "Contenido incrustado" },
    evidenceLabels: {
      "okf-version": (value) => `El index raíz declara OKF ${value.value ?? ""}.`,
      "typed-concepts": (value) => `Se encontraron ${count(value)} documentos concept con type.`,
      "directory-indexes": (value) => `Se encontraron ${count(value)} índices de directorio.`,
      "activity-log": () => "Hay un log de actividad.",
      "openwiki-state": () => "Hay un estado de actualización de OpenWiki.",
      "obsidian-config": () => "Hay una carpeta de configuración de Obsidian.",
      "internal-links": (value) => `Se encontraron ${count(value)} enlaces internos.`,
      wikilinks: () => "Se utiliza sintaxis wikilink.",
    },
  },
  fr: {
    close: "Fermer l’importation du dossier",
    title: "Importer un dossier",
    description: "Tabula.md importe une copie dans ce navigateur. Elle reste séparée du dossier d’origine et les modifications ultérieures ne sont pas synchronisées.",
    summary: (markdown, support, excluded) => `${markdown} Markdown · ${support} auxiliaires · ${excluded} exclus`,
    markdownPaths: "Documents Markdown",
    supportPaths: "Fichiers auxiliaires conservés",
    excludedPaths: "Fichiers exclus",
    supportNote: "Les fichiers reconnus dans references/ et les métadonnées de l’espace sont conservés lors de l’export, sans être traités comme des documents Markdown.",
    replacementWarning: "L’importation remplace l’espace de travail actuel du navigateur, y compris ses documents et commentaires. Exportez-le d’abord si vous pourriez en avoir besoin.",
    exportCurrentWorkspace: "Exporter l’espace actuel",
    cancel: "Annuler",
    importAndReplace: "Importer et remplacer",
    profileLabel: "Espace détecté",
    detected: "Détecté",
    conventions: "Conventions",
    links: "Liens",
    contents: "Contenu",
    formats: { "plain-markdown": "Markdown simple", "markdown-wiki": "Wiki Markdown", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Liens Markdown", wikilinks: "Wikilinks", embeds: "Intégrations" },
    evidenceLabels: {
      "okf-version": (value) => `L’index racine déclare OKF ${value.value ?? ""}.`,
      "typed-concepts": (value) => `${count(value)} documents concept avec type détectés.`,
      "directory-indexes": (value) => `${count(value)} index de répertoire détectés.`,
      "activity-log": () => "Un log d’activité est présent.",
      "openwiki-state": () => "Un état de mise à jour OpenWiki est présent.",
      "obsidian-config": () => "Un dossier de configuration Obsidian est présent.",
      "internal-links": (value) => `${count(value)} liens internes détectés.`,
      wikilinks: () => "La syntaxe wikilink est utilisée.",
    },
  },
  de: {
    close: "Ordnerimport schließen",
    title: "Ordner importieren",
    description: "Tabula.md importiert eine Kopie in diesen Browser. Sie bleibt vom ursprünglichen Ordner getrennt; spätere Änderungen werden nicht synchronisiert.",
    summary: (markdown, support, excluded) => `${markdown} Markdown · ${support} Zusatzdateien · ${excluded} ausgeschlossen`,
    markdownPaths: "Markdown-Dokumente",
    supportPaths: "Erhaltene Zusatzdateien",
    excludedPaths: "Ausgeschlossene Dateien",
    supportNote: "Erkannte Dateien unter references/ und Workspace-Metadaten bleiben beim Export erhalten, werden aber nicht als Markdown-Dokumente behandelt.",
    replacementWarning: "Der Import ersetzt den aktuellen Browser-Workspace einschließlich Dokumenten und Kommentaren. Exportieren Sie ihn zuerst, falls Sie ihn noch benötigen.",
    exportCurrentWorkspace: "Aktuellen Workspace exportieren",
    cancel: "Abbrechen",
    importAndReplace: "Importieren und ersetzen",
    profileLabel: "Erkannter Workspace",
    detected: "Erkannt",
    conventions: "Konventionen",
    links: "Links",
    contents: "Inhalt",
    formats: { "plain-markdown": "Einfaches Markdown", "markdown-wiki": "Markdown-Wiki", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Markdown-Links", wikilinks: "Wikilinks", embeds: "Einbettungen" },
    evidenceLabels: {
      "okf-version": (value) => `Der Root-Index deklariert OKF ${value.value ?? ""}.`,
      "typed-concepts": (value) => `${count(value)} Concept-Dokumente mit type gefunden.`,
      "directory-indexes": (value) => `${count(value)} Verzeichnis-Indexes gefunden.`,
      "activity-log": () => "Ein Aktivitäts-log ist vorhanden.",
      "openwiki-state": () => "Ein OpenWiki-Aktualisierungsstatus ist vorhanden.",
      "obsidian-config": () => "Ein Obsidian-Konfigurationsordner ist vorhanden.",
      "internal-links": (value) => `${count(value)} interne Links gefunden.`,
      wikilinks: () => "Wikilink-Syntax wird verwendet.",
    },
  },
};

export const getWorkspaceFolderImportCopy = (
  language: WorkspaceLanguage,
): WorkspaceFolderImportCopy => {
  const copy = copies[language];
  return {
    ...copy,
    format: (profile) => profile.format === "okf" && profile.okfVersion
      ? `OKF ${profile.okfVersion}`
      : copy.formats[profile.format],
    convention: (value) => copy.conventionLabels[value],
    linkSyntax: (value) => copy.linkLabels[value],
    evidence: (value) => copy.evidenceLabels[value.code](value),
  };
};
