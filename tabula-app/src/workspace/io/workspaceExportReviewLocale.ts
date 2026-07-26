import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

export type WorkspaceExportReviewCopy = {
  title: string;
  description: string;
  close: string;
  compatibility: string;
  compatible: (version: string) => string;
  requiredChanges: (count: number) => string;
  portabilityWarnings: (count: number) => string;
  health: string;
  healthy: string;
  healthSummary: (attention: number, notices: number) => string;
  changes: string;
  changesNotTracked: string;
  noUnloggedChanges: string;
  unloggedChanges: (count: number) => string;
  cancel: string;
  reviewIssues: string;
  export: string;
  exportAnyway: string;
};

const english: WorkspaceExportReviewCopy = {
  title: "Review workspace export",
  description: "Check this knowledge workspace before handing off its Markdown files.",
  close: "Close export review",
  compatibility: "Compatibility",
  compatible: (version) => `Ready for OKF ${version}`,
  requiredChanges: (count) => `${count} required ${count === 1 ? "change" : "changes"}`,
  portabilityWarnings: (count) => `${count} portability ${count === 1 ? "warning" : "warnings"}`,
  health: "Knowledge health",
  healthy: "No maintenance signals",
  healthSummary: (attention, notices) =>
    `${attention} need attention, ${notices} ${notices === 1 ? "notice" : "notices"}`,
  changes: "Handoff log",
  changesNotTracked: "Changes are not being tracked",
  noUnloggedChanges: "No unlogged changes",
  unloggedChanges: (count) => `${count} ${count === 1 ? "change is" : "changes are"} not in log.md`,
  cancel: "Cancel",
  reviewIssues: "Review issues",
  export: "Export",
  exportAnyway: "Export anyway",
};

const korean: WorkspaceExportReviewCopy = {
  title: "워크스페이스 내보내기 검토",
  description: "Markdown 파일을 전달하기 전에 이 knowledge workspace를 확인합니다.",
  close: "내보내기 검토 닫기",
  compatibility: "호환성",
  compatible: (version) => `OKF ${version} 준비됨`,
  requiredChanges: (count) => `필수 수정 ${count}개`,
  portabilityWarnings: (count) => `이식성 경고 ${count}개`,
  health: "지식 상태",
  healthy: "유지보수 신호 없음",
  healthSummary: (attention, notices) => `확인 필요 ${attention}개, 알림 ${notices}개`,
  changes: "인계 로그",
  changesNotTracked: "변경 사항을 추적하고 있지 않음",
  noUnloggedChanges: "로그에 반영되지 않은 변경 없음",
  unloggedChanges: (count) => `${count}개 변경이 log.md에 반영되지 않음`,
  cancel: "취소",
  reviewIssues: "문제 검토",
  export: "내보내기",
  exportAnyway: "그대로 내보내기",
};

const copies: Record<WorkspaceLanguage, WorkspaceExportReviewCopy> = {
  en: english,
  ko: korean,
  ja: {
    title: "ワークスペースのエクスポートを確認",
    description: "Markdown ファイルを引き渡す前に、このナレッジワークスペースを確認します。",
    close: "エクスポート確認を閉じる",
    compatibility: "互換性",
    compatible: (version) => `OKF ${version} の準備完了`,
    requiredChanges: (count) => `必須の変更 ${count} 件`,
    portabilityWarnings: (count) => `移植性の警告 ${count} 件`,
    health: "ナレッジの状態",
    healthy: "メンテナンスシグナルなし",
    healthSummary: (attention, notices) => `要確認 ${attention} 件、通知 ${notices} 件`,
    changes: "引き渡しログ",
    changesNotTracked: "変更は追跡されていません",
    noUnloggedChanges: "ログ未記録の変更なし",
    unloggedChanges: (count) => `${count} 件の変更が log.md に未記録`,
    cancel: "キャンセル",
    reviewIssues: "問題を確認",
    export: "エクスポート",
    exportAnyway: "そのままエクスポート",
  },
  zh: {
    title: "检查工作区导出",
    description: "交付 Markdown 文件前检查此知识工作区。",
    close: "关闭导出检查",
    compatibility: "兼容性",
    compatible: (version) => `已准备好 OKF ${version}`,
    requiredChanges: (count) => `${count} 项必需修改`,
    portabilityWarnings: (count) => `${count} 项可移植性警告`,
    health: "知识状态",
    healthy: "没有维护提示",
    healthSummary: (attention, notices) => `${attention} 项需要检查，${notices} 项提示`,
    changes: "交付日志",
    changesNotTracked: "未跟踪更改",
    noUnloggedChanges: "没有未记录的更改",
    unloggedChanges: (count) => `${count} 项更改尚未写入 log.md`,
    cancel: "取消",
    reviewIssues: "检查问题",
    export: "导出",
    exportAnyway: "仍然导出",
  },
  es: {
    title: "Revisar exportación",
    description: "Comprueba este espacio de conocimiento antes de entregar sus archivos Markdown.",
    close: "Cerrar revisión de exportación",
    compatibility: "Compatibilidad",
    compatible: (version) => `Listo para OKF ${version}`,
    requiredChanges: (count) => `${count} ${count === 1 ? "cambio obligatorio" : "cambios obligatorios"}`,
    portabilityWarnings: (count) => `${count} ${count === 1 ? "aviso de portabilidad" : "avisos de portabilidad"}`,
    health: "Estado del conocimiento",
    healthy: "Sin señales de mantenimiento",
    healthSummary: (attention, notices) => `${attention} requieren atención, ${notices} avisos`,
    changes: "Registro de entrega",
    changesNotTracked: "Los cambios no se están registrando",
    noUnloggedChanges: "No hay cambios sin registrar",
    unloggedChanges: (count) => `${count} ${count === 1 ? "cambio no está" : "cambios no están"} en log.md`,
    cancel: "Cancelar",
    reviewIssues: "Revisar problemas",
    export: "Exportar",
    exportAnyway: "Exportar de todos modos",
  },
  fr: {
    title: "Vérifier l’export",
    description: "Vérifiez cet espace de connaissances avant de transmettre ses fichiers Markdown.",
    close: "Fermer la vérification de l’export",
    compatibility: "Compatibilité",
    compatible: (version) => `Prêt pour OKF ${version}`,
    requiredChanges: (count) => `${count} ${count === 1 ? "modification requise" : "modifications requises"}`,
    portabilityWarnings: (count) => `${count} ${count === 1 ? "avertissement de portabilité" : "avertissements de portabilité"}`,
    health: "État des connaissances",
    healthy: "Aucun signal de maintenance",
    healthSummary: (attention, notices) => `${attention} à vérifier, ${notices} informations`,
    changes: "Journal de transmission",
    changesNotTracked: "Les modifications ne sont pas suivies",
    noUnloggedChanges: "Aucune modification non journalisée",
    unloggedChanges: (count) => `${count} ${count === 1 ? "modification absente" : "modifications absentes"} de log.md`,
    cancel: "Annuler",
    reviewIssues: "Vérifier les problèmes",
    export: "Exporter",
    exportAnyway: "Exporter quand même",
  },
  de: {
    title: "Workspace-Export prüfen",
    description: "Prüfe diesen Wissens-Workspace vor der Übergabe seiner Markdown-Dateien.",
    close: "Exportprüfung schließen",
    compatibility: "Kompatibilität",
    compatible: (version) => `Bereit für OKF ${version}`,
    requiredChanges: (count) => `${count} erforderliche ${count === 1 ? "Änderung" : "Änderungen"}`,
    portabilityWarnings: (count) => `${count} ${count === 1 ? "Portabilitätswarnung" : "Portabilitätswarnungen"}`,
    health: "Wissenszustand",
    healthy: "Keine Wartungshinweise",
    healthSummary: (attention, notices) => `${attention} zu prüfen, ${notices} Hinweise`,
    changes: "Übergabeprotokoll",
    changesNotTracked: "Änderungen werden nicht verfolgt",
    noUnloggedChanges: "Keine nicht protokollierten Änderungen",
    unloggedChanges: (count) => `${count} ${count === 1 ? "Änderung fehlt" : "Änderungen fehlen"} in log.md`,
    cancel: "Abbrechen",
    reviewIssues: "Probleme prüfen",
    export: "Exportieren",
    exportAnyway: "Trotzdem exportieren",
  },
};

export const getWorkspaceExportReviewCopy = (
  language: WorkspaceLanguage,
) => copies[language];
