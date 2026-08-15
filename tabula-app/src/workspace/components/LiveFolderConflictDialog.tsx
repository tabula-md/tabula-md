import { ModalSurface } from "../../ui/ModalSurface";
import type { LiveFolderConflictReview } from "../io/useWorkspaceFileIoController";
import type { WorkspaceLanguage } from "../state/useWorkspacePreferences";

type Props = {
  language: WorkspaceLanguage;
  review: LiveFolderConflictReview;
  onKeepTabula: () => void;
  onMergeManually: () => void;
  onUseExternal: () => void;
};

const copies: Record<WorkspaceLanguage, {
  title: string; description: string; tabula: string; external: string;
  deleted: string; keepTabula: string; merge: string; useExternal: string;
}> = {
  en: { title: "Resolve file conflict", description: "This file changed in Tabula and in the connected folder. Both versions are preserved until you choose.", tabula: "Tabula version", external: "Folder version", deleted: "Deleted in the folder", keepTabula: "Keep Tabula", merge: "Merge manually", useExternal: "Use folder version" },
  ko: { title: "파일 충돌 해결", description: "이 파일이 Tabula와 연결된 폴더 양쪽에서 변경되었습니다. 선택하기 전까지 두 버전을 모두 보존합니다.", tabula: "Tabula 버전", external: "폴더 버전", deleted: "폴더에서 삭제됨", keepTabula: "Tabula 유지", merge: "직접 병합", useExternal: "폴더 버전 사용" },
  ja: { title: "ファイル競合を解決", description: "このファイルは Tabula と接続フォルダーの両方で変更されました。選択するまで両方を保持します。", tabula: "Tabula の版", external: "フォルダーの版", deleted: "フォルダーで削除", keepTabula: "Tabula を保持", merge: "手動でマージ", useExternal: "フォルダー版を使用" },
  zh: { title: "解决文件冲突", description: "此文件在 Tabula 和连接的文件夹中均有更改。选择前会保留两个版本。", tabula: "Tabula 版本", external: "文件夹版本", deleted: "已在文件夹中删除", keepTabula: "保留 Tabula", merge: "手动合并", useExternal: "使用文件夹版本" },
  es: { title: "Resolver conflicto", description: "Este archivo cambió en Tabula y en la carpeta conectada. Ambas versiones se conservan hasta que elijas.", tabula: "Versión de Tabula", external: "Versión de la carpeta", deleted: "Eliminado en la carpeta", keepTabula: "Conservar Tabula", merge: "Combinar manualmente", useExternal: "Usar versión de carpeta" },
  fr: { title: "Résoudre le conflit", description: "Ce fichier a changé dans Tabula et dans le dossier connecté. Les deux versions sont conservées jusqu’à votre choix.", tabula: "Version Tabula", external: "Version du dossier", deleted: "Supprimé du dossier", keepTabula: "Garder Tabula", merge: "Fusionner manuellement", useExternal: "Utiliser la version du dossier" },
  de: { title: "Dateikonflikt lösen", description: "Diese Datei wurde in Tabula und im verbundenen Ordner geändert. Beide Versionen bleiben bis zur Auswahl erhalten.", tabula: "Tabula-Version", external: "Ordnerversion", deleted: "Im Ordner gelöscht", keepTabula: "Tabula behalten", merge: "Manuell zusammenführen", useExternal: "Ordnerversion verwenden" },
};

const getText = (content: LiveFolderConflictReview["resolution"]["local"]["content"]) =>
  content.kind === "text" ? content.text : `[binary · ${content.bytes.byteLength} bytes]`;

export function LiveFolderConflictDialog({
  language, review, onKeepTabula, onMergeManually, onUseExternal,
}: Props) {
  const copy = copies[language];
  const external = review.resolution.external;
  const canMerge = review.resolution.local.content.kind === "text" &&
    (!external || external.content.kind === "text");
  return (
    <ModalSurface ariaLabelledBy="live-folder-conflict-title" className="workspace-export-review-modal" onClose={() => undefined}>
      <header className="share-modal-header compact">
        <h2 id="live-folder-conflict-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </header>
      <div className="workspace-export-review-list">
        <section className="workspace-export-review-row attention">
          <span><strong>{copy.tabula}</strong><small>{review.resolution.local.path}</small><pre>{getText(review.resolution.local.content)}</pre></span>
        </section>
        <section className="workspace-export-review-row notice">
          <span><strong>{copy.external}</strong><small>{external?.path ?? copy.deleted}</small><pre>{external ? getText(external.content) : copy.deleted}</pre></span>
        </section>
      </div>
      <div className="share-modal-actions workspace-export-review-actions">
        <button className="share-modal-secondary" type="button" onClick={onKeepTabula}>{copy.keepTabula}</button>
        <button className="share-modal-secondary" type="button" disabled={!canMerge} onClick={onMergeManually}>{copy.merge}</button>
        <button className="share-modal-primary" data-modal-initial-focus type="button" onClick={onUseExternal}>{copy.useExternal}</button>
      </div>
    </ModalSurface>
  );
}
