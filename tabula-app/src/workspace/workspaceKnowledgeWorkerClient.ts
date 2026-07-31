import type {
  OkfCompatibilityReport,
  WorkspaceKnowledgeIndex,
  WorkspaceKnowledgeMaintenancePlan,
  WorkspaceKnowledgePathChange,
  WorkspaceSourceDocument,
} from "@tabula-md/tabula";
import type {
  WorkspaceKnowledgeDeltaResponse,
  WorkspaceKnowledgeMaintenanceResponse,
  WorkspaceKnowledgeSnapshotResponse,
  WorkspaceKnowledgeSyncRequest,
  WorkspaceKnowledgeWorkerRequest,
  WorkspaceKnowledgeWorkerResponse,
} from "./workspaceKnowledgeWorkerProtocol";
import {
  applyWorkspaceKnowledgeIndexDelta,
} from "./workspaceKnowledgeWorkerDelta";

export type WorkspaceKnowledgeState = {
  compatibilityReport?: OkfCompatibilityReport;
  elapsedMs: number | null;
  index?: WorkspaceKnowledgeIndex;
  pending: boolean;
  revision: number;
  source: "none" | "worker" | "fallback";
};

type KnowledgeDocumentsById = ReadonlyMap<string, WorkspaceSourceDocument>;

type SyncTarget = {
  availablePaths: readonly string[];
  documentsById: KnowledgeDocumentsById;
  revision: number;
};

type InFlightSync = SyncTarget & {
  requestId: number;
};

type MaintenanceResolver = {
  reject: (error: Error) => void;
  resolve: (response: WorkspaceKnowledgeMaintenanceResponse) => void;
};

const EMPTY_MAINTENANCE_PLAN: WorkspaceKnowledgeMaintenancePlan = Object.freeze({
  updates: Object.freeze([]),
  updatedDocumentCount: 0,
  updatedLinkCount: 0,
  skippedLinkCount: 0,
});

const createInitialState = (): WorkspaceKnowledgeState => ({
  elapsedMs: null,
  pending: false,
  revision: 0,
  source: "none",
});

const toDocumentMap = (
  documents: readonly WorkspaceSourceDocument[],
): Map<string, WorkspaceSourceDocument> =>
  new Map(documents.map((document) => [document.id, document]));

const documentsMatch = (
  first: WorkspaceSourceDocument | undefined,
  second: WorkspaceSourceDocument | undefined,
) => Boolean(
  first &&
  second &&
  first.id === second.id &&
  first.path === second.path &&
  first.markdown === second.markdown,
);

const pathsMatch = (
  first: readonly string[],
  second: readonly string[],
) =>
  first.length === second.length
  && first.every((path, index) => path === second[index]);

const documentsDifferOnlyByPath = (
  previousDocumentsById: KnowledgeDocumentsById,
  nextDocumentsById: KnowledgeDocumentsById,
) =>
  previousDocumentsById.size === nextDocumentsById.size &&
  [...previousDocumentsById.values()].every((previousDocument) => {
    const nextDocument = nextDocumentsById.get(previousDocument.id);
    return nextDocument?.markdown === previousDocument.markdown;
  });

export const getWorkspaceKnowledgeSyncDelta = (
  previousDocumentsById: KnowledgeDocumentsById,
  nextDocumentsById: KnowledgeDocumentsById,
) => {
  const removedDocumentIds = [...previousDocumentsById.keys()].filter(
    (documentId) => !nextDocumentsById.has(documentId),
  );
  const upsertedDocuments = [...nextDocumentsById.values()].filter(
    (document) => !documentsMatch(previousDocumentsById.get(document.id), document),
  );
  return { removedDocumentIds, upsertedDocuments };
};

export const getWorkspaceKnowledgePathChanges = (
  previousDocumentsById: KnowledgeDocumentsById,
  nextDocumentsById: KnowledgeDocumentsById,
): WorkspaceKnowledgePathChange[] =>
  [...previousDocumentsById.values()].flatMap((previousDocument) => {
    const nextDocument = nextDocumentsById.get(previousDocument.id);
    return nextDocument && nextDocument.path !== previousDocument.path
      ? [{
          documentId: previousDocument.id,
          previousPath: previousDocument.path,
          nextPath: nextDocument.path,
        }]
      : [];
  });

const hydrateTransferIndex = (
  index: WorkspaceKnowledgeIndex,
  documentsById: KnowledgeDocumentsById,
): WorkspaceKnowledgeIndex => ({
  ...index,
  documentsById: new Map(
    [...index.documentsById].map(([documentId, document]) => [
      documentId,
      documentsById.get(documentId) ?? document,
    ]),
  ),
});

class WorkspaceKnowledgeWorkerClient {
  private committedAvailablePaths: readonly string[] = [];
  private committedDocumentsById: KnowledgeDocumentsById = new Map();
  private committedIndex?: WorkspaceKnowledgeIndex;
  private inFlightSync?: InFlightSync;
  private latestTarget: SyncTarget = {
    availablePaths: [],
    documentsById: new Map(),
    revision: 0,
  };
  private listeners = new Set<() => void>();
  private syncIdleResolvers = new Set<() => void>();
  private maintenanceResolvers = new Map<number, MaintenanceResolver>();
  private nextRequestId = 1;
  private pendingSync?: SyncTarget;
  private state = createInitialState();
  private worker?: Worker;
  private workerFailed = false;

  getSnapshot = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  sync(
    documents: readonly WorkspaceSourceDocument[],
    availablePaths: readonly string[] = documents.map((document) => document.path),
  ) {
    const nextTarget: SyncTarget = {
      availablePaths: [...new Set(availablePaths)].sort(),
      documentsById: toDocumentMap(documents),
      revision: this.latestTarget.revision + 1,
    };
    this.latestTarget = nextTarget;
    this.setState({
      ...this.state,
      pending: true,
      revision: nextTarget.revision,
    });

    if (this.inFlightSync) {
      this.pendingSync = nextTarget;
      return;
    }
    this.sendSync(nextTarget);
  }

  async planMaintenance(
    previousDocuments: readonly WorkspaceSourceDocument[],
    nextDocuments: readonly WorkspaceSourceDocument[],
  ): Promise<WorkspaceKnowledgeMaintenancePlan> {
    if (previousDocuments.length === 0 || nextDocuments.length === 0) {
      return EMPTY_MAINTENANCE_PLAN;
    }
    if (this.workerFailed || typeof Worker === "undefined") {
      return this.runMaintenanceFallback(previousDocuments, nextDocuments);
    }

    try {
      await this.waitForSyncIdle();
      if (this.workerFailed) {
        return this.runMaintenanceFallback(previousDocuments, nextDocuments);
      }
      const previousDocumentsById = toDocumentMap(previousDocuments);
      const nextDocumentsById = toDocumentMap(nextDocuments);
      if (!documentsDifferOnlyByPath(previousDocumentsById, nextDocumentsById)) {
        return this.runMaintenanceFallback(previousDocuments, nextDocuments);
      }
      const pathChanges = getWorkspaceKnowledgePathChanges(
        previousDocumentsById,
        nextDocumentsById,
      );
      if (pathChanges.length === 0) return EMPTY_MAINTENANCE_PLAN;
      const delta = getWorkspaceKnowledgeSyncDelta(
        this.committedDocumentsById,
        previousDocumentsById,
      );
      if (
        !this.committedIndex ||
        delta.removedDocumentIds.length > 0 ||
        delta.upsertedDocuments.length > 0
      ) {
        return this.runMaintenanceFallback(previousDocuments, nextDocuments);
      }
      const worker = this.getWorker();
      const requestId = this.nextRequestId++;
      const response = await new Promise<WorkspaceKnowledgeMaintenanceResponse>(
        (resolve, reject) => {
          this.maintenanceResolvers.set(requestId, { resolve, reject });
          worker.postMessage({
            kind: "maintenance",
            requestId,
            pathChanges,
          } satisfies WorkspaceKnowledgeWorkerRequest);
        },
      );
      return response.plan;
    } catch {
      this.handleWorkerFailure();
      return this.runMaintenanceFallback(previousDocuments, nextDocuments);
    }
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  private waitForSyncIdle() {
    if (!this.inFlightSync && !this.pendingSync) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.syncIdleResolvers.add(resolve);
    });
  }

  private resolveSyncIdle() {
    if (this.inFlightSync || this.pendingSync) return;
    for (const resolve of this.syncIdleResolvers) resolve();
    this.syncIdleResolvers.clear();
  }

  private setState(nextState: WorkspaceKnowledgeState) {
    this.state = nextState;
    this.emit();
  }

  private getWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker(
      new URL("./workspaceKnowledgeWorker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = (
      event: MessageEvent<WorkspaceKnowledgeWorkerResponse>,
    ) => this.handleWorkerMessage(event.data);
    this.worker.onerror = () => this.handleWorkerFailure();
    return this.worker;
  }

  private sendSync(target: SyncTarget) {
    if (this.workerFailed || typeof Worker === "undefined") {
      void this.runSyncFallback(target);
      return;
    }

    const reset = this.committedDocumentsById.size === 0;
    const delta = reset
      ? {
          removedDocumentIds: [] as string[],
          upsertedDocuments: [...target.documentsById.values()],
        }
      : getWorkspaceKnowledgeSyncDelta(
          this.committedDocumentsById,
          target.documentsById,
        );
    if (
      !reset
      && delta.removedDocumentIds.length === 0
      && delta.upsertedDocuments.length === 0
      && pathsMatch(this.committedAvailablePaths, target.availablePaths)
    ) {
      this.commitUnchangedTarget(target);
      return;
    }

    try {
      const requestId = this.nextRequestId++;
      this.inFlightSync = { ...target, requestId };
      this.getWorker().postMessage({
        kind: "sync",
        requestId,
        revision: target.revision,
        reset,
        availablePaths: target.availablePaths,
        ...delta,
      } satisfies WorkspaceKnowledgeSyncRequest);
    } catch {
      this.handleWorkerFailure();
    }
  }

  private handleWorkerMessage(response: WorkspaceKnowledgeWorkerResponse) {
    if (response.kind === "maintenance") {
      const resolver = this.maintenanceResolvers.get(response.requestId);
      this.maintenanceResolvers.delete(response.requestId);
      resolver?.resolve(response);
      return;
    }
    if (response.kind === "error") {
      if (response.operation === "maintenance") {
        this.handleWorkerFailure();
        return;
      }
      if (this.inFlightSync?.requestId === response.requestId) {
        this.handleWorkerFailure();
      }
      return;
    }
    this.handleSyncResponse(response);
  }

  private handleSyncResponse(
    response: WorkspaceKnowledgeSnapshotResponse | WorkspaceKnowledgeDeltaResponse,
  ) {
    const inFlight = this.inFlightSync;
    if (!inFlight || response.requestId !== inFlight.requestId) return;

    const nextIndex = response.kind === "snapshot"
      ? hydrateTransferIndex(response.index, inFlight.documentsById)
      : this.committedIndex
        ? applyWorkspaceKnowledgeIndexDelta(
            this.committedIndex,
            response.delta,
            inFlight.documentsById,
          )
        : undefined;
    if (!nextIndex) {
      this.handleWorkerFailure();
      return;
    }
    this.committedIndex = nextIndex;
    this.committedAvailablePaths = inFlight.availablePaths;
    this.committedDocumentsById = inFlight.documentsById;
    this.inFlightSync = undefined;
    const pending = this.pendingSync;
    this.pendingSync = undefined;

    if (!pending && response.revision === this.latestTarget.revision) {
      this.setState({
        compatibilityReport: response.compatibilityReport,
        elapsedMs: response.elapsedMs,
        index: nextIndex,
        pending: false,
        revision: response.revision,
        source: "worker",
      });
    }
    if (pending) this.sendSync(pending);
    else this.resolveSyncIdle();
  }

  private commitUnchangedTarget(target: SyncTarget) {
    this.committedAvailablePaths = target.availablePaths;
    this.committedDocumentsById = target.documentsById;
    if (target.revision === this.latestTarget.revision) {
      this.setState({
        ...this.state,
        pending: false,
        revision: target.revision,
      });
    }
    const pending = this.pendingSync;
    this.pendingSync = undefined;
    if (pending) this.sendSync(pending);
    else this.resolveSyncIdle();
  }

  private handleWorkerFailure() {
    this.worker?.terminate();
    this.worker = undefined;
    this.workerFailed = true;
    for (const resolver of this.maintenanceResolvers.values()) {
      resolver.reject(new Error("Knowledge worker failed."));
    }
    this.maintenanceResolvers.clear();

    const failedTarget = this.pendingSync ?? this.inFlightSync;
    this.inFlightSync = undefined;
    this.pendingSync = undefined;
    this.resolveSyncIdle();
    if (failedTarget) void this.runSyncFallback(failedTarget);
  }

  private async runSyncFallback(target: SyncTarget) {
    try {
      const runtime = await import("./workspaceKnowledgeRuntime");
      const startedAt = performance.now();
      const documents = [...target.documentsById.values()];
      const index = runtime.createKnowledgeIndex(documents);
      if (target.revision !== this.latestTarget.revision) {
        this.committedDocumentsById = target.documentsById;
        this.sendSync(this.latestTarget);
        return;
      }
      this.committedDocumentsById = target.documentsById;
      this.committedAvailablePaths = target.availablePaths;
      this.committedIndex = index;
      this.setState({
        compatibilityReport: runtime.getKnowledgeCompatibility(
          index,
          target.availablePaths,
        ),
        elapsedMs: performance.now() - startedAt,
        index,
        pending: false,
        revision: target.revision,
        source: "fallback",
      });
    } catch {
      if (target.revision === this.latestTarget.revision) {
        this.setState({
          elapsedMs: null,
          pending: false,
          revision: target.revision,
          source: "fallback",
        });
      }
    }
  }

  private async runMaintenanceFallback(
    previousDocuments: readonly WorkspaceSourceDocument[],
    nextDocuments: readonly WorkspaceSourceDocument[],
  ) {
    try {
      const runtime = await import("./workspaceKnowledgeRuntime");
      return runtime.getKnowledgeMaintenancePlan(
        previousDocuments,
        nextDocuments,
      );
    } catch {
      return EMPTY_MAINTENANCE_PLAN;
    }
  }
}

export const workspaceKnowledgeWorkerClient =
  new WorkspaceKnowledgeWorkerClient();
