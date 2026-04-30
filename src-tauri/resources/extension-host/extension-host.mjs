import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const extensions = new Map();

function writeMessage(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
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
        }
        return {
          dispose() {
            registry.treeViews.delete(id);
            registry.treeItems.delete(id);
          },
        };
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
    },
    workspaceState: {
      get(key) {
        return registry.workspaceState.get(String(key || "").trim());
      },
      update(key, value) {
        registry.workspaceState.set(String(key || "").trim(), value);
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
  if (!parentItemId) {
    treeItems.clear();
  }
  const parentElement = parentItemId ? treeItems.get(parentItemId) : undefined;
  const children = await resolveTreeChildren(provider, parentElement, envelope);
  const items = [];
  for (const [index, element] of children.entries()) {
    const treeItem = await resolveTreeItem(provider, element, envelope);
    const normalized = normalizeTreeViewItem(treeItem, element, viewId, index);
    treeItems.set(normalized.handle, element);
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
