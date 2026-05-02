import path from "node:path"

const VIEW_ID = "retainPdf.panel"
const COMMAND_TRANSLATE = "retainPdf.translateCurrent"
const COMMAND_REFRESH = "retainPdf.refreshView"
const COMMAND_CAPTURE = "retainPdf.captureContext"
const CAPABILITY_TRANSLATE = "pdf.translate"

function currentResource(context) {
  return context.documents?.resource || { kind: "", path: "", filename: "" }
}

function currentTarget(context) {
  return context.documents?.target || { kind: "", referenceId: "", path: "" }
}

function currentReference(context) {
  return context.references?.current || { id: "", hasReference: false, pdfPath: "" }
}

function currentPdf(context) {
  return context.pdf?.current || { path: "", isPdf: false, filename: "", referenceId: "" }
}

function activePdfPath(context, payload = {}) {
  return String(
    payload?.targetPath ||
    payload?.path ||
    currentPdf(context).path ||
    currentTarget(context).path ||
    currentResource(context).path ||
    "",
  ).trim()
}

function activeReferenceId(context, payload = {}) {
  return String(
    payload?.referenceId ||
    currentReference(context).id ||
    currentPdf(context).referenceId ||
    currentTarget(context).referenceId ||
    "",
  ).trim()
}

function basename(filePath = "") {
  return String(filePath || "").split(/[\\/]/).pop() || "document.pdf"
}

function withoutPdfSuffix(name = "") {
  return String(name || "document.pdf").replace(/\.pdf$/i, "")
}

function setting(context, key = "", fallback = "") {
  return context.settings.get(`retainPdf.${key}`, fallback)
}

function numberSetting(context, key = "", fallback = 0) {
  const value = Number(setting(context, key, fallback))
  return Number.isFinite(value) ? value : fallback
}

function boolSetting(context, key = "", fallback = false) {
  const value = setting(context, key, fallback)
  if (typeof value === "boolean") return value
  const normalized = String(value || "").trim().toLowerCase()
  if (["true", "1", "yes", "on"].includes(normalized)) return true
  if (["false", "0", "no", "off"].includes(normalized)) return false
  return fallback
}

function collectSettings(context) {
  return {
    apiBaseUrl: String(setting(context, "apiBaseUrl", "http://127.0.0.1:41000")),
    apiKey: String(setting(context, "apiKey", "")),
    ocrProvider: String(setting(context, "ocrProvider", "mineru")),
    mineruToken: String(setting(context, "mineruToken", "")),
    paddleToken: String(setting(context, "paddleToken", "")),
    modelBaseUrl: String(setting(context, "modelBaseUrl", "https://api.deepseek.com/v1")),
    model: String(setting(context, "model", "deepseek-v4-flash")),
    modelApiKey: String(setting(context, "modelApiKey", "")),
    workflow: String(setting(context, "workflow", "book")),
    pageRanges: String(setting(context, "pageRanges", "")),
    developerMode: boolSetting(context, "developerMode", true),
    pollIntervalSeconds: numberSetting(context, "pollIntervalSeconds", 5),
    timeoutSeconds: numberSetting(context, "timeoutSeconds", 1800),
  }
}

function splitWorkerSettings(settings = {}) {
  const publicSettings = { ...settings }
  delete publicSettings.apiKey
  delete publicSettings.mineruToken
  delete publicSettings.paddleToken
  delete publicSettings.modelApiKey
  return {
    publicSettings,
    secretEnv: {
      RETAIN_PDF_API_KEY: String(settings.apiKey || ""),
      RETAIN_PDF_MINERU_TOKEN: String(settings.mineruToken || ""),
      RETAIN_PDF_PADDLE_TOKEN: String(settings.paddleToken || ""),
      RETAIN_PDF_MODEL_API_KEY: String(settings.modelApiKey || ""),
    },
  }
}

function settingStatus(context) {
  const settings = collectSettings(context)
  const provider = settings.ocrProvider === "paddle" ? "PaddleOCR" : "MinerU"
  const ocrConfigured = settings.ocrProvider === "paddle"
    ? Boolean(settings.paddleToken.trim())
    : Boolean(settings.mineruToken.trim())
  const modelConfigured = Boolean(settings.modelApiKey.trim())
  const apiConfigured = Boolean(settings.apiKey.trim())
  return {
    provider,
    ocrConfigured,
    modelConfigured,
    apiConfigured,
    ready: ocrConfigured && modelConfigured,
    summary: [
      provider,
      ocrConfigured ? "OCR token configured" : "OCR token missing",
      modelConfigured ? "model key configured" : "model key missing",
      apiConfigured ? "API key configured" : "API key empty",
    ].join(" · "),
  }
}

function buildOutputPaths(context, sourcePdf = "") {
  const workspaceRoot = String(context.workspace?.rootPath || "").trim()
  const taskId = String(context.tasks?.current?.id || "").trim() || `manual-${Date.now()}`
  const sourceName = basename(sourcePdf)
  const stem = withoutPdfSuffix(sourceName).replace(/[^\w.\-()[\]\s]+/g, "_")
  const outputDir = path.join(workspaceRoot, ".scribeflow", "extensions", "retain-pdf", "artifacts", taskId)
  return {
    outputDir,
    settingsPath: path.join(outputDir, "settings.json"),
    resultPath: path.join(outputDir, "result.json"),
    logPath: path.join(outputDir, "retain-pdf.log"),
    translatedPdfPath: path.join(outputDir, `${stem}.translated.pdf`),
    translatedTextPath: path.join(outputDir, `${stem}.translation.md`),
  }
}

function contextSections(context, overrides = {}) {
  const pdf = currentPdf(context)
  const reference = currentReference(context)
  const settings = collectSettings(context)
  const status = settingStatus(context)
  const targetPath = String(overrides.targetPath || pdf.path || currentResource(context).path || "")
  return [
    {
      id: "active-pdf",
      kind: "context",
      title: "Active PDF",
      value: targetPath || "No active PDF",
    },
    {
      id: "reference",
      kind: "context",
      title: "Reference",
      value: reference.id || "No linked reference",
    },
    {
      id: "retain-api",
      kind: "config",
      title: "RetainPDF API",
      value: settings.apiBaseUrl || "http://127.0.0.1:41000",
    },
    {
      id: "provider",
      kind: status.ready ? "status" : "warning",
      title: "Provider",
      value: overrides.providerStatus || status.summary,
    },
    {
      id: "workflow",
      kind: "config",
      title: "Workflow",
      value: `${settings.workflow || "book"}${settings.pageRanges ? ` · pages ${settings.pageRanges}` : ""}`,
    },
  ]
}

function resultEntriesFor(context, paths = {}, summary = {}, sourcePdf = "") {
  const targetPath = String(sourcePdf || summary.sourcePdf || currentPdf(context).path || currentResource(context).path || "")
  const referenceId = activeReferenceId(context)
  const translatedPdfPath = String(summary.translatedPdfPath || paths.translatedPdfPath || "")
  const translatedTextPath = String(summary.translatedTextPath || paths.translatedTextPath || "")
  const logPath = String(summary.logPath || paths.logPath || "")
  const entries = []
  if (translatedPdfPath) {
    entries.push({
      id: "retain-pdf-translated-pdf",
      label: "Open Translated PDF",
      description: basename(translatedPdfPath),
      action: "open",
      path: translatedPdfPath,
      mediaType: "application/pdf",
      previewMode: "pdf",
      previewPath: translatedPdfPath,
      previewTitle: "RetainPDF Translated PDF",
      targetKind: "pdf",
      targetPath: translatedPdfPath,
      referenceId,
    })
    entries.push({
      id: "retain-pdf-reveal-translated-pdf",
      label: "Reveal Translated PDF",
      description: translatedPdfPath,
      action: "reveal",
      path: translatedPdfPath,
      mediaType: "application/pdf",
    })
  }
  if (translatedTextPath) {
    entries.push({
      id: "retain-pdf-translated-text",
      label: "Open Translation Text",
      description: basename(translatedTextPath),
      action: "open",
      path: translatedTextPath,
      mediaType: "text/markdown",
      previewMode: "text",
      previewPath: translatedTextPath,
      previewTitle: "RetainPDF Text Output",
      referenceId,
    })
  }
  if (logPath) {
    entries.push({
      id: "retain-pdf-log",
      label: "Open RetainPDF Log",
      description: basename(logPath),
      action: "open",
      path: logPath,
      mediaType: "text/plain",
      previewMode: "text",
      previewPath: logPath,
      previewTitle: "RetainPDF Log",
    })
  }
  if (targetPath) {
    entries.push({
      id: "retain-pdf-rerun",
      label: "Run RetainPDF Again",
      description: basename(targetPath),
      action: "execute-command",
      commandId: COMMAND_TRANSLATE,
      targetKind: "pdf",
      targetPath,
      referenceId,
      payload: {
        extensionId: "retain-pdf",
      },
    })
  }
  return entries
}

function artifactsFor(paths = {}, summary = {}, sourcePdf = "") {
  const artifacts = []
  if (summary.translatedPdfPath || paths.translatedPdfPath) {
    artifacts.push({
      id: "retain-pdf-translated-pdf",
      kind: "translated-pdf",
      mediaType: "application/pdf",
      path: String(summary.translatedPdfPath || paths.translatedPdfPath),
      sourcePath: sourcePdf,
    })
  }
  if (summary.translatedTextPath || paths.translatedTextPath) {
    artifacts.push({
      id: "retain-pdf-translated-text",
      kind: "translated-text",
      mediaType: "text/markdown",
      path: String(summary.translatedTextPath || paths.translatedTextPath),
      sourcePath: sourcePdf,
    })
  }
  if (summary.logPath || paths.logPath) {
    artifacts.push({
      id: "retain-pdf-log",
      kind: "log",
      mediaType: "text/plain",
      path: String(summary.logPath || paths.logPath),
      sourcePath: sourcePdf,
    })
  }
  return artifacts
}

function summaryOutput(context, summary = {}, sourcePdf = "") {
  const status = String(summary.status || "running")
  const lines = [
    `Status: ${status}`,
    `Source: ${sourcePdf || summary.sourcePdf || "No active PDF"}`,
    `Reference: ${activeReferenceId(context) || "None"}`,
    `RetainPDF job: ${summary.retainPdfJobId || "Not created yet"}`,
    `Stage: ${summary.finalStage || "queued"}`,
    summary.finalStageDetail ? `Detail: ${summary.finalStageDetail}` : "",
    summary.message ? `Message: ${summary.message}` : "",
  ].filter(Boolean)
  return {
    id: "retain-pdf-summary",
    type: "inlineText",
    mediaType: "text/plain",
    title: "RetainPDF Summary",
    description: sourcePdf || summary.sourcePdf || "",
    text: lines.join("\n"),
  }
}

function updatePanel(context, overrides = {}) {
  const pdf = currentPdf(context)
  const sourcePdf = String(overrides.sourcePdf || pdf.path || currentResource(context).path || "")
  const status = settingStatus(context)
  context.views.updateView(VIEW_ID, {
    title: "RetainPDF",
    description: overrides.description ?? "Layout-preserving PDF translation",
    message: overrides.message ?? (sourcePdf
      ? `Ready for ${basename(sourcePdf)}`
      : "Open a PDF or select a reference with a PDF to run RetainPDF."),
    badgeValue: overrides.badgeValue ?? (sourcePdf ? 1 : 0),
    badgeTooltip: sourcePdf ? "RetainPDF can process the active PDF." : "No active PDF.",
    statusLabel: overrides.statusLabel ?? (sourcePdf && status.ready ? "Ready" : "Needs Settings"),
    statusTone: overrides.statusTone ?? (sourcePdf && status.ready ? "success" : "warning"),
    actionLabel: overrides.actionLabel ?? (sourcePdf ? "Run RetainPDF from the PDF action or panel item" : "Open a PDF first"),
    sections: overrides.sections ?? contextSections(context, overrides),
    resultEntries: overrides.resultEntries ?? resultEntriesFor(context, overrides.paths || {}, overrides.summary || {}, sourcePdf),
    artifacts: Array.isArray(overrides.artifacts) ? overrides.artifacts : artifactsFor(overrides.paths || {}, overrides.summary || {}, sourcePdf),
    outputs: Array.isArray(overrides.outputs)
      ? overrides.outputs
      : [summaryOutput(context, overrides.summary || {}, sourcePdf)],
  })
}

async function writeJsonThroughHost(context, filePath = "", payload = {}) {
  const script = [
    "const fs = require('node:fs')",
    "const path = require('node:path')",
    "const filePath = process.argv[1]",
    "const payload = process.argv[2] || '{}'",
    "fs.mkdirSync(path.dirname(filePath), { recursive: true })",
    "fs.writeFileSync(filePath, payload)",
  ].join(";")
  const result = await context.process.exec("node", {
    args: ["-e", script, filePath, JSON.stringify(payload, null, 2)],
    cwd: context.workspace?.rootPath || "",
  })
  if (!result?.ok) {
    throw new Error(String(result?.stderr || "Failed to write RetainPDF worker settings"))
  }
}

async function readJsonThroughHost(context, filePath = "") {
  const script = [
    "const fs = require('node:fs')",
    "const filePath = process.argv[1]",
    "process.stdout.write(fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '{}')",
  ].join(";")
  const result = await context.process.exec("node", {
    args: ["-e", script, filePath],
    cwd: context.workspace?.rootPath || "",
  })
  if (!result?.ok) return {}
  try {
    return JSON.parse(String(result.stdout || "{}"))
  } catch {
    return {}
  }
}

async function runRetainPdf(context, payload = {}) {
  const sourcePdf = activePdfPath(context, payload)
  if (!sourcePdf || !sourcePdf.toLowerCase().endsWith(".pdf")) {
    const summary = {
      status: "failed",
      sourcePdf,
      message: "RetainPDF requires the active target to be a PDF.",
    }
    updatePanel(context, {
      sourcePdf,
      summary,
      statusLabel: "No PDF",
      statusTone: "warning",
      message: summary.message,
    })
    return {
      taskState: "failed",
      progressLabel: "No active PDF",
      message: summary.message,
      outputs: [summaryOutput(context, summary, sourcePdf)],
    }
  }

  const settings = collectSettings(context)
  const status = settingStatus(context)
  if (!status.ready) {
    const summary = {
      status: "failed",
      sourcePdf,
      message: `RetainPDF settings are incomplete: ${status.summary}`,
    }
    updatePanel(context, {
      sourcePdf,
      summary,
      statusLabel: "Settings Missing",
      statusTone: "warning",
      message: summary.message,
    })
    return {
      taskState: "failed",
      progressLabel: "RetainPDF settings missing",
      message: summary.message,
      outputs: [summaryOutput(context, summary, sourcePdf)],
    }
  }

  const paths = buildOutputPaths(context, sourcePdf)
  const workerSettings = splitWorkerSettings(settings)
  await writeJsonThroughHost(context, paths.settingsPath, workerSettings.publicSettings)

  await context.tasks.update({
    state: "running",
    progressLabel: `RetainPDF processing ${basename(sourcePdf)}`,
    outputs: [summaryOutput(context, { status: "running", sourcePdf, logPath: paths.logPath }, sourcePdf)],
    artifacts: [
      {
        id: "retain-pdf-log",
        kind: "log",
        mediaType: "text/plain",
        path: paths.logPath,
        sourcePath: sourcePdf,
      },
    ],
  })

  updatePanel(context, {
    sourcePdf,
    paths,
    statusLabel: "Running",
    statusTone: "warning",
    message: `RetainPDF is processing ${basename(sourcePdf)}.`,
    actionLabel: "Use the task panel to cancel or inspect progress",
    outputs: [summaryOutput(context, { status: "running", sourcePdf, logPath: paths.logPath }, sourcePdf)],
    artifacts: artifactsFor({ logPath: paths.logPath }, {}, sourcePdf),
  })

  const workerPath = path.join(context.extension.extensionPath, "worker", "retain-pdf-worker.mjs")
  const worker = await context.process.spawn("node", {
    args: [
      workerPath,
      "--sourcePdf", sourcePdf,
      "--settings", paths.settingsPath,
      "--result", paths.resultPath,
      "--log", paths.logPath,
      "--outputDir", paths.outputDir,
      "--translatedPdf", paths.translatedPdfPath,
      "--translatedText", paths.translatedTextPath,
    ],
    cwd: context.workspace?.rootPath || "",
    env: workerSettings.secretEnv,
  })
  const waited = await worker.wait()
  const summary = await readJsonThroughHost(context, paths.resultPath)
  const finalState = waited?.ok
    ? String(summary.status || "succeeded")
    : String(summary.status || "failed")
  const normalizedState = ["succeeded", "failed", "cancelled"].includes(finalState) ? finalState : "failed"
  const finalSummary = {
    ...summary,
    status: normalizedState,
    sourcePdf,
    logPath: summary.logPath || paths.logPath,
  }
  const finalArtifacts = artifactsFor(paths, finalSummary, sourcePdf)
  const finalOutputs = [summaryOutput(context, finalSummary, sourcePdf)]
  const finalEntries = resultEntriesFor(context, paths, finalSummary, sourcePdf)
  const ok = normalizedState === "succeeded"

  await context.tasks.update({
    state: normalizedState,
    progressLabel: ok ? "RetainPDF completed" : normalizedState === "cancelled" ? "RetainPDF cancelled" : "RetainPDF failed",
    error: ok ? "" : String(finalSummary.message || "RetainPDF worker failed"),
    artifacts: finalArtifacts,
    outputs: finalOutputs,
  })

  updatePanel(context, {
    sourcePdf,
    paths,
    summary: finalSummary,
    statusLabel: ok ? "Completed" : normalizedState === "cancelled" ? "Cancelled" : "Failed",
    statusTone: ok ? "success" : "warning",
    message: finalSummary.message || (ok ? "RetainPDF completed." : "RetainPDF failed."),
    actionLabel: ok ? "Open the translated PDF or inspect the log" : "Open the log, fix settings, or rerun",
    resultEntries: finalEntries,
    artifacts: finalArtifacts,
    outputs: finalOutputs,
  })
  context.views.refresh(VIEW_ID)

  return {
    taskState: normalizedState,
    progressLabel: ok ? "RetainPDF completed" : normalizedState === "cancelled" ? "RetainPDF cancelled" : "RetainPDF failed",
    message: finalSummary.message || (ok ? "RetainPDF completed." : "RetainPDF failed."),
    resultEntries: finalEntries,
    artifacts: finalArtifacts,
    outputs: finalOutputs,
    changedViews: [VIEW_ID],
  }
}

export async function activate(context) {
  const treeView = context.views.createTreeView(VIEW_ID)
  const launchCount = Number(context.globalState.get("retainPdfLaunchCount") || 0) + 1
  context.globalState.update("retainPdfLaunchCount", launchCount)

  context.menus.registerAction(COMMAND_TRANSLATE, {
    surface: "commandPalette",
    title: "Translate Current PDF",
    category: "RetainPDF",
    when: "resourceExtname == .pdf || resource.kind == pdf",
  })
  context.menus.registerAction(COMMAND_TRANSLATE, {
    surface: "pdf.preview.actions",
    title: "RetainPDF",
    category: "PDF",
    when: "resource.kind == pdf",
  })
  context.menus.registerAction(COMMAND_REFRESH, {
    surface: "view/title",
    title: "Refresh",
    category: "RetainPDF",
    when: "activeView == extension:retainPdf.tools",
  })
  context.menus.registerAction(COMMAND_TRANSLATE, {
    surface: "view/item/context",
    title: "Translate With RetainPDF",
    category: "RetainPDF",
    when: "viewItem.contextValue == retain-pdf-target",
  })

  context.capabilities.registerProvider(CAPABILITY_TRANSLATE, async (request = {}) => {
    return runRetainPdf(context, request)
  })

  context.commands.registerCommand(COMMAND_TRANSLATE, async (payload = {}) => {
    const result = await context.capabilities.invoke(CAPABILITY_TRANSLATE, {
      ...payload,
      targetKind: "pdf",
      targetPath: activePdfPath(context, payload),
      referenceId: activeReferenceId(context, payload),
    })
    if (String(result?.taskState || "") === "succeeded") {
      await context.window.showInformationMessage("RetainPDF translation completed")
    } else if (String(result?.taskState || "") === "failed") {
      await context.window.showErrorMessage("RetainPDF translation failed")
    }
    return result
  }, {
    title: "Translate Current PDF",
    category: "RetainPDF",
    when: "resourceExtname == .pdf || resource.kind == pdf",
  })

  context.commands.registerCommand(COMMAND_REFRESH, async () => {
    updatePanel(context, {
      description: `Layout-preserving PDF translation · launched ${launchCount} times`,
      message: activePdfPath(context)
        ? `Ready for ${basename(activePdfPath(context))}`
        : "Open a PDF or select a reference with a PDF to run RetainPDF.",
      statusLabel: activePdfPath(context) ? "Ready" : "Waiting",
      statusTone: activePdfPath(context) ? "success" : "warning",
      actionLabel: activePdfPath(context) ? "Run RetainPDF on the active PDF" : "Open a PDF first",
    })
    context.views.refresh(VIEW_ID)
    return {
      message: "RetainPDF panel refreshed",
      progressLabel: "RetainPDF panel refreshed",
      changedViews: [VIEW_ID],
    }
  }, {
    title: "Refresh RetainPDF Panel",
    category: "RetainPDF",
  })

  context.commands.registerCommand(COMMAND_CAPTURE, async () => {
    const library = await context.references.readCurrentLibrary().catch(() => ({ references: [] }))
    const pdf = currentPdf(context)
    const metadata = pdf.path ? await context.pdf.extractMetadata(pdf.path).catch(() => ({})) : {}
    updatePanel(context, {
      statusLabel: pdf.path ? "Context Ready" : "Waiting",
      statusTone: pdf.path ? "success" : "warning",
      message: `PDF: ${pdf.path || "none"} · refs:${Array.isArray(library?.references) ? library.references.length : 0}${metadata?.metadata?.title ? ` · ${metadata.metadata.title}` : ""}`,
      actionLabel: "Context captured from ScribeFlow runtime",
    })
    return {
      message: "RetainPDF captured current ScribeFlow context",
      progressLabel: "Context captured",
      changedViews: [VIEW_ID],
    }
  }, {
    title: "Capture RetainPDF Context",
    category: "RetainPDF",
  })

  context.views.registerTreeDataProvider(VIEW_ID, {
    getTitle() {
      return "RetainPDF"
    },
    async getChildren(element) {
      const targetPath = activePdfPath(context)
      if (!element) {
        return [
          {
            id: "retain-pdf-target-group",
            handle: "retain-pdf-target-group",
            kind: "group",
            targetPath,
          },
        ]
      }
      if (String(element?.kind || "") === "group") {
        return [
          {
            id: "retain-pdf-current-target",
            handle: targetPath ? `retain-pdf-current-target:${targetPath}` : "retain-pdf-current-target",
            kind: "target",
            targetPath,
          },
        ]
      }
      return []
    },
    async getTreeItem(element) {
      if (String(element?.kind || "") === "group") {
        return {
          id: "retain-pdf-target-group",
          handle: "retain-pdf-target-group",
          label: "Current PDF",
          description: "Run RetainPDF on the active PDF/reference.",
          tooltip: "Expand to process the current PDF with RetainPDF.",
          contextValue: "retain-pdf-group",
          icon: "folder",
          collapsibleState: "collapsed",
        }
      }
      const targetPath = String(element?.targetPath || "")
      return {
        id: "retain-pdf-current-target",
        handle: String(element?.handle || "retain-pdf-current-target"),
        label: targetPath ? basename(targetPath) : "No active PDF",
        description: targetPath ? "Translate and preserve layout" : "Open a PDF first",
        tooltip: targetPath || "Open a PDF first.",
        contextValue: "retain-pdf-target",
        icon: "file",
        commandId: targetPath ? COMMAND_TRANSLATE : "",
        commandArguments: targetPath
          ? [{
              targetPath,
              referenceId: activeReferenceId(context),
            }]
          : [],
        collapsibleState: "none",
      }
    },
  }, {
    title: "RetainPDF",
    when: "resourceExtname == .pdf || resource.kind == pdf",
  })

  treeView.onDidChangeSelection((event) => {
    const selected = Array.isArray(event?.selection) ? event.selection[0] : null
    const targetPath = String(selected?.targetPath || "")
    if (targetPath) {
      context.workspaceState.update("lastRetainPdfTarget", targetPath)
      updatePanel(context, {
        sourcePdf: targetPath,
        statusLabel: "Target Selected",
        statusTone: "success",
        message: `Selected ${basename(targetPath)} for RetainPDF.`,
        actionLabel: "Run RetainPDF to process this PDF",
      })
    }
  })

  context.settings.onDidChange((event) => {
    const keys = Array.isArray(event?.keys) ? event.keys.filter(Boolean) : []
    if (keys.length === 0) return
    updatePanel(context, {
      statusLabel: settingStatus(context).ready ? "Settings Ready" : "Needs Settings",
      statusTone: settingStatus(context).ready ? "success" : "warning",
      message: `RetainPDF settings updated: ${keys.join(", ")}`,
      actionLabel: "Run RetainPDF with the updated settings",
    })
  })

  updatePanel(context, {
    description: `Layout-preserving PDF translation · launched ${launchCount} times`,
    message: activePdfPath(context)
      ? `Ready for ${basename(activePdfPath(context))}${activeReferenceId(context) ? ` · ref:${activeReferenceId(context)}` : ""}`
      : "Open a PDF or select a reference with a PDF to run RetainPDF.",
  })
}

export async function deactivate() {}
