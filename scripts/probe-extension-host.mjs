import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const hostPath = path.join(repoRoot, "src-tauri/resources/extension-host/extension-host.mjs");
const extensionPath = path.join(repoRoot, ".scribeflow/extensions/example-pdf-extension");
const manifestPath = path.join(extensionPath, "package.json");

const child = spawn("node", [hostPath], {
  cwd: repoRoot,
  stdio: ["pipe", "pipe", "inherit"],
});

const observed = [];
let currentResolve = null;
const observers = [];

function send(method, params) {
  child.stdin.write(`${JSON.stringify({ method, params })}\n`);
}

function isTerminal(message) {
  return ["Activate", "ExecuteCommand", "Error"].includes(message.kind);
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
    if (message.payload.kind === "process.exec") {
      send("ResolveHostCall", {
        requestId: message.payload.requestId,
        accepted: true,
        result: {
          ok: true,
          code: 0,
          stdout: "process-ok",
          stderr: "",
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
  const activationState = {
    settings: { "examplePdfExtension.targetLang": "zh-CN" },
    globalState: {},
    workspaceState: {},
  };
  const permissions = {
    readWorkspaceFiles: true,
    readReferenceLibrary: true,
    writeArtifacts: true,
    writeReferenceMetadata: false,
    spawnProcess: true,
    network: "none",
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

  console.log(
    JSON.stringify(
      {
        activate,
        runtimeApis,
        runtimeOnly,
        processApis,
        settingsChanged,
        capture,
        resultActionKinds: (
          observed.find(
            (entry) =>
              entry.kind === "ViewStateChanged" &&
              Array.isArray(entry.payload?.resultEntries) &&
              entry.payload.resultEntries.length > 0,
          )?.payload?.resultEntries || []
        ).map((entry) => ({
          id: entry.id,
          action: entry.action,
          targetPath: entry.targetPath || "",
          previewMode: entry.previewMode || "",
          previewPath: entry.previewPath || "",
          payloadKeys: entry.payload ? Object.keys(entry.payload) : [],
        })),
        richSidebarState: observed.find(
          (entry) =>
            entry.kind === "ViewStateChanged" &&
            Array.isArray(entry.payload?.sections) &&
            entry.payload.sections.length > 0 &&
            Array.isArray(entry.payload?.resultEntries),
        ) || null,
        observed: observed.filter((entry) =>
          ["ViewStateChanged", "HostCallRequested"].includes(entry.kind),
        ),
      },
      null,
      2,
    ),
  );
  child.kill();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  child.kill();
});
