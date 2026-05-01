import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const hostPath = path.join(repoRoot, "src-tauri/resources/extension-host/extension-host.mjs");
const extensionPath = path.join(repoRoot, ".scribeflow/extensions/example-pdf-extension");
const manifestPath = path.join(extensionPath, "package.json");

async function readManifestPermissions() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return manifest && typeof manifest.permissions === "object" && !Array.isArray(manifest.permissions)
    ? manifest.permissions
    : {};
}

const child = spawn("node", [hostPath], {
  cwd: repoRoot,
  stdio: ["pipe", "pipe", "inherit"],
});

const observed = [];
let currentResolve = null;
const observers = [];

function ensure(condition, message, details = null) {
  if (condition) return;
  const error = new Error(message);
  error.details = details;
  throw error;
}

function send(method, params) {
  child.stdin.write(`${JSON.stringify({ method, params })}\n`);
}

function isTerminal(message) {
  return ["Activate", "InvokeCapability", "ExecuteCommand", "Error"].includes(message.kind);
}

function call(method, params) {
  if (currentResolve) {
    throw new Error("probe does not support concurrent calls");
  }
  send(method, params);
  return new Promise((resolve, reject) => {
    currentResolve = { resolve, reject };
  });
}

function waitForObserved(predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const existing = observed.find(predicate);
    if (existing) {
      resolve(existing);
      return;
    }
    const timer = setTimeout(() => {
      const index = observers.findIndex((entry) => entry.predicate === predicate);
      if (index >= 0) observers.splice(index, 1);
      reject(new Error("timed out waiting for observed message"));
    }, timeoutMs);
    observers.push({
      predicate,
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
    });
  });
}

function handleNonTerminal(message) {
  if (message.kind === "WindowInputRequested") {
    send("RespondUiRequest", {
      requestId: message.payload.requestId,
      cancelled: false,
      result: "zh-CN",
    });
    return;
  }

  if (message.kind === "HostCallRequested") {
    if (message.payload.kind === "references.readCurrentLibrary") {
      send("ResolveHostCall", {
        requestId: message.payload.requestId,
        accepted: true,
        result: {
          references: [{ id: "ref-123", title: "Runtime Test Paper" }],
        },
      });
      return;
    }
    if (message.payload.kind === "pdf.extractMetadata") {
      send("ResolveHostCall", {
        requestId: message.payload.requestId,
        accepted: true,
        result: {
          metadata: { title: "Runtime Test PDF" },
        },
      });
      return;
    }
    if (message.payload.kind === "pdf.extractText") {
      send("ResolveHostCall", {
        requestId: message.payload.requestId,
        accepted: true,
        result: "Runtime Test PDF Text",
      });
      return;
    }
    if (message.payload.kind === "process.exec") {
      send("ResolveHostCall", {
        requestId: message.payload.requestId,
        accepted: true,
        result: {
          ok: true,
          code: 0,
          stdout: "exec-ok",
          stderr: "",
        },
      });
      return;
    }
    if (message.payload.kind === "process.spawn") {
      send("ResolveHostCall", {
        requestId: message.payload.requestId,
        accepted: true,
        result: {
          ok: true,
          pid: 4242,
        },
      });
      return;
    }
    if (message.payload.kind === "process.wait") {
      send("ResolveHostCall", {
        requestId: message.payload.requestId,
        accepted: true,
        result: {
          ok: true,
          pid: message.payload.payload?.pid || 4242,
          code: 0,
        },
      });
      return;
    }
    if (message.payload.kind === "tasks.update") {
      send("ResolveHostCall", {
        requestId: message.payload.requestId,
        accepted: true,
        result: {
          ok: true,
          taskId: message.payload.payload?.taskId || "",
          state: message.payload.payload?.state || "",
          progressLabel: message.payload.payload?.progressLabel || "",
        },
      });
      return;
    }
    send("ResolveHostCall", {
      requestId: message.payload.requestId,
      accepted: false,
      error: `Unhandled host call kind: ${message.payload.kind}`,
    });
  }
}

child.stdout.setEncoding("utf8");
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk;
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) {
      const message = JSON.parse(line);
      observed.push(message);
      for (let index = observers.length - 1; index >= 0; index -= 1) {
        const observer = observers[index];
        if (observer.predicate(message)) {
          observers.splice(index, 1);
          observer.resolve(message);
        }
      }
      if (isTerminal(message)) {
        if (!currentResolve) {
          throw new Error(`unexpected terminal message without waiter: ${message.kind}`);
        }
        const { resolve, reject } = currentResolve;
        currentResolve = null;
        if (message.kind === "Error") {
          reject(new Error(String(message.payload?.message || "Unknown extension host error")));
        } else {
          resolve(message);
        }
      } else {
        handleNonTerminal(message);
      }
    }
    newlineIndex = buffer.indexOf("\n");
  }
});

child.on("exit", (code) => {
  if (currentResolve) {
    const { reject } = currentResolve;
    currentResolve = null;
    reject(new Error(`extension host exited early with code ${code ?? "unknown"}`));
  }
});

setTimeout(() => {
  if (!currentResolve) return;
  console.error(JSON.stringify({ timeout: true, observed }, null, 2));
  process.exitCode = 1;
  child.kill();
}, 8000);

async function main() {
  const permissions = await readManifestPermissions();
  const activationState = {
    settings: { "examplePdfExtension.targetLang": "zh-CN" },
    globalState: {},
    workspaceState: {},
  };
  const baseEnvelope = {
    taskId: "task",
    extensionId: "example-pdf-extension",
    workspaceRoot: "/tmp/workspace",
    itemId: "",
    itemHandle: "",
    referenceId: "ref-123",
    capability: "",
    targetKind: "referencePdf",
    targetPath: "/tmp/paper.pdf",
  };

  const activate = await call("Activate", {
    extensionId: "example-pdf-extension",
    activationEvent: "onCommand:examplePdfExtension.inspectRuntimeApis",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    permissions,
    activationState,
  });

  const runtimeApis = await call("ExecuteCommand", {
    activationEvent: "onCommand:examplePdfExtension.inspectRuntimeApis",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    commandId: "examplePdfExtension.inspectRuntimeApis",
    envelope: {
      ...baseEnvelope,
      commandId: "examplePdfExtension.inspectRuntimeApis",
      settingsJson: JSON.stringify({ "examplePdfExtension.targetLang": "zh-CN" }),
    },
  });

  const runtimeOnly = await call("ExecuteCommand", {
    activationEvent: "onCommand:examplePdfExtension.captureContext",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    commandId: "examplePdfExtension.captureContext",
    envelope: {
      ...baseEnvelope,
      commandId: "examplePdfExtension.captureContext",
      settingsJson: JSON.stringify({ "examplePdfExtension.targetLang": "zh-CN" }),
    },
  });

  const invokedCapability = await call("InvokeCapability", {
    activationEvent: "onCapability:pdf.translate",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    envelope: {
      ...baseEnvelope,
      capability: "pdf.translate",
      settingsJson: JSON.stringify({ "examplePdfExtension.targetLang": "zh-CN" }),
    },
  });

  const processApis = await call("ExecuteCommand", {
    activationEvent: "onCommand:examplePdfExtension.inspectProcessApi",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    commandId: "examplePdfExtension.inspectProcessApi",
    envelope: {
      ...baseEnvelope,
      commandId: "examplePdfExtension.inspectProcessApi",
      settingsJson: JSON.stringify({ "examplePdfExtension.targetLang": "zh-CN" }),
    },
  });

  const processExecApis = await call("ExecuteCommand", {
    activationEvent: "onCommand:examplePdfExtension.inspectProcessExecApi",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    commandId: "examplePdfExtension.inspectProcessExecApi",
    envelope: {
      ...baseEnvelope,
      commandId: "examplePdfExtension.inspectProcessExecApi",
      settingsJson: JSON.stringify({ "examplePdfExtension.targetLang": "zh-CN" }),
    },
  });

  const pdfTextApis = await call("ExecuteCommand", {
    activationEvent: "onCommand:examplePdfExtension.inspectPdfTextApi",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    commandId: "examplePdfExtension.inspectPdfTextApi",
    envelope: {
      ...baseEnvelope,
      commandId: "examplePdfExtension.inspectPdfTextApi",
      settingsJson: JSON.stringify({ "examplePdfExtension.targetLang": "zh-CN" }),
    },
  });

  send("UpdateSettings", {
    extensionId: "example-pdf-extension",
    settings: { "examplePdfExtension.targetLang": "en" },
  });
  const settingsChanged = await waitForObserved(
    (message) =>
      message.kind === "ViewStateChanged" &&
      String(message.payload?.message || "").includes("Settings updated: examplePdfExtension.targetLang"),
  );

  const capture = await call("ExecuteCommand", {
    activationEvent: "onCommand:examplePdfExtension.captureContext",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    commandId: "examplePdfExtension.captureContext",
    envelope: {
      ...baseEnvelope,
      commandId: "examplePdfExtension.captureContext",
      settingsJson: JSON.stringify({ "examplePdfExtension.targetLang": "zh-CN" }),
    },
  });

  const translate = await call("ExecuteCommand", {
    activationEvent: "onCommand:scribeflow.pdf.translate",
    extensionPath,
    manifestPath,
    mainEntry: "./dist/extension.js",
    commandId: "scribeflow.pdf.translate",
    envelope: {
      ...baseEnvelope,
      commandId: "scribeflow.pdf.translate",
      settingsJson: JSON.stringify({ "examplePdfExtension.targetLang": "zh-CN" }),
    },
  });

  const translateHostCallKinds = observed
    .filter(
      (entry) =>
        entry.kind === "HostCallRequested" &&
        String(entry.payload?.payload?.taskId || "") === "task",
    )
    .map((entry) => String(entry.payload?.kind || ""));
  const translateProcessSpawnObserved = translateHostCallKinds.includes("process.spawn");
  const translateProcessWaitObserved = translateHostCallKinds.includes("process.wait");
  const translateTaskUpdateObserved = translateHostCallKinds.includes("tasks.update");

  const hostCallKinds = observed
    .filter((entry) => entry.kind === "HostCallRequested")
    .map((entry) => String(entry.payload?.kind || ""));
  const processExecObserved = hostCallKinds.includes("process.exec");
  const processWaitObserved = hostCallKinds.includes("process.wait");
  const processSpawnObserved = hostCallKinds.includes("process.spawn");
  const pdfExtractTextObserved = hostCallKinds.includes("pdf.extractText");
  const taskUpdateObserved = hostCallKinds.includes("tasks.update");
  const runtimeCommands = activate?.payload?.registeredCommands || [];
  const runtimeActions = activate?.payload?.registeredMenuActions || [];
  const resultActionKinds = (
    observed.find(
      (entry) =>
        entry.kind === "ViewStateChanged" &&
        Array.isArray(entry.payload?.resultEntries) &&
        entry.payload.resultEntries.length > 0,
    )?.payload?.resultEntries || []
  ).map((entry) => ({
    id: entry.id,
    action: entry.action,
    extensionId: entry.extensionId || "",
    targetPath: entry.targetPath || "",
    path: entry.path || "",
    previewMode: entry.previewMode || "",
    previewPath: entry.previewPath || "",
    previewTitle: entry.previewTitle || "",
    payloadKeys: entry.payload ? Object.keys(entry.payload) : [],
  }));
  const richSidebarState = observed.find(
    (entry) =>
      entry.kind === "ViewStateChanged" &&
      Array.isArray(entry.payload?.sections) &&
      entry.payload.sections.length > 0 &&
      Array.isArray(entry.payload?.resultEntries),
  ) || null;
  const summary = {
    runtimeCommands,
    runtimeActionSurfaces: runtimeActions.map((entry) => entry.surface),
    manifestPermissions: permissions,
    runtimeOnlyTaskState: runtimeOnly?.payload?.taskState || "",
    capabilityTaskState: invokedCapability?.payload?.taskState || "",
    processTaskState: processApis?.payload?.taskState || "",
    processExecTaskState: processExecApis?.payload?.taskState || "",
    pdfTextTaskState: pdfTextApis?.payload?.taskState || "",
    translateTaskState: translate?.payload?.taskState || "",
    processExecObserved,
    processSpawnObserved,
    processWaitObserved,
    pdfExtractTextObserved,
    taskUpdateObserved,
    translateProcessSpawnObserved,
    translateProcessWaitObserved,
    translateTaskUpdateObserved,
    resultActionKinds,
    settingsChangedMessage: String(settingsChanged?.payload?.message || ""),
    richSidebarSectionCount: Array.isArray(richSidebarState?.payload?.sections)
      ? richSidebarState.payload.sections.length
      : 0,
  };

  ensure(runtimeCommands.includes("examplePdfExtension.captureContext"), "runtime-only command was not registered", summary);
  ensure(runtimeCommands.includes("examplePdfExtension.inspectPdfApi"), "pdf inspection command was not registered", summary);
  ensure(runtimeCommands.includes("examplePdfExtension.inspectPdfTextApi"), "pdf text inspection command was not registered", summary);
  ensure(runtimeCommands.includes("examplePdfExtension.inspectProcessApi"), "process inspection command was not registered", summary);
  ensure(runtimeCommands.includes("examplePdfExtension.inspectProcessExecApi"), "process exec inspection command was not registered", summary);
  ensure(permissions.readWorkspaceFiles === true, "manifest no longer grants workspace PDF access", summary);
  ensure(permissions.readReferenceLibrary === true, "manifest no longer grants reference library access", summary);
  ensure(permissions.spawnProcess === true, "manifest no longer grants process access", summary);
  ensure(runtimeOnly?.payload?.accepted === true, "runtime-only command was not accepted", summary);
  ensure(runtimeOnly?.payload?.taskState === "succeeded", "runtime-only command did not succeed", summary);
  ensure(invokedCapability?.payload?.accepted === true, "capability invocation was not accepted", summary);
  ensure(invokedCapability?.payload?.taskState === "succeeded", "capability invocation did not succeed", summary);
  ensure(processApis?.payload?.accepted === true, "process command was not accepted", summary);
  ensure(processApis?.payload?.taskState === "succeeded", "process command did not succeed", summary);
  ensure(processExecApis?.payload?.accepted === true, "process exec command was not accepted", summary);
  ensure(processExecApis?.payload?.taskState === "succeeded", "process exec command did not succeed", summary);
  ensure(pdfTextApis?.payload?.accepted === true, "pdf text command was not accepted", summary);
  ensure(pdfTextApis?.payload?.taskState === "succeeded", "pdf text command did not succeed", summary);
  ensure(processExecObserved, "process.exec was not observed through host call bridge", summary);
  ensure(processSpawnObserved, "process.spawn was not observed through host call bridge", summary);
  ensure(processWaitObserved, "process.wait was not observed through host call bridge", summary);
  ensure(pdfExtractTextObserved, "pdf.extractText was not observed through host call bridge", summary);
  ensure(taskUpdateObserved, "tasks.update was not observed through host call bridge", summary);
  ensure(translateProcessSpawnObserved, "translation command did not spawn a local worker", summary);
  ensure(translateProcessWaitObserved, "translation command did not wait for the local worker", summary);
  ensure(translateTaskUpdateObserved, "translation command did not emit task updates", summary);
  ensure(
    String(settingsChanged?.payload?.message || "").includes("Settings updated: examplePdfExtension.targetLang"),
    "settings change event did not propagate into plugin runtime",
    summary,
  );
  ensure(translate?.payload?.taskState === "succeeded", "translation command did not finish successfully", summary);
  ensure(resultActionKinds.some((entry) => entry.action === "open-tab"), "open-tab result entry missing", summary);
  ensure(resultActionKinds.some((entry) => entry.action === "reveal"), "reveal result entry missing", summary);
  ensure(resultActionKinds.some((entry) => entry.action === "execute-command"), "execute-command result entry missing", summary);
  ensure(resultActionKinds.some((entry) => entry.action === "open-reference"), "open-reference result entry missing", summary);
  ensure(resultActionKinds.some((entry) => entry.previewMode === "html"), "html preview result entry missing", summary);
  ensure(resultActionKinds.some((entry) => entry.previewMode === "text"), "text preview result entry missing", summary);
  ensure(
    resultActionKinds.some(
      (entry) =>
        entry.id === "translation-text-output" &&
        entry.previewMode === "text" &&
        entry.previewPath.endsWith(".translation.txt"),
    ),
    "text artifact result entry missing",
    summary,
  );
  ensure(resultActionKinds.some((entry) => entry.previewTitle === "Translated Text Output"), "translation output preview missing", summary);
  ensure(summary.richSidebarSectionCount > 0, "rich sidebar sections were not emitted", summary);

  console.log(JSON.stringify({ ok: true, summary }, null, 2));
  child.kill();
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error?.message || String(error),
    details: error?.details || null,
  }, null, 2));
  process.exitCode = 1;
  child.kill();
});
