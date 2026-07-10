const safeDomIdPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");

export const getWorkspaceTabId = (fileId: string) => `workspace-tab-${safeDomIdPart(fileId)}`;
export const getWorkspaceTabPanelId = (fileId: string) => `workspace-panel-${safeDomIdPart(fileId)}`;
