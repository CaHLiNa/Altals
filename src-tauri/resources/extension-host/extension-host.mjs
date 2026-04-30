import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const extensions = new Map();
const pendingUiRequests = new Map();

function writeMessage(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function findRegisteredCommand(commandId = "") {
  const normalized = String(commandId || "").trim();
  if (!normalized) return null;
  for (const extension of extensions.values()) {
    const handler = extension.commands.get(normalized);
    if (handler) return handler;
  }
  return null;
}

function emitWindowMessage(registry, severity = "info", message = "") {
  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage) return;
  writeMessage({
    kind: "WindowMessage",
    payload: {
      extensionId: registry.id,
      workspaceRoot: String(registry.currentWorkspaceRoot || ""),
      severity: String(severity || "info"),
      message: normalizedMessage,
    },
  });
}

let uiRequestCounter = 0;

function nextUiRequestId(registry) {
  uiRequestCounter += 1;
  return `${registry.id}:ui:${uiRequestCounter}`;
}

function requestUiInput(registry, kind = "", payload = {}) {
  const requestId = nextUiRequestId(registry);
  writeMessage({
    kind: "WindowInputRequested",
    payload: {
      requestId,
      extensionId: registry.id,
      workspaceRoot: String(registry.currentWorkspaceRoot || ""),
      kind: String(kind || "").trim(),
      ...payload,
    },
  });
  return new Promise((resolve, reject) => {
    pendingUiRequests.set(requestId, { resolve, reject });
  });
}

function resolveTreeItemHandle(registry, viewId = "", itemOrHandle) {
  const id = String(viewId || "").trim();
  if (!id) return "";
  if (typeof itemOrHandle === "string") {
    return itemOrHandle.trim();
  }
  if (itemOrHandle && typeof itemOrHandle === "object") {
    const directHandle = String(itemOrHandle.handle || itemOrHandle.id || "").trim();
    if (directHandle) return directHandle;
  }
  const treeItems = registry.treeItems.get(id);
  if (!treeItems) return "";
  for (const [handle, element] of treeItems.entries()) {
    if (element === itemOrHandle) {
      return String(handle || "").trim();
    }
  }
  return "";
}

function collectTreeParentHandles(registry, viewId = "", itemHandle = "") {
  const parents = [];
  const treeParents = registry.treeParents.get(String(viewId || "").trim());
  if (!treeParents) return parents;
  let current = String(itemHandle || "").trim();
  const seen = new Set();
  while (current) {
    const parentHandle = String(treeParents.get(current) || "").trim();
    if (!parentHandle || seen.has(parentHandle)) break;
    parents.unshift(parentHandle);
    seen.add(parentHandle);
    current = parentHandle;
  }
  return parents;
}

function createExtensionApi(registry) {
  return {
    commands: {
      registerCommand(command, handler) {
        const id = String(command || "").trim();
        if (id && typeof handler === "function") {
          registry.commands.set(id, handler);
        }
        return {
          dispose() {
            registry.commands.delete(id);
          },
        };
      },
      async executeCommand(command, ...args) {
        const id = String(command || "").trim();
        if (!id) {
          throw new Error("Command id is required");
        }
        const handler = findRegisteredCommand(id);
        if (!handler) {
          throw new Error(`Command not registered: ${id}`);
        }
        return await handler(...args);
      },
    },
    capabilities: {
      registerProvider(capability, handler) {
        const id = String(capability || "").trim();
        if (id && typeof handler === "function") {
          registry.capabilities.set(id, handler);
        }
        return {
          dispose() {
            registry.capabilities.delete(id);
          },
        };
      },
      async invoke(capability, payload) {
        const provider = registry.capabilities.get(String(capability || "").trim());
        if (!provider) {
          throw new Error(`No capability provider registered for ${capability}`);
        }
        return await provider(payload);
      },
    },
    views: {
      registerViewProvider(viewId, provider) {
        const id = String(viewId || "").trim();
        if (id && typeof provider === "function") {
          registry.viewProviders.set(id, provider);
        }
        return {
          dispose() {
            registry.viewProviders.delete(id);
          },
        };
      },
      registerTreeDataProvider(viewId, provider) {
        const id = String(viewId || "").trim();
        if (id && provider && typeof provider === "object") {
          registry.treeViews.set(id, provider);
          if (!registry.treeItems.has(id)) {
            registry.treeItems.set(id, new Map());
          }
          if (!registry.treeParents.has(id)) {
            registry.treeParents.set(id, new Map());
          }
          if (!registry.viewState.has(id)) {
            registry.viewState.set(id, createEmptyViewState(id));
          }
        }
        return {
          dispose() {
            registry.treeViews.delete(id);
            registry.treeItems.delete(id);
            registry.treeParents.delete(id);
            registry.viewState.delete(id);
          },
        };
      },
      updateView(viewId, patch = {}) {
        const id = String(viewId || "").trim();
        if (!id) return;
        const current = registry.viewState.get(id) || createEmptyViewState(id);
        const next = {
          ...current,
          title: typeof patch?.title === "string" && patch.title.trim() ? patch.title.trim() : current.title,
          description: typeof patch?.description === "string" ? patch.description : current.description,
          message: typeof patch?.message === "string" ? patch.message : current.message,
          badgeValue: Number.isInteger(patch?.badgeValue) ? patch.badgeValue : current.badgeValue,
          badgeTooltip: typeof patch?.badgeTooltip === "string" ? patch.badgeTooltip : current.badgeTooltip,
        };
        registry.viewState.set(id, next);
        writeMessage({
          kind: "ViewStateChanged",
          payload: {
            extensionId: registry.id,
            workspaceRoot: String(registry.currentWorkspaceRoot || ""),
            viewId: id,
            title: next.title,
            description: next.description,
            message: next.message,
            badgeValue: next.badgeValue,
            badgeTooltip: next.badgeTooltip,
          },
        });
      },
      refresh(viewId) {
        const id = String(viewId || "").trim();
        if (id) {
          registry.changedViews.add(id);
          writeMessage({
            kind: "ViewChanged",
            payload: {
              extensionId: registry.id,
              workspaceRoot: String(registry.currentWorkspaceRoot || ""),
              viewIds: [id],
            },
          });
        }
      },
      reveal(viewId, itemOrHandle, options = {}) {
        const id = String(viewId || "").trim();
        const itemHandle = resolveTreeItemHandle(registry, id, itemOrHandle);
        if (!id || !itemHandle) return;
        writeMessage({
          kind: "ViewRevealRequested",
          payload: {
            extensionId: registry.id,
            workspaceRoot: String(registry.currentWorkspaceRoot || ""),
            viewId: id,
            itemHandle,
            parentHandles: collectTreeParentHandles(registry, id, itemHandle),
            focus: Boolean(options?.focus),
            select: options?.select !== false,
            expand: options?.expand !== false,
          },
        });
      },
    },
    workspaceState: {
      get(key) {
        return registry.workspaceState.get(String(key || "").trim());
      },
      update(key, value) {
        registry.workspaceState.set(String(key || "").trim(), value);
      },
    },
    window: {
      async showInformationMessage(message) {
        emitWindowMessage(registry, "info", message);
        return undefined;
      },
      async showWarningMessage(message) {
        emitWindowMessage(registry, "warning", message);
        return undefined;
      },
      async showErrorMessage(message) {
        emitWindowMessage(registry, "error", message);
        return undefined;
      },
      async showQuickPick(items = [], options = {}) {
        const normalizedItems = Array.isArray(items)
          ? items
              .map((entry, index) => normalizeQuickPickItem(entry, index))
              .filter((entry) => entry != null)
          : [];
        return await requestUiInput(registry, "quickPick", {
          title: String(options?.title || ""),
          placeholder: String(options?.placeHolder || options?.placeholder || ""),
          canPickMany: Boolean(options?.canPickMany),
          items: normalizedItems,
        });
      },
      async showInputBox(options = {}) {
        return await requestUiInput(registry, "inputBox", {
          title: String(options?.title || ""),
          prompt: String(options?.prompt || ""),
          placeholder: String(options?.placeHolder || options?.placeholder || ""),
          value: String(options?.value || ""),
          password: Boolean(options?.password),
        });
      },
    },
  };
}

function createActivationContext(api, payload = {}) {
  const subscriptions = [];
  return {
    subscriptions,
    activationEvent: String(payload.activationEvent || ""),
    extension: {
      id: String(payload.extensionId || ""),
      manifestPath: String(payload.manifestPath || ""),
      extensionPath: String(payload.extensionPath || ""),
    },
    commands: api.commands,
    capabilities: api.capabilities,
    views: api.views,
    workspaceState: api.workspaceState,
    window: api.window,
  };
}

async function loadExtensionModule(mainPath) {
  const normalized = String(mainPath || "").trim();
  if (!normalized) {
    throw new Error("Extension main entrypoint is empty");
  }
  return await import(pathToFileURL(normalized).href);
}

async function ensureActivated(request) {
  const extensionId = String(request.extensionId || "").trim();
  if (!extensionId) {
    throw new Error("Extension id is required");
  }

  let record = extensions.get(extensionId);
  if (record) {
    return record;
  }

  const extensionPath = String(request.extensionPath || "").trim();
  const manifestPath = String(request.manifestPath || "").trim();
  const mainEntry = String(request.mainEntry || "").trim();
  const resolvedMain = path.resolve(extensionPath, mainEntry);

  record = {
    id: extensionId,
    extensionPath,
    manifestPath,
    mainEntry,
    resolvedMain,
    commands: new Map(),
    capabilities: new Map(),
    viewProviders: new Map(),
    treeViews: new Map(),
    treeItems: new Map(),
    treeParents: new Map(),
    viewState: new Map(),
    changedViews: new Set(),
    currentWorkspaceRoot: "",
    workspaceState: new Map(),
    subscriptions: [],
  };
  const api = createExtensionApi(record);
  const module = await loadExtensionModule(resolvedMain);
  const activate = typeof module.activate === "function" ? module.activate : null;
  if (!activate) {
    throw new Error(`Extension activate() not found: ${resolvedMain}`);
  }

  const context = createActivationContext(api, {
    activationEvent: request.activationEvent,
    extensionId,
    manifestPath,
    extensionPath,
  });
  await activate(context);
  record.subscriptions = context.subscriptions;
  extensions.set(extensionId, record);
  return record;
}

async function handleActivate(params = {}) {
  const record = await ensureActivated(params);
  return {
    kind: "Activate",
    payload: {
      extensionId: record.id,
      activated: true,
      reason: params.activationEvent
        ? `Activated by ${params.activationEvent}`
        : "Activated by host",
      registeredCommands: [...record.commands.keys()],
      registeredCapabilities: [...record.capabilities.keys()],
    },
  };
}

async function handleInvokeCapability(params = {}) {
  const record = await ensureActivated(params);
  record.currentWorkspaceRoot = String(params.envelope?.workspaceRoot || "");
  const capabilityId = String(params.envelope?.capability || "").trim();
  const provider = record.capabilities.get(capabilityId);
  if (!provider) {
    throw new Error(`Capability provider not registered: ${capabilityId}`);
  }

  const result = await provider(params.envelope);
  return {
    kind: "InvokeCapability",
    payload: {
      accepted: true,
      message:
        typeof result?.message === "string" && result.message.trim()
          ? result.message.trim()
          : `Extension host executed ${capabilityId}`,
      progressLabel:
        typeof result?.progressLabel === "string" && result.progressLabel.trim()
          ? result.progressLabel.trim()
          : "Handled by extension host",
    },
  };
}

async function handleExecuteCommand(params = {}) {
  const record = await ensureActivated(params);
  record.currentWorkspaceRoot = String(params.envelope?.workspaceRoot || "");
  const commandId = String(params.commandId || "").trim();
  const handler = record.commands.get(commandId);
  if (!handler) {
    throw new Error(`Command not registered: ${commandId}`);
  }

  record.changedViews.clear();
  const result = await handler(params.envelope || {});
  const changedViews = collectChangedViews(record, result?.changedViews);
  return {
    kind: "ExecuteCommand",
    payload: {
      accepted: true,
      message:
        typeof result?.message === "string" && result.message.trim()
          ? result.message.trim()
          : `Extension host executed ${commandId}`,
      progressLabel:
        typeof result?.progressLabel === "string" && result.progressLabel.trim()
          ? result.progressLabel.trim()
          : "Handled by extension command",
      changedViews,
    },
  };
}

async function handleResolveView(params = {}) {
  const record = await ensureActivated(params);
  record.currentWorkspaceRoot = String(params.envelope?.workspaceRoot || "");
  const viewId = String(params.viewId || "").trim();
  const provider = record.viewProviders.get(viewId);
  const treeProvider = record.treeViews.get(viewId);
  if (!provider && !treeProvider) {
    throw new Error(`View provider not registered: ${viewId}`);
  }
  const parentItemId = String(params.parentItemId || "").trim();
  if (treeProvider) {
    return await handleResolveTreeView(record, treeProvider, viewId, parentItemId, params.envelope || {});
  }
  const result = await provider(params.envelope || {});
  return {
    kind: "ResolveView",
    payload: {
      viewId,
      parentItemId,
      title:
        typeof result?.title === "string" && result.title.trim()
          ? result.title.trim()
          : viewId,
      items: Array.isArray(result?.items)
        ? normalizeViewItems(result.items, viewId)
        : [],
    },
  };
}

async function handleResolveTreeView(record, provider, viewId, parentItemId, envelope) {
  const treeItems = record.treeItems.get(viewId) || new Map();
  record.treeItems.set(viewId, treeItems);
  const treeParents = record.treeParents.get(viewId) || new Map();
  record.treeParents.set(viewId, treeParents);
  if (!parentItemId) {
    treeItems.clear();
    treeParents.clear();
  }
  const parentElement = parentItemId ? treeItems.get(parentItemId) : undefined;
  const children = await resolveTreeChildren(provider, parentElement, envelope);
  const items = [];
  for (const [index, element] of children.entries()) {
    const treeItem = await resolveTreeItem(provider, element, envelope);
    const normalized = normalizeTreeViewItem(treeItem, element, viewId, index);
    treeItems.set(normalized.handle, element);
    treeParents.set(normalized.handle, parentItemId);
    items.push(normalized);
  }
  return {
    kind: "ResolveView",
    payload: {
      viewId,
      parentItemId,
      title: resolveTreeViewTitle(provider, viewId, envelope),
      items,
    },
  };
}

async function resolveTreeChildren(provider, element, envelope) {
  if (typeof provider?.getChildren !== "function") return [];
  const result = await provider.getChildren(element, envelope);
  return Array.isArray(result) ? result : [];
}

async function resolveTreeItem(provider, element, envelope) {
  if (typeof provider?.getTreeItem === "function") {
    return await provider.getTreeItem(element, envelope);
  }
  return element;
}

function resolveTreeViewTitle(provider, viewId, envelope) {
  if (typeof provider?.getTitle === "function") {
    const title = provider.getTitle(envelope);
    if (typeof title === "string" && title.trim()) return title.trim();
  }
  return viewId;
}

function normalizeTreeViewItem(treeItem = {}, element = {}, viewId = "", index = 0) {
  const handle = String(
    treeItem?.handle || treeItem?.id || element?.handle || element?.id || `${viewId}:${index}`
  ).trim();
  const id = String(treeItem?.id || element?.id || handle).trim();
  const nestedChildren = Array.isArray(treeItem?.children)
    ? normalizeViewItems(treeItem.children, `${viewId}:${index}`)
    : [];
  return {
    id,
    handle,
    label: String(treeItem?.label || treeItem?.title || element?.label || element?.title || id || `Item ${index + 1}`),
    description: String(treeItem?.description || element?.description || ""),
    tooltip: String(treeItem?.tooltip || element?.tooltip || ""),
    contextValue: String(treeItem?.contextValue || treeItem?.context_value || element?.contextValue || element?.context_value || ""),
    icon: String(treeItem?.icon || element?.icon || ""),
    commandId: String(treeItem?.commandId || treeItem?.command || element?.commandId || element?.command || ""),
    commandArguments: Array.isArray(treeItem?.commandArguments)
      ? treeItem.commandArguments
      : Array.isArray(element?.commandArguments)
        ? element.commandArguments
        : [],
    collapsibleState: normalizeCollapsibleState(
      treeItem?.collapsibleState || element?.collapsibleState,
      nestedChildren.length > 0,
    ),
    children: nestedChildren,
  };
}

function createEmptyViewState(viewId = "") {
  return {
    title: String(viewId || "").trim(),
    description: "",
    message: "",
    badgeValue: null,
    badgeTooltip: "",
  };
}

function normalizeViewItems(items = [], viewId = "") {
  return items.map((item, index) => ({
    id: String(item?.id || `${viewId}:${index}`),
    handle: String(item?.handle || item?.id || `${viewId}:${index}`),
    label: String(item?.label || item?.title || item?.id || `Item ${index + 1}`),
    description: String(item?.description || ""),
    tooltip: String(item?.tooltip || ""),
    contextValue: String(item?.contextValue || item?.context_value || ""),
    icon: String(item?.icon || ""),
    commandId: String(item?.commandId || item?.command || ""),
    commandArguments: Array.isArray(item?.commandArguments) ? item.commandArguments : [],
    collapsibleState: normalizeCollapsibleState(
      item?.collapsibleState || item?.collapsible_state,
      Array.isArray(item?.children) && item.children.length > 0,
    ),
    children: Array.isArray(item?.children)
      ? normalizeViewItems(item.children, `${viewId}:${index}`)
      : [],
  }))
}

function normalizeQuickPickItem(entry, index = 0) {
  if (typeof entry === "string") {
    const label = entry.trim();
    if (!label) return null;
    return {
      id: `${index}`,
      label,
      description: "",
      detail: "",
      picked: false,
      value: label,
    };
  }
  if (!entry || typeof entry !== "object") return null;
  const label = String(entry.label || entry.value || "").trim();
  if (!label) return null;
  return {
    id: String(entry.id || `${index}`),
    label,
    description: String(entry.description || ""),
    detail: String(entry.detail || ""),
    picked: Boolean(entry.picked),
    value: Object.prototype.hasOwnProperty.call(entry, "value") ? entry.value : label,
  };
}

function normalizeCollapsibleState(value, hasChildren = false) {
  const normalized = String(value || "").trim();
  if (normalized === "expanded" || normalized === "collapsed" || normalized === "none") {
    return normalized;
  }
  return hasChildren ? "collapsed" : "none";
}

function collectChangedViews(record, rawChangedViews) {
  const changedViews = new Set();
  if (Array.isArray(rawChangedViews)) {
    for (const entry of rawChangedViews) {
      const id = String(entry || "").trim();
      if (id) changedViews.add(id);
    }
  }
  for (const entry of record.changedViews) {
    const id = String(entry || "").trim();
    if (id) changedViews.add(id);
  }
  record.changedViews.clear();
  return [...changedViews];
}

async function dispatchRequest(request) {
  if (!request || typeof request !== "object") {
    throw new Error("Invalid extension host request");
  }
  if (request.method === "RespondUiRequest") {
    return handleRespondUiRequest(request.params || {});
  }
  if (request.method === "Activate") {
    return await handleActivate(request.params || {});
  }
  if (request.method === "InvokeCapability") {
    return await handleInvokeCapability(request.params || {});
  }
  if (request.method === "ExecuteCommand") {
    return await handleExecuteCommand(request.params || {});
  }
  if (request.method === "ResolveView") {
    return await handleResolveView(request.params || {});
  }
  throw new Error(`Unknown extension host method: ${String(request.method || "")}`);
}

function handleRespondUiRequest(params = {}) {
  const requestId = String(params.requestId || "").trim();
  if (!requestId) {
    throw new Error("UI request id is required");
  }
  const pending = pendingUiRequests.get(requestId);
  if (!pending) {
    throw new Error(`Pending UI request not found: ${requestId}`);
  }
  pendingUiRequests.delete(requestId);
  if (params.cancelled) {
    pending.resolve(undefined);
  } else {
    pending.resolve(params.result);
  }
  return {
    kind: "AcknowledgeUiRequest",
    payload: {
      requestId,
      accepted: true,
    },
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", async (line) => {
  try {
    const request = JSON.parse(line);
    writeMessage(await dispatchRequest(request));
  } catch (error) {
    writeMessage({
      kind: "Error",
      payload: {
        message: error?.message || String(error || "Unknown extension host error"),
      },
    });
  }
});
