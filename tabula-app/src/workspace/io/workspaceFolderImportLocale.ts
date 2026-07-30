import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";
import type {
  WorkspaceImportEvidence,
  WorkspaceImportEvidenceCode,
  WorkspaceImportLinkSyntax,
  WorkspaceImportProfile,
} from "./workspaceImportProfile";
import type {
  KnowledgeProfileKind,
  LlmWikiArtifactRole,
  LlmWikiRoleBasis,
  WorkspaceConventionProfile,
} from "@tabula-md/tabula";
import type {
  ProfileDetectionConfidence,
} from "./workspaceProfileDetector";

type WorkspaceFolderImportCopy = {
  close: string;
  title: string;
  description: string;
  liveDescription: string;
  contains: (files: number, folders: number) => string;
  paths: string;
  more: (count: number) => string;
  cancel: string;
  open: string;
  connect: string;
  excluded: (count: number) => string;
  excludedPaths: string;
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
  profileKind: (value: KnowledgeProfileKind) => string;
  confidence: (value: ProfileDetectionConfidence) => string;
  profileFileCount: (count: number) => string;
  detectorWarning: (count: number) => string;
  artifactRole: (value: LlmWikiArtifactRole) => string;
  roleBasis: (value: LlmWikiRoleBasis) => string;
};

type RawWorkspaceFolderImportCopy = Omit<
  WorkspaceFolderImportCopy,
  | "confidence"
  | "convention"
  | "evidence"
  | "fileHandling"
  | "format"
  | "linkSyntax"
  | "profileKind"
  | "artifactRole"
  | "roleBasis"
> & {
  formats: Record<"plain-markdown" | "markdown-wiki" | "okf", string>;
  conventionLabels: Record<WorkspaceConventionProfile, string>;
  linkLabels: Record<WorkspaceImportLinkSyntax, string>;
  fileHandling: (preserved: number, ignored: number) => string;
  evidenceLabels: Partial<Record<
    WorkspaceImportEvidenceCode,
    (value: WorkspaceImportEvidence) => string
  >>;
  profileKindLabels: Record<KnowledgeProfileKind, string>;
  confidenceLabels: Record<ProfileDetectionConfidence, string>;
  artifactRoleLabels: Record<LlmWikiArtifactRole, string>;
  roleBasisLabels: Record<LlmWikiRoleBasis, string>;
};

const count = (value: WorkspaceImportEvidence) => value.count ?? 0;

type ProfileUiCopy = Pick<
  RawWorkspaceFolderImportCopy,
  | "confidenceLabels"
  | "detectorWarning"
  | "profileFileCount"
  | "profileKindLabels"
  | "artifactRoleLabels"
  | "roleBasisLabels"
>;

const profileUiCopies: Record<WorkspaceLanguage, ProfileUiCopy> = {
  en: {
    profileKindLabels: { syntax: "Syntax", convention: "Conventions", schema: "Knowledge schema", workflow: "Workflow", "agent-instruction": "Agent instructions", delivery: "Delivery", retrieval: "Retrieval" },
    confidenceLabels: { declared: "Declared", strong: "Detected", heuristic: "Heuristic" },
    profileFileCount: (value) => `${value} ${value === 1 ? "file" : "files"}`,
    detectorWarning: (value) => `${value} profile ${value === 1 ? "check" : "checks"} could not be completed. Files are still preserved.`,
    artifactRoleLabels: { "source-material": "Source material", "compiled-knowledge": "Compiled knowledge", "workflow-rules": "Workflow rules" },
    roleBasisLabels: { explicit: "Explicit rule", heuristic: "Detected from paths" },
  },
  ko: {
    profileKindLabels: { syntax: "문법", convention: "규약", schema: "지식 스키마", workflow: "워크플로", "agent-instruction": "에이전트 지침", delivery: "전달 형식", retrieval: "검색" },
    confidenceLabels: { declared: "명시됨", strong: "감지됨", heuristic: "추정" },
    profileFileCount: (value) => `파일 ${value}개`,
    detectorWarning: (value) => `프로필 검사 ${value}개를 완료하지 못했습니다. 파일은 그대로 보존됩니다.`,
    artifactRoleLabels: { "source-material": "원본 자료", "compiled-knowledge": "컴파일된 지식", "workflow-rules": "워크플로 규칙" },
    roleBasisLabels: { explicit: "명시 규칙", heuristic: "경로에서 추정" },
  },
  ja: {
    profileKindLabels: { syntax: "構文", convention: "規約", schema: "知識スキーマ", workflow: "ワークフロー", "agent-instruction": "エージェント指示", delivery: "配布", retrieval: "検索" },
    confidenceLabels: { declared: "宣言済み", strong: "検出", heuristic: "推定" },
    profileFileCount: (value) => `${value} ファイル`,
    detectorWarning: (value) => `${value} 件のプロファイル検査を完了できませんでした。ファイルは保持されます。`,
    artifactRoleLabels: { "source-material": "ソース資料", "compiled-knowledge": "コンパイル済み知識", "workflow-rules": "ワークフロールール" },
    roleBasisLabels: { explicit: "明示ルール", heuristic: "パスから推定" },
  },
  zh: {
    profileKindLabels: { syntax: "语法", convention: "约定", schema: "知识架构", workflow: "工作流", "agent-instruction": "代理说明", delivery: "交付", retrieval: "检索" },
    confidenceLabels: { declared: "已声明", strong: "已检测", heuristic: "推测" },
    profileFileCount: (value) => `${value} 个文件`,
    detectorWarning: (value) => `${value} 项配置检查未能完成。文件仍会保留。`,
    artifactRoleLabels: { "source-material": "源材料", "compiled-knowledge": "编译知识", "workflow-rules": "工作流规则" },
    roleBasisLabels: { explicit: "显式规则", heuristic: "根据路径推测" },
  },
  es: {
    profileKindLabels: { syntax: "Sintaxis", convention: "Convenciones", schema: "Esquema de conocimiento", workflow: "Flujo de trabajo", "agent-instruction": "Instrucciones del agente", delivery: "Entrega", retrieval: "Recuperación" },
    confidenceLabels: { declared: "Declarado", strong: "Detectado", heuristic: "Heurístico" },
    profileFileCount: (value) => `${value} ${value === 1 ? "archivo" : "archivos"}`,
    detectorWarning: (value) => `No se completaron ${value} comprobaciones de perfil. Los archivos se conservan.`,
    artifactRoleLabels: { "source-material": "Material fuente", "compiled-knowledge": "Conocimiento compilado", "workflow-rules": "Reglas de flujo" },
    roleBasisLabels: { explicit: "Regla explícita", heuristic: "Inferido de rutas" },
  },
  fr: {
    profileKindLabels: { syntax: "Syntaxe", convention: "Conventions", schema: "Schéma de connaissances", workflow: "Flux de travail", "agent-instruction": "Instructions d’agent", delivery: "Livraison", retrieval: "Recherche" },
    confidenceLabels: { declared: "Déclaré", strong: "Détecté", heuristic: "Heuristique" },
    profileFileCount: (value) => `${value} fichier${value === 1 ? "" : "s"}`,
    detectorWarning: (value) => `${value} vérification${value === 1 ? "" : "s"} de profil n’ont pas abouti. Les fichiers restent préservés.`,
    artifactRoleLabels: { "source-material": "Documents source", "compiled-knowledge": "Connaissances compilées", "workflow-rules": "Règles de flux" },
    roleBasisLabels: { explicit: "Règle explicite", heuristic: "Déduit des chemins" },
  },
  de: {
    profileKindLabels: { syntax: "Syntax", convention: "Konventionen", schema: "Wissensschema", workflow: "Arbeitsablauf", "agent-instruction": "Agentenanweisungen", delivery: "Bereitstellung", retrieval: "Abruf" },
    confidenceLabels: { declared: "Deklariert", strong: "Erkannt", heuristic: "Heuristisch" },
    profileFileCount: (value) => `${value} Datei${value === 1 ? "" : "en"}`,
    detectorWarning: (value) => `${value} Profilprüfung${value === 1 ? "" : "en"} konnten nicht abgeschlossen werden. Dateien bleiben erhalten.`,
    artifactRoleLabels: { "source-material": "Quellmaterial", "compiled-knowledge": "Kompiliertes Wissen", "workflow-rules": "Workflow-Regeln" },
    roleBasisLabels: { explicit: "Explizite Regel", heuristic: "Aus Pfaden erkannt" },
  },
};

const getDefaultEvidenceLabel = (value: WorkspaceImportEvidence) => {
  switch (value.code) {
    case "gfm-files":
      return `${count(value)} Markdown ${count(value) === 1 ? "file" : "files"} found.`;
    case "mdx-files":
      return `${count(value)} MDX ${count(value) === 1 ? "file" : "files"} found; source editing is used.`;
    case "raw-wiki-roles":
      return "Separate raw and wiki directory roles were found.";
    case "llm-wiki-source-material":
      return `${count(value)} source material ${count(value) === 1 ? "artifact" : "artifacts"} found.`;
    case "llm-wiki-compiled-knowledge":
      return `${count(value)} agent-maintained knowledge ${count(value) === 1 ? "document" : "documents"} found.`;
    case "llm-wiki-workflow-rules":
      return `${count(value)} workflow ${count(value) === 1 ? "rule artifact" : "rule artifacts"} found.`;
    case "llm-wiki-health-issues":
      return `${count(value)} knowledge health ${count(value) === 1 ? "signal" : "signals"} need review.`;
    case "agents-files":
      return `${count(value)} AGENTS.md ${count(value) === 1 ? "file" : "files"} found.`;
    case "claude-files":
      return `${count(value)} CLAUDE.md ${count(value) === 1 ? "file" : "files"} found.`;
    case "skill-files":
      return `${count(value)} Agent Skill ${count(value) === 1 ? "file" : "files"} found.`;
    case "llms-files":
      return `${count(value)} llms.txt ${count(value) === 1 ? "file" : "files"} found.`;
    case "llms-validation-issues":
      return `${count(value)} llms.txt ${count(value) === 1 ? "issue needs" : "issues need"} review.`;
    case "llms-external-links":
      return `${count(value)} external llms.txt ${count(value) === 1 ? "link" : "links"} found.`;
    default:
      return value.code;
  }
};

const copies: Record<WorkspaceLanguage, RawWorkspaceFolderImportCopy> = {
  en: {
    ...profileUiCopies.en,
    close: "Close folder dialog",
    title: "Open folder",
    description: "Tabula.md saves a copy in this browser and replaces the current local workspace. The original folder is not changed or kept in sync. Markdown documents and recognized workspace metadata are included.",
    liveDescription: "Review the folder before connecting it. After you choose Connect folder, edits in Tabula are written back to this folder and the current browser workspace is replaced.",
    contains: (files, folders) => `${files} ${files === 1 ? "file" : "files"} · ${folders} ${folders === 1 ? "folder" : "folders"}`,
    paths: "Files in this folder",
    more: (value) => `+${value} more`,
    cancel: "Cancel",
    open: "Open folder",
    connect: "Connect folder",
    excluded: (value) => `${value} generated or unreadable ${value === 1 ? "path was" : "paths were"} left outside the connection.`,
    excludedPaths: "Paths not connected",
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
    ...profileUiCopies.ko,
    close: "폴더 창 닫기",
    title: "폴더 열기",
    description: "Tabula.md가 이 브라우저에 사본을 저장하고 현재 로컬 워크스페이스를 대체합니다. 원본 폴더는 변경되거나 동기화되지 않습니다.",
    liveDescription: "연결하기 전에 폴더 내용을 검토하세요. ‘폴더 연결’을 선택하면 Tabula의 편집 내용이 이 폴더에 반영되고 현재 브라우저 워크스페이스를 대체합니다.",
    contains: (files, folders) => `파일 ${files}개 · 폴더 ${folders}개`,
    paths: "이 폴더의 파일",
    more: (value) => `외 ${value}개`,
    cancel: "취소",
    open: "폴더 열기",
    connect: "폴더 연결",
    excluded: (value) => `생성된 항목이거나 읽을 수 없는 경로 ${value}개는 연결하지 않습니다.`,
    excludedPaths: "연결하지 않는 경로",
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
    ...profileUiCopies.ja,
    close: "フォルダーダイアログを閉じる",
    title: "フォルダーを開く",
    description: "Tabula.md はこのブラウザーにコピーを保存し、現在のローカルワークスペースを置き換えます。元のフォルダーは変更も同期もされません。",
    liveDescription: "接続前にフォルダーを確認してください。「フォルダーを接続」を選ぶと、Tabula の編集がこのフォルダーに書き戻されます。",
    contains: (files, folders) => `ファイル ${files} 件 · フォルダー ${folders} 件`,
    paths: "このフォルダーのファイル",
    more: (value) => `ほか ${value} 件`,
    cancel: "キャンセル",
    open: "フォルダーを開く",
    connect: "フォルダーを接続",
    excluded: (value) => `生成済みまたは読み取れない ${value} 件のパスは接続されません。`,
    excludedPaths: "接続しないパス",
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
    ...profileUiCopies.zh,
    close: "关闭文件夹对话框",
    title: "打开文件夹",
    description: "Tabula.md 会在此浏览器中保存副本并替换当前本地工作区。原文件夹不会被修改或保持同步。",
    liveDescription: "连接前请检查文件夹。选择“连接文件夹”后，Tabula 中的编辑会写回此文件夹。",
    contains: (files, folders) => `${files} 个文件 · ${folders} 个文件夹`,
    paths: "此文件夹中的文件",
    more: (value) => `另有 ${value} 个`,
    cancel: "取消",
    open: "打开文件夹",
    connect: "连接文件夹",
    excluded: (value) => `${value} 个生成或无法读取的路径不会连接。`,
    excludedPaths: "未连接的路径",
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
    ...profileUiCopies.es,
    close: "Cerrar diálogo de carpeta",
    title: "Abrir carpeta",
    description: "Tabula.md guarda una copia en este navegador y reemplaza el espacio local actual. La carpeta original no se modifica ni se sincroniza.",
    liveDescription: "Revisa la carpeta antes de conectarla. Al elegir Conectar carpeta, las ediciones de Tabula se guardan en esta carpeta.",
    contains: (files, folders) => `${files} archivos · ${folders} carpetas`,
    paths: "Archivos de esta carpeta",
    more: (value) => `+${value} más`,
    cancel: "Cancelar",
    open: "Abrir carpeta",
    connect: "Conectar carpeta",
    excluded: (value) => `${value} rutas generadas o ilegibles no se conectarán.`,
    excludedPaths: "Rutas no conectadas",
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
    ...profileUiCopies.fr,
    close: "Fermer la boîte de dialogue du dossier",
    title: "Ouvrir un dossier",
    description: "Tabula.md enregistre une copie dans ce navigateur et remplace l’espace local actuel. Le dossier d’origine n’est ni modifié ni synchronisé.",
    liveDescription: "Vérifiez le dossier avant de le connecter. Après Connexion du dossier, les modifications de Tabula y seront enregistrées.",
    contains: (files, folders) => `${files} fichiers · ${folders} dossiers`,
    paths: "Fichiers de ce dossier",
    more: (value) => `+${value} de plus`,
    cancel: "Annuler",
    open: "Ouvrir le dossier",
    connect: "Connecter le dossier",
    excluded: (value) => `${value} chemins générés ou illisibles ne seront pas connectés.`,
    excludedPaths: "Chemins non connectés",
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
    ...profileUiCopies.de,
    close: "Ordnerdialog schließen",
    title: "Ordner öffnen",
    description: "Tabula.md speichert eine Kopie in diesem Browser und ersetzt den aktuellen lokalen Workspace. Der ursprüngliche Ordner wird weder geändert noch synchronisiert.",
    liveDescription: "Prüfe den Ordner vor dem Verbinden. Nach „Ordner verbinden“ schreibt Tabula Änderungen in diesen Ordner zurück.",
    contains: (files, folders) => `${files} Dateien · ${folders} Ordner`,
    paths: "Dateien in diesem Ordner",
    more: (value) => `+${value} weitere`,
    cancel: "Abbrechen",
    open: "Ordner öffnen",
    connect: "Ordner verbinden",
    excluded: (value) => `${value} erzeugte oder nicht lesbare Pfade werden nicht verbunden.`,
    excludedPaths: "Nicht verbundene Pfade",
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
    evidence: (value) =>
      copy.evidenceLabels[value.code]?.(value) ??
      getDefaultEvidenceLabel(value),
    profileKind: (value) => copy.profileKindLabels[value],
    confidence: (value) => copy.confidenceLabels[value],
    profileFileCount: copy.profileFileCount,
    detectorWarning: copy.detectorWarning,
    artifactRole: (value) => copy.artifactRoleLabels[value],
    roleBasis: (value) => copy.roleBasisLabels[value],
  };
};
