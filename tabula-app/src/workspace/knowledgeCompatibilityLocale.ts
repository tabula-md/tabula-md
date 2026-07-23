import type {
  OkfCompatibilityIssue,
  OkfCompatibilityIssueCode,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";

type KnowledgeCompatibilityMessages = {
  open: string;
  back: string;
  title: string;
  description: string;
  unchanged: string;
  unavailable: string;
  noDocuments: string;
  compatible: string;
  requiredChange: string;
  requiredChanges: string;
  portabilityWarning: string;
  portabilityWarnings: string;
  requiredSection: string;
  warningSection: string;
  openDocument: string;
  issues: Record<OkfCompatibilityIssueCode, string>;
};

export type KnowledgeCompatibilityCopy = {
  open: string;
  back: string;
  title: string;
  description: string;
  unchanged: string;
  unavailable: string;
  noDocuments: string;
  compatible: (version: string) => string;
  requiredChanges: (count: number) => string;
  portabilityWarnings: (count: number) => string;
  requiredSection: string;
  warningSection: string;
  openDocument: (path: string) => string;
  issue: (issue: OkfCompatibilityIssue) => string;
};

const enIssues: Record<OkfCompatibilityIssueCode, string> = {
  concept_frontmatter_missing: "Add YAML frontmatter",
  concept_frontmatter_invalid: "Fix invalid YAML frontmatter",
  concept_type_missing: "Add a non-empty type",
  concept_type_invalid: "Make type a string",
  reserved_frontmatter_invalid: "Fix invalid YAML frontmatter",
  reserved_frontmatter_not_allowed: "Remove frontmatter from this reserved file",
  root_index_version_invalid: "Set okf_version in the root index.md",
  root_index_extra_metadata: "Keep only okf_version in the root index.md",
  unsupported_okf_version: "Unsupported OKF version: {{value}}",
  index_structure_invalid: "Add an H1 section to this index",
  log_structure_invalid: "Add an H1 title and dated H2 entries to this log",
  log_date_invalid: "Use YYYY-MM-DD for the log date: {{value}}",
  log_dates_out_of_order: "Put the newest log date first",
  nonstandard_markdown_extension: "Rename this file to use the .md extension",
  wikilink_syntax: "Use Markdown links for OKF portability",
};

const copies: Record<WorkspaceLanguage, KnowledgeCompatibilityMessages> = {
  en: {
    open: "Check knowledge base compatibility",
    back: "Back to workspace files",
    title: "Knowledge base compatibility",
    description: "Checks this Markdown workspace against the Open Knowledge Format.",
    unchanged: "This check does not change your files.",
    unavailable: "Resolve file path conflicts to run this check.",
    noDocuments: "No Markdown documents to check",
    compatible: "Compatible with OKF {{version}}",
    requiredChange: "{{count}} required change",
    requiredChanges: "{{count}} required changes",
    portabilityWarning: "{{count}} portability warning",
    portabilityWarnings: "{{count}} portability warnings",
    requiredSection: "Required changes",
    warningSection: "Portability warnings",
    openDocument: "Open {{path}}",
    issues: enIssues,
  },
  ko: {
    open: "지식베이스 호환성 검사",
    back: "워크스페이스 파일로 돌아가기",
    title: "지식베이스 호환성",
    description: "현재 Markdown 워크스페이스를 Open Knowledge Format 기준으로 검사합니다.",
    unchanged: "검사 과정에서 파일을 변경하지 않습니다.",
    unavailable: "파일 경로 충돌을 해결하면 검사를 실행할 수 있습니다.",
    noDocuments: "검사할 Markdown 문서가 없습니다",
    compatible: "OKF {{version}} 호환",
    requiredChange: "필수 수정 {{count}}개",
    requiredChanges: "필수 수정 {{count}}개",
    portabilityWarning: "이식성 경고 {{count}}개",
    portabilityWarnings: "이식성 경고 {{count}}개",
    requiredSection: "필수 수정",
    warningSection: "이식성 경고",
    openDocument: "{{path}} 열기",
    issues: {
      concept_frontmatter_missing: "YAML frontmatter 추가",
      concept_frontmatter_invalid: "잘못된 YAML frontmatter 수정",
      concept_type_missing: "비어 있지 않은 type 추가",
      concept_type_invalid: "type을 문자열로 변경",
      reserved_frontmatter_invalid: "잘못된 YAML frontmatter 수정",
      reserved_frontmatter_not_allowed: "예약 파일에서 frontmatter 제거",
      root_index_version_invalid: "루트 index.md에 okf_version 설정",
      root_index_extra_metadata: "루트 index.md에는 okf_version만 유지",
      unsupported_okf_version: "지원하지 않는 OKF 버전: {{value}}",
      index_structure_invalid: "index에 H1 섹션 추가",
      log_structure_invalid: "log에 H1 제목과 날짜별 H2 항목 추가",
      log_date_invalid: "log 날짜를 YYYY-MM-DD로 변경: {{value}}",
      log_dates_out_of_order: "최신 log 날짜를 먼저 배치",
      nonstandard_markdown_extension: "파일 확장자를 .md로 변경",
      wikilink_syntax: "OKF 이식성을 위해 Markdown 링크 사용",
    },
  },
  ja: {
    open: "ナレッジベースの互換性を確認",
    back: "ワークスペースファイルに戻る",
    title: "ナレッジベースの互換性",
    description: "この Markdown ワークスペースを Open Knowledge Format に照らして確認します。",
    unchanged: "この確認でファイルは変更されません。",
    unavailable: "ファイルパスの競合を解消すると確認できます。",
    noDocuments: "確認する Markdown ドキュメントがありません",
    compatible: "OKF {{version}} と互換",
    requiredChange: "必須の変更 {{count}} 件",
    requiredChanges: "必須の変更 {{count}} 件",
    portabilityWarning: "移植性の警告 {{count}} 件",
    portabilityWarnings: "移植性の警告 {{count}} 件",
    requiredSection: "必須の変更",
    warningSection: "移植性の警告",
    openDocument: "{{path}} を開く",
    issues: {
      concept_frontmatter_missing: "YAML frontmatter を追加",
      concept_frontmatter_invalid: "不正な YAML frontmatter を修正",
      concept_type_missing: "空でない type を追加",
      concept_type_invalid: "type を文字列に変更",
      reserved_frontmatter_invalid: "不正な YAML frontmatter を修正",
      reserved_frontmatter_not_allowed: "予約ファイルから frontmatter を削除",
      root_index_version_invalid: "ルート index.md に okf_version を設定",
      root_index_extra_metadata: "ルート index.md は okf_version のみにする",
      unsupported_okf_version: "未対応の OKF バージョン: {{value}}",
      index_structure_invalid: "index に H1 セクションを追加",
      log_structure_invalid: "log に H1 タイトルと日付別 H2 項目を追加",
      log_date_invalid: "log の日付を YYYY-MM-DD にする: {{value}}",
      log_dates_out_of_order: "最新の log 日付を先頭にする",
      nonstandard_markdown_extension: "拡張子を .md に変更",
      wikilink_syntax: "OKF の移植性のため Markdown リンクを使用",
    },
  },
  zh: {
    open: "检查知识库兼容性",
    back: "返回工作区文件",
    title: "知识库兼容性",
    description: "按照 Open Knowledge Format 检查此 Markdown 工作区。",
    unchanged: "此检查不会更改文件。",
    unavailable: "解决文件路径冲突后即可运行检查。",
    noDocuments: "没有可检查的 Markdown 文档",
    compatible: "兼容 OKF {{version}}",
    requiredChange: "{{count}} 项必需修改",
    requiredChanges: "{{count}} 项必需修改",
    portabilityWarning: "{{count}} 项可移植性警告",
    portabilityWarnings: "{{count}} 项可移植性警告",
    requiredSection: "必需修改",
    warningSection: "可移植性警告",
    openDocument: "打开 {{path}}",
    issues: {
      concept_frontmatter_missing: "添加 YAML frontmatter",
      concept_frontmatter_invalid: "修复无效的 YAML frontmatter",
      concept_type_missing: "添加非空 type",
      concept_type_invalid: "将 type 改为字符串",
      reserved_frontmatter_invalid: "修复无效的 YAML frontmatter",
      reserved_frontmatter_not_allowed: "从保留文件中移除 frontmatter",
      root_index_version_invalid: "在根 index.md 中设置 okf_version",
      root_index_extra_metadata: "根 index.md 中只保留 okf_version",
      unsupported_okf_version: "不支持的 OKF 版本：{{value}}",
      index_structure_invalid: "为 index 添加 H1 章节",
      log_structure_invalid: "为 log 添加 H1 标题和按日期分组的 H2 条目",
      log_date_invalid: "将 log 日期改为 YYYY-MM-DD：{{value}}",
      log_dates_out_of_order: "将最新 log 日期放在最前",
      nonstandard_markdown_extension: "将文件扩展名改为 .md",
      wikilink_syntax: "为确保 OKF 可移植性，请使用 Markdown 链接",
    },
  },
  es: {
    open: "Comprobar compatibilidad de la base de conocimiento",
    back: "Volver a los archivos del espacio",
    title: "Compatibilidad de la base de conocimiento",
    description: "Comprueba este espacio Markdown con Open Knowledge Format.",
    unchanged: "La comprobación no modifica los archivos.",
    unavailable: "Resuelve los conflictos de rutas para ejecutar la comprobación.",
    noDocuments: "No hay documentos Markdown que comprobar",
    compatible: "Compatible con OKF {{version}}",
    requiredChange: "{{count}} cambio obligatorio",
    requiredChanges: "{{count}} cambios obligatorios",
    portabilityWarning: "{{count}} aviso de portabilidad",
    portabilityWarnings: "{{count}} avisos de portabilidad",
    requiredSection: "Cambios obligatorios",
    warningSection: "Avisos de portabilidad",
    openDocument: "Abrir {{path}}",
    issues: {
      concept_frontmatter_missing: "Añadir frontmatter YAML",
      concept_frontmatter_invalid: "Corregir el frontmatter YAML no válido",
      concept_type_missing: "Añadir un type no vacío",
      concept_type_invalid: "Convertir type en una cadena",
      reserved_frontmatter_invalid: "Corregir el frontmatter YAML no válido",
      reserved_frontmatter_not_allowed: "Quitar el frontmatter de este archivo reservado",
      root_index_version_invalid: "Definir okf_version en el index.md raíz",
      root_index_extra_metadata: "Conservar solo okf_version en el index.md raíz",
      unsupported_okf_version: "Versión de OKF no compatible: {{value}}",
      index_structure_invalid: "Añadir una sección H1 a este index",
      log_structure_invalid: "Añadir un título H1 y entradas H2 fechadas al log",
      log_date_invalid: "Usar YYYY-MM-DD para la fecha del log: {{value}}",
      log_dates_out_of_order: "Poner primero la fecha más reciente del log",
      nonstandard_markdown_extension: "Cambiar la extensión del archivo a .md",
      wikilink_syntax: "Usar enlaces Markdown para la portabilidad de OKF",
    },
  },
  fr: {
    open: "Vérifier la compatibilité de la base de connaissances",
    back: "Revenir aux fichiers de l’espace",
    title: "Compatibilité de la base de connaissances",
    description: "Vérifie cet espace Markdown selon l’Open Knowledge Format.",
    unchanged: "Cette vérification ne modifie pas les fichiers.",
    unavailable: "Résolvez les conflits de chemins pour lancer la vérification.",
    noDocuments: "Aucun document Markdown à vérifier",
    compatible: "Compatible avec OKF {{version}}",
    requiredChange: "{{count}} modification requise",
    requiredChanges: "{{count}} modifications requises",
    portabilityWarning: "{{count}} avertissement de portabilité",
    portabilityWarnings: "{{count}} avertissements de portabilité",
    requiredSection: "Modifications requises",
    warningSection: "Avertissements de portabilité",
    openDocument: "Ouvrir {{path}}",
    issues: {
      concept_frontmatter_missing: "Ajouter un frontmatter YAML",
      concept_frontmatter_invalid: "Corriger le frontmatter YAML invalide",
      concept_type_missing: "Ajouter un type non vide",
      concept_type_invalid: "Définir type comme chaîne",
      reserved_frontmatter_invalid: "Corriger le frontmatter YAML invalide",
      reserved_frontmatter_not_allowed: "Supprimer le frontmatter de ce fichier réservé",
      root_index_version_invalid: "Définir okf_version dans le index.md racine",
      root_index_extra_metadata: "Ne garder que okf_version dans le index.md racine",
      unsupported_okf_version: "Version OKF non prise en charge : {{value}}",
      index_structure_invalid: "Ajouter une section H1 à cet index",
      log_structure_invalid: "Ajouter un titre H1 et des entrées H2 datées au log",
      log_date_invalid: "Utiliser YYYY-MM-DD pour la date du log : {{value}}",
      log_dates_out_of_order: "Placer la date de log la plus récente en premier",
      nonstandard_markdown_extension: "Utiliser l’extension .md pour ce fichier",
      wikilink_syntax: "Utiliser des liens Markdown pour la portabilité OKF",
    },
  },
  de: {
    open: "Kompatibilität der Wissensbasis prüfen",
    back: "Zurück zu den Workspace-Dateien",
    title: "Kompatibilität der Wissensbasis",
    description: "Prüft diesen Markdown-Workspace gegen das Open Knowledge Format.",
    unchanged: "Die Prüfung verändert keine Dateien.",
    unavailable: "Lösen Sie Pfadkonflikte, um die Prüfung auszuführen.",
    noDocuments: "Keine Markdown-Dokumente zum Prüfen",
    compatible: "Kompatibel mit OKF {{version}}",
    requiredChange: "{{count}} erforderliche Änderung",
    requiredChanges: "{{count}} erforderliche Änderungen",
    portabilityWarning: "{{count}} Portabilitätswarnung",
    portabilityWarnings: "{{count}} Portabilitätswarnungen",
    requiredSection: "Erforderliche Änderungen",
    warningSection: "Portabilitätswarnungen",
    openDocument: "{{path}} öffnen",
    issues: {
      concept_frontmatter_missing: "YAML-Frontmatter hinzufügen",
      concept_frontmatter_invalid: "Ungültiges YAML-Frontmatter korrigieren",
      concept_type_missing: "Einen nicht leeren type hinzufügen",
      concept_type_invalid: "type als Zeichenfolge angeben",
      reserved_frontmatter_invalid: "Ungültiges YAML-Frontmatter korrigieren",
      reserved_frontmatter_not_allowed: "Frontmatter aus dieser reservierten Datei entfernen",
      root_index_version_invalid: "okf_version in der root index.md setzen",
      root_index_extra_metadata: "In der root index.md nur okf_version behalten",
      unsupported_okf_version: "Nicht unterstützte OKF-Version: {{value}}",
      index_structure_invalid: "Diesem index einen H1-Abschnitt hinzufügen",
      log_structure_invalid: "Dem log einen H1-Titel und datierte H2-Einträge hinzufügen",
      log_date_invalid: "Für das log-Datum YYYY-MM-DD verwenden: {{value}}",
      log_dates_out_of_order: "Das neueste log-Datum zuerst setzen",
      nonstandard_markdown_extension: "Die Dateiendung in .md ändern",
      wikilink_syntax: "Für OKF-Portabilität Markdown-Links verwenden",
    },
  },
};

const formatMessage = (
  template: string,
  values: Record<string, string | number>,
) => Object.entries(values).reduce(
  (result, [key, value]) => result.split(`{{${key}}}`).join(String(value)),
  template,
);

export const getKnowledgeCompatibilityCopy = (
  language: WorkspaceLanguage,
): KnowledgeCompatibilityCopy => {
  const copy = copies[language];
  return {
    open: copy.open,
    back: copy.back,
    title: copy.title,
    description: copy.description,
    unchanged: copy.unchanged,
    unavailable: copy.unavailable,
    noDocuments: copy.noDocuments,
    compatible: (version) => formatMessage(copy.compatible, { version }),
    requiredChanges: (count) => formatMessage(
      count === 1 ? copy.requiredChange : copy.requiredChanges,
      { count },
    ),
    portabilityWarnings: (count) => formatMessage(
      count === 1 ? copy.portabilityWarning : copy.portabilityWarnings,
      { count },
    ),
    requiredSection: copy.requiredSection,
    warningSection: copy.warningSection,
    openDocument: (path) => formatMessage(copy.openDocument, { path }),
    issue: (issue) => formatMessage(copy.issues[issue.code], {
      value: issue.value ?? "",
    }),
  };
};
