import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const extensions = new Map();

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
  const commandId = String(params.commandId || "").trim();
  const handler = record.commands.get(commandId);
  if (!handler) {
    throw new Error(`Command not registered: ${commandId}`);
  }

  const result = await handler(params.envelope || {});
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
    },
  };
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
  throw new Error(`Unknown extension host method: ${String(request.method || "")}`);
}

function writeResponse(response) {
  process.stdout.write(JSON.stringify(response) + "\n");
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", async (line) => {
  try {
    const request = JSON.parse(line);
    writeResponse(await dispatchRequest(request));
  } catch (error) {
    writeResponse({
      kind: "Error",
      payload: {
        message: error?.message || String(error || "Unknown extension host error"),
      },
    });
  }
});
