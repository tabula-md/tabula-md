import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

export type WorkspaceImportResultCopy = {
  close: string;
  title: string;
  description: (version: string) => string;
  importedSummary: (conceptCount: number, issueCount: number) => string;
  format: string;
  concepts: string;
  directoryIndexes: string;
  activityLog: string;
  present: string;
  missing: string;
  supportFiles: string;
  excludedFiles: string;
  requiredFixes: string;
  healthAttention: string;
  v02Guidance: string;
  openRootIndex: string;
  showDetails: string;
  hideDetails: string;
  detailsLabel: string;
  preservedPaths: string;
  excludedPaths: string;
  noPaths: string;
  dismiss: string;
};

const copies: Record<WorkspaceLanguage, WorkspaceImportResultCopy> = {
  en: {
    close: "Close import result",
    title: "OKF workspace imported",
    description: (version) =>
      `Tabula imported a separate browser copy and detected OKF ${version}.`,
    importedSummary: (conceptCount, issueCount) =>
      issueCount > 0
        ? `${conceptCount} OKF concepts imported · ${issueCount} issues`
        : `${conceptCount} OKF concepts imported`,
    format: "Detected format",
    concepts: "Concepts",
    directoryIndexes: "Directory indexes",
    activityLog: "Activity log",
    present: "Present",
    missing: "Missing",
    supportFiles: "Support files preserved",
    excludedFiles: "Files excluded",
    requiredFixes: "Required compatibility fixes",
    healthAttention: "Knowledge health attention",
    v02Guidance:
      "This workspace declares OKF 0.1. OKF 0.2 metadata and lifecycle practices may require compatibility changes.",
    openRootIndex: "Open root index",
    showDetails: "Import details",
    hideDetails: "Hide import details",
    detailsLabel: "Import details",
    preservedPaths: "Preserved support files",
    excludedPaths: "Excluded files",
    noPaths: "None",
    dismiss: "Close",
  },
  ko: {
    close: "가져오기 결과 닫기",
    title: "OKF 워크스페이스를 가져왔습니다",
    description: (version) =>
      `Tabula가 분리된 브라우저 사본을 만들고 OKF ${version}을 감지했습니다.`,
    importedSummary: (conceptCount, issueCount) =>
      issueCount > 0
        ? `OKF concept ${conceptCount}개를 가져왔습니다 · 문제 ${issueCount}개`
        : `OKF concept ${conceptCount}개를 가져왔습니다`,
    format: "감지된 형식",
    concepts: "Concept",
    directoryIndexes: "디렉터리 index",
    activityLog: "활동 log",
    present: "있음",
    missing: "없음",
    supportFiles: "보존한 지원 파일",
    excludedFiles: "제외한 파일",
    requiredFixes: "필수 호환성 수정",
    healthAttention: "지식 상태 확인 필요",
    v02Guidance:
      "이 워크스페이스는 OKF 0.1을 선언합니다. OKF 0.2 메타데이터와 생명주기 관행을 사용하려면 호환성 수정이 필요할 수 있습니다.",
    openRootIndex: "루트 index 열기",
    showDetails: "가져오기 세부사항",
    hideDetails: "가져오기 세부사항 숨기기",
    detailsLabel: "가져오기 세부사항",
    preservedPaths: "보존한 지원 파일",
    excludedPaths: "제외한 파일",
    noPaths: "없음",
    dismiss: "닫기",
  },
  ja: {
    close: "インポート結果を閉じる",
    title: "OKF ワークスペースをインポートしました",
    description: (version) =>
      `Tabula は別のブラウザーコピーを作成し、OKF ${version} を検出しました。`,
    importedSummary: (conceptCount, issueCount) =>
      issueCount > 0
        ? `${conceptCount} 件の OKF concept をインポート · 問題 ${issueCount} 件`
        : `${conceptCount} 件の OKF concept をインポート`,
    format: "検出形式",
    concepts: "Concept",
    directoryIndexes: "ディレクトリ index",
    activityLog: "アクティビティ log",
    present: "あり",
    missing: "なし",
    supportFiles: "保持した補助ファイル",
    excludedFiles: "除外したファイル",
    requiredFixes: "必須の互換性修正",
    healthAttention: "ナレッジ状態の要確認",
    v02Guidance:
      "このワークスペースは OKF 0.1 を宣言しています。OKF 0.2 のメタデータとライフサイクル運用には互換性の調整が必要な場合があります。",
    openRootIndex: "ルート index を開く",
    showDetails: "インポートの詳細",
    hideDetails: "詳細を隠す",
    detailsLabel: "インポートの詳細",
    preservedPaths: "保持した補助ファイル",
    excludedPaths: "除外したファイル",
    noPaths: "なし",
    dismiss: "閉じる",
  },
  zh: {
    close: "关闭导入结果",
    title: "已导入 OKF 工作区",
    description: (version) =>
      `Tabula 创建了独立的浏览器副本，并检测到 OKF ${version}。`,
    importedSummary: (conceptCount, issueCount) =>
      issueCount > 0
        ? `已导入 ${conceptCount} 个 OKF concept · ${issueCount} 个问题`
        : `已导入 ${conceptCount} 个 OKF concept`,
    format: "检测格式",
    concepts: "Concept",
    directoryIndexes: "目录 index",
    activityLog: "活动 log",
    present: "存在",
    missing: "缺失",
    supportFiles: "保留的支持文件",
    excludedFiles: "排除的文件",
    requiredFixes: "必须修复的兼容性问题",
    healthAttention: "知识状态待检查",
    v02Guidance:
      "此工作区声明 OKF 0.1。使用 OKF 0.2 元数据和生命周期实践可能需要兼容性调整。",
    openRootIndex: "打开根 index",
    showDetails: "导入详情",
    hideDetails: "隐藏导入详情",
    detailsLabel: "导入详情",
    preservedPaths: "保留的支持文件",
    excludedPaths: "排除的文件",
    noPaths: "无",
    dismiss: "关闭",
  },
  es: {
    close: "Cerrar resultado de importación",
    title: "Espacio OKF importado",
    description: (version) =>
      `Tabula creó una copia separada en el navegador y detectó OKF ${version}.`,
    importedSummary: (conceptCount, issueCount) =>
      issueCount > 0
        ? `${conceptCount} conceptos OKF importados · ${issueCount} problemas`
        : `${conceptCount} conceptos OKF importados`,
    format: "Formato detectado",
    concepts: "Conceptos",
    directoryIndexes: "Índices de directorio",
    activityLog: "Log de actividad",
    present: "Presente",
    missing: "Falta",
    supportFiles: "Archivos auxiliares conservados",
    excludedFiles: "Archivos excluidos",
    requiredFixes: "Correcciones de compatibilidad obligatorias",
    healthAttention: "Estado del conocimiento por revisar",
    v02Guidance:
      "Este espacio declara OKF 0.1. Los metadatos y las prácticas de ciclo de vida de OKF 0.2 pueden requerir cambios de compatibilidad.",
    openRootIndex: "Abrir index raíz",
    showDetails: "Detalles de importación",
    hideDetails: "Ocultar detalles",
    detailsLabel: "Detalles de importación",
    preservedPaths: "Archivos auxiliares conservados",
    excludedPaths: "Archivos excluidos",
    noPaths: "Ninguno",
    dismiss: "Cerrar",
  },
  fr: {
    close: "Fermer le résultat de l’import",
    title: "Espace OKF importé",
    description: (version) =>
      `Tabula a créé une copie séparée dans le navigateur et détecté OKF ${version}.`,
    importedSummary: (conceptCount, issueCount) =>
      issueCount > 0
        ? `${conceptCount} concepts OKF importés · ${issueCount} problèmes`
        : `${conceptCount} concepts OKF importés`,
    format: "Format détecté",
    concepts: "Concepts",
    directoryIndexes: "Index de répertoire",
    activityLog: "Log d’activité",
    present: "Présent",
    missing: "Absent",
    supportFiles: "Fichiers auxiliaires conservés",
    excludedFiles: "Fichiers exclus",
    requiredFixes: "Corrections de compatibilité requises",
    healthAttention: "État des connaissances à vérifier",
    v02Guidance:
      "Cet espace déclare OKF 0.1. Les métadonnées et pratiques de cycle de vie OKF 0.2 peuvent nécessiter des ajustements de compatibilité.",
    openRootIndex: "Ouvrir l’index racine",
    showDetails: "Détails de l’import",
    hideDetails: "Masquer les détails",
    detailsLabel: "Détails de l’import",
    preservedPaths: "Fichiers auxiliaires conservés",
    excludedPaths: "Fichiers exclus",
    noPaths: "Aucun",
    dismiss: "Fermer",
  },
  de: {
    close: "Importergebnis schließen",
    title: "OKF-Workspace importiert",
    description: (version) =>
      `Tabula hat eine getrennte Browserkopie erstellt und OKF ${version} erkannt.`,
    importedSummary: (conceptCount, issueCount) =>
      issueCount > 0
        ? `${conceptCount} OKF-Concepts importiert · ${issueCount} Probleme`
        : `${conceptCount} OKF-Concepts importiert`,
    format: "Erkanntes Format",
    concepts: "Concepts",
    directoryIndexes: "Verzeichnis-Indexes",
    activityLog: "Aktivitäts-log",
    present: "Vorhanden",
    missing: "Fehlt",
    supportFiles: "Erhaltene Zusatzdateien",
    excludedFiles: "Ausgeschlossene Dateien",
    requiredFixes: "Erforderliche Kompatibilitätskorrekturen",
    healthAttention: "Zu prüfender Wissenszustand",
    v02Guidance:
      "Dieser Workspace deklariert OKF 0.1. Metadaten und Lebenszykluspraktiken aus OKF 0.2 können Kompatibilitätsanpassungen erfordern.",
    openRootIndex: "Root-index öffnen",
    showDetails: "Importdetails",
    hideDetails: "Importdetails ausblenden",
    detailsLabel: "Importdetails",
    preservedPaths: "Erhaltene Zusatzdateien",
    excludedPaths: "Ausgeschlossene Dateien",
    noPaths: "Keine",
    dismiss: "Schließen",
  },
};

export const getWorkspaceImportResultCopy = (
  language: WorkspaceLanguage,
) => copies[language];
