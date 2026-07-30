import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type {
  WorkspaceImportEvidence,
  WorkspaceImportEvidenceCode,
  WorkspaceImportLinkSyntax,
  WorkspaceImportProfile,
} from "./workspaceImportProfile";
import type {
  WorkspaceConventionProfile,
} from "@tabula-md/tabula";

type WorkspaceFolderImportCopy = {
  close: string;
  title: string;
  description: string;
  contains: (files: number, folders: number) => string;
  paths: string;
  more: (count: number) => string;
  cancel: string;
  open: string;
  profileLabel: string;
  detected: string;
  conventions: string;
  links: string;
  files: string;
  format: (profile: WorkspaceImportProfile) => string;
  convention: (value: WorkspaceConventionProfile) => string;
  linkSyntax: (value: WorkspaceImportLinkSyntax) => string;
  fileHandling: (preserved: number, ignored: number) => string;
  evidence: (value: WorkspaceImportEvidence) => string;
};

type RawWorkspaceFolderImportCopy = Omit<
  WorkspaceFolderImportCopy,
  "format" | "convention" | "linkSyntax" | "fileHandling" | "evidence"
> & {
  formats: Record<"plain-markdown" | "markdown-wiki" | "okf", string>;
  conventionLabels: Record<WorkspaceConventionProfile, string>;
  linkLabels: Record<WorkspaceImportLinkSyntax, string>;
  fileHandling: (preserved: number, ignored: number) => string;
  evidenceLabels: Record<
    WorkspaceImportEvidenceCode,
    (value: WorkspaceImportEvidence) => string
  >;
};

const count = (value: WorkspaceImportEvidence) => value.count ?? 0;

const copies: Record<WorkspaceLanguage, RawWorkspaceFolderImportCopy> = {
  en: {
    close: "Close folder dialog",
    title: "Open folder",
    description: "Tabula.md saves a copy in this browser and replaces the current local workspace. The original folder is not changed or kept in sync. Markdown documents and recognized workspace metadata are included.",
    contains: (files, folders) => `${files} ${files === 1 ? "file" : "files"} · ${folders} ${folders === 1 ? "folder" : "folders"}`,
    paths: "Files in this folder",
    more: (value) => `+${value} more`,
    cancel: "Cancel",
    open: "Open folder",
    profileLabel: "Detected workspace",
    detected: "Detected",
    conventions: "Conventions",
    links: "Links",
    files: "Import",
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
    fileHandling: (preserved, ignored) => [
      preserved === 1 ? "1 support file preserved" : `${preserved} support files preserved`,
      ignored === 1 ? "1 unsupported file skipped" : `${ignored} unsupported files skipped`,
    ].join(". "),
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
    close: "폴더 창 닫기",
    title: "폴더 열기",
    description: "Tabula.md가 이 브라우저에 사본을 저장하고 현재 로컬 워크스페이스를 대체합니다. 원본 폴더는 변경되거나 동기화되지 않습니다.",
    contains: (files, folders) => `파일 ${files}개 · 폴더 ${folders}개`,
    paths: "이 폴더의 파일",
    more: (value) => `외 ${value}개`,
    cancel: "취소",
    open: "폴더 열기",
    profileLabel: "감지된 워크스페이스",
    detected: "감지됨",
    conventions: "관습",
    links: "링크",
    files: "가져오기",
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
    fileHandling: (preserved, ignored) =>
      `지원 파일 ${preserved}개 보존. 지원하지 않는 파일 ${ignored}개 제외`,
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
    close: "フォルダーダイアログを閉じる",
    title: "フォルダーを開く",
    description: "Tabula.md はこのブラウザーにコピーを保存し、現在のローカルワークスペースを置き換えます。元のフォルダーは変更も同期もされません。",
    contains: (files, folders) => `ファイル ${files} 件 · フォルダー ${folders} 件`,
    paths: "このフォルダーのファイル",
    more: (value) => `ほか ${value} 件`,
    cancel: "キャンセル",
    open: "フォルダーを開く",
    profileLabel: "検出したワークスペース",
    detected: "検出",
    conventions: "規約",
    links: "リンク",
    files: "読み込み",
    formats: { "plain-markdown": "プレーン Markdown", "markdown-wiki": "Markdown Wiki", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Markdown リンク", wikilinks: "Wiki リンク", embeds: "埋め込み" },
    fileHandling: (preserved, ignored) => `補助ファイル ${preserved} 件を保持。未対応ファイル ${ignored} 件を除外`,
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
    close: "关闭文件夹对话框",
    title: "打开文件夹",
    description: "Tabula.md 会在此浏览器中保存副本并替换当前本地工作区。原文件夹不会被修改或保持同步。",
    contains: (files, folders) => `${files} 个文件 · ${folders} 个文件夹`,
    paths: "此文件夹中的文件",
    more: (value) => `另有 ${value} 个`,
    cancel: "取消",
    open: "打开文件夹",
    profileLabel: "检测到的工作区",
    detected: "检测到",
    conventions: "约定",
    links: "链接",
    files: "导入",
    formats: { "plain-markdown": "纯 Markdown", "markdown-wiki": "Markdown Wiki", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Markdown 链接", wikilinks: "Wiki 链接", embeds: "嵌入" },
    fileHandling: (preserved, ignored) => `保留 ${preserved} 个支持文件。跳过 ${ignored} 个不支持的文件`,
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
    close: "Cerrar diálogo de carpeta",
    title: "Abrir carpeta",
    description: "Tabula.md guarda una copia en este navegador y reemplaza el espacio local actual. La carpeta original no se modifica ni se sincroniza.",
    contains: (files, folders) => `${files} archivos · ${folders} carpetas`,
    paths: "Archivos de esta carpeta",
    more: (value) => `+${value} más`,
    cancel: "Cancelar",
    open: "Abrir carpeta",
    profileLabel: "Espacio detectado",
    detected: "Detectado",
    conventions: "Convenciones",
    links: "Enlaces",
    files: "Importación",
    formats: { "plain-markdown": "Markdown simple", "markdown-wiki": "Wiki Markdown", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Enlaces Markdown", wikilinks: "Wikilinks", embeds: "Contenido incrustado" },
    fileHandling: (preserved, ignored) => `${preserved} archivos auxiliares conservados. ${ignored} archivos no compatibles omitidos`,
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
    close: "Fermer la boîte de dialogue du dossier",
    title: "Ouvrir un dossier",
    description: "Tabula.md enregistre une copie dans ce navigateur et remplace l’espace local actuel. Le dossier d’origine n’est ni modifié ni synchronisé.",
    contains: (files, folders) => `${files} fichiers · ${folders} dossiers`,
    paths: "Fichiers de ce dossier",
    more: (value) => `+${value} de plus`,
    cancel: "Annuler",
    open: "Ouvrir le dossier",
    profileLabel: "Espace détecté",
    detected: "Détecté",
    conventions: "Conventions",
    links: "Liens",
    files: "Importation",
    formats: { "plain-markdown": "Markdown simple", "markdown-wiki": "Wiki Markdown", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Liens Markdown", wikilinks: "Wikilinks", embeds: "Intégrations" },
    fileHandling: (preserved, ignored) => `${preserved} fichiers auxiliaires conservés. ${ignored} fichiers non pris en charge ignorés`,
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
    close: "Ordnerdialog schließen",
    title: "Ordner öffnen",
    description: "Tabula.md speichert eine Kopie in diesem Browser und ersetzt den aktuellen lokalen Workspace. Der ursprüngliche Ordner wird weder geändert noch synchronisiert.",
    contains: (files, folders) => `${files} Dateien · ${folders} Ordner`,
    paths: "Dateien in diesem Ordner",
    more: (value) => `+${value} weitere`,
    cancel: "Abbrechen",
    open: "Ordner öffnen",
    profileLabel: "Erkannter Workspace",
    detected: "Erkannt",
    conventions: "Konventionen",
    links: "Links",
    files: "Import",
    formats: { "plain-markdown": "Einfaches Markdown", "markdown-wiki": "Markdown-Wiki", okf: "OKF" },
    conventionLabels: { openwiki: "OpenWiki", obsidian: "Obsidian" },
    linkLabels: { "markdown-links": "Markdown-Links", wikilinks: "Wikilinks", embeds: "Einbettungen" },
    fileHandling: (preserved, ignored) => `${preserved} Zusatzdateien erhalten. ${ignored} nicht unterstützte Dateien übersprungen`,
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
    format: (profile) => {
      const okf = profile.schemas.find((schema) => schema.id === "okf");
      if (okf) return `OKF ${okf.version}`;
      return profile.conventions.length > 0 || profile.workflows.length > 0
        ? copy.formats["markdown-wiki"]
        : copy.formats["plain-markdown"];
    },
    convention: (value) => copy.conventionLabels[value],
    linkSyntax: (value) => copy.linkLabels[value],
    fileHandling: copy.fileHandling,
    evidence: (value) => copy.evidenceLabels[value.code](value),
  };
};
