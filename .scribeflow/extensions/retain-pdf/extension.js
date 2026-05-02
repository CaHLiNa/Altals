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

function tr(context, key = "", vars = {}) {
  return context.i18n?.t ? context.i18n.t(key, vars) : String(key || "")
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
  delete publicSettings.mineruToken
  delete publicSettings.paddleToken
  delete publicSettings.modelApiKey
  return {
    publicSettings,
    secretEnv: {
      RETAIN_PDF_API_BASE_URL: "http://127.0.0.1:41000",
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
  return {
    provider,
    ocrConfigured,
    modelConfigured,
    ready: ocrConfigured && modelConfigured,
    summary: [
      provider,
      ocrConfigured ? tr(context, "runtime.ocrTokenConfigured") : tr(context, "runtime.ocrTokenMissing"),
      modelConfigured ? tr(context, "runtime.modelKeyConfigured") : tr(context, "runtime.modelKeyMissing"),
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
      title: tr(context, "section.activePdf"),
      value: targetPath || tr(context, "value.noActivePdf"),
    },
    {
      id: "reference",
      kind: "context",
      title: tr(context, "section.reference"),
      value: reference.id || tr(context, "value.noLinkedReference"),
    },
    {
      id: "provider",
      kind: status.ready ? "status" : "warning",
      title: tr(context, "section.provider"),
      value: overrides.providerStatus || status.summary,
    },
    {
      id: "workflow",
      kind: "config",
      title: tr(context, "section.workflow"),
      value: `${settings.workflow || "book"}${settings.pageRanges ? ` · ${tr(context, "value.pages", { pages: settings.pageRanges })}` : ""}`,
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
      label: tr(context, "result.openTranslatedPdf"),
      description: basename(translatedPdfPath),
      action: "open",
      path: translatedPdfPath,
      mediaType: "application/pdf",
      previewMode: "pdf",
      previewPath: translatedPdfPath,
      previewTitle: tr(context, "preview.translatedPdf"),
      targetKind: "pdf",
      targetPath: translatedPdfPath,
      referenceId,
    })
    entries.push({
      id: "retain-pdf-reveal-translated-pdf",
      label: tr(context, "result.revealTranslatedPdf"),
      description: translatedPdfPath,
      action: "reveal",
      path: translatedPdfPath,
      mediaType: "application/pdf",
    })
  }
  if (translatedTextPath) {
    entries.push({
      id: "retain-pdf-translated-text",
      label: tr(context, "result.openTranslationText"),
      description: basename(translatedTextPath),
      action: "open",
      path: translatedTextPath,
      mediaType: "text/markdown",
      previewMode: "text",
      previewPath: translatedTextPath,
      previewTitle: tr(context, "preview.textOutput"),
      referenceId,
    })
  }
  if (logPath) {
    entries.push({
      id: "retain-pdf-log",
      label: tr(context, "result.openLog"),
      description: basename(logPath),
      action: "open",
      path: logPath,
      mediaType: "text/plain",
      previewMode: "text",
      previewPath: logPath,
      previewTitle: tr(context, "preview.log"),
    })
  }
  if (targetPath) {
    entries.push({
      id: "retain-pdf-rerun",
      label: tr(context, "result.rerun"),
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
    tr(context, "summary.status", { status }),
    tr(context, "summary.source", { source: sourcePdf || summary.sourcePdf || tr(context, "value.noActivePdf") }),
    tr(context, "summary.reference", { reference: activeReferenceId(context) || tr(context, "value.none") }),
    tr(context, "summary.job", { job: summary.retainPdfJobId || tr(context, "value.jobNotCreated") }),
    tr(context, "summary.stage", { stage: summary.finalStage || tr(context, "value.queued") }),
    summary.finalStageDetail ? tr(context, "summary.detail", { detail: summary.finalStageDetail }) : "",
    summary.message ? tr(context, "summary.message", { message: summary.message }) : "",
  ].filter(Boolean)
  return {
    id: "retain-pdf-summary",
    type: "inlineText",
    mediaType: "text/plain",
    title: tr(context, "summary.title"),
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
    description: overrides.description ?? tr(context, "panel.description"),
    message: overrides.message ?? (sourcePdf
      ? tr(context, "panel.readyFor", { name: basename(sourcePdf) })
      : tr(context, "panel.openPdfFirstMessage")),
    badgeValue: overrides.badgeValue ?? (sourcePdf ? 1 : 0),
    badgeTooltip: sourcePdf ? tr(context, "panel.canProcessPdf") : tr(context, "panel.noActivePdf"),
    statusLabel: overrides.statusLabel ?? (sourcePdf && status.ready ? tr(context, "panel.ready") : tr(context, "panel.needsSettings")),
    statusTone: overrides.statusTone ?? (sourcePdf && status.ready ? "success" : "warning"),
    actionLabel: overrides.actionLabel ?? (sourcePdf ? tr(context, "panel.runFromPdfAction") : tr(context, "panel.openPdfFirstAction")),
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
    throw new Error(String(result?.stderr || tr(context, "error.writeSettingsFailed")))
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
      message: tr(context, "task.requiresPdf"),
    }
    updatePanel(context, {
      sourcePdf,
      summary,
      statusLabel: tr(context, "panel.noPdf"),
      statusTone: "warning",
      message: summary.message,
    })
    return {
      taskState: "failed",
      progressLabel: tr(context, "task.noActivePdf"),
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
      message: tr(context, "task.settingsIncomplete", { summary: status.summary }),
    }
    updatePanel(context, {
      sourcePdf,
      summary,
      statusLabel: tr(context, "panel.settingsMissing"),
      statusTone: "warning",
      message: summary.message,
    })
    return {
      taskState: "failed",
      progressLabel: tr(context, "task.settingsMissing"),
      message: summary.message,
      outputs: [summaryOutput(context, summary, sourcePdf)],
    }
  }

  const paths = buildOutputPaths(context, sourcePdf)
  const workerSettings = splitWorkerSettings(settings)
  await writeJsonThroughHost(context, paths.settingsPath, workerSettings.publicSettings)

  await context.tasks.update({
    state: "running",
    progressLabel: tr(context, "task.processing", { name: basename(sourcePdf) }),
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
    statusLabel: tr(context, "panel.running"),
    statusTone: "warning",
    message: tr(context, "task.processingMessage", { name: basename(sourcePdf) }),
    actionLabel: tr(context, "panel.useTaskPanel"),
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
    progressLabel: ok ? tr(context, "task.completed") : normalizedState === "cancelled" ? tr(context, "task.cancelled") : tr(context, "task.failed"),
    error: ok ? "" : String(finalSummary.message || tr(context, "task.workerFailed")),
    artifacts: finalArtifacts,
    outputs: finalOutputs,
  })

  updatePanel(context, {
    sourcePdf,
    paths,
    summary: finalSummary,
    statusLabel: ok ? tr(context, "panel.completed") : normalizedState === "cancelled" ? tr(context, "panel.cancelled") : tr(context, "panel.failed"),
    statusTone: ok ? "success" : "warning",
    message: finalSummary.message || (ok ? tr(context, "task.completedMessage") : tr(context, "task.failedMessage")),
    actionLabel: ok ? tr(context, "panel.openTranslatedOrLog") : tr(context, "panel.openLogFixSettings"),
    resultEntries: finalEntries,
    artifacts: finalArtifacts,
    outputs: finalOutputs,
  })
  context.views.refresh(VIEW_ID)

  return {
    taskState: normalizedState,
    progressLabel: ok ? tr(context, "task.completed") : normalizedState === "cancelled" ? tr(context, "task.cancelled") : tr(context, "task.failed"),
    message: finalSummary.message || (ok ? tr(context, "task.completedMessage") : tr(context, "task.failedMessage")),
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
    title: tr(context, "command.translateCurrent.title"),
    category: tr(context, "category.retainPdf"),
    when: "resourceExtname == .pdf || resource.kind == pdf",
  })
  context.menus.registerAction(COMMAND_TRANSLATE, {
    surface: "pdf.preview.actions",
    title: "RetainPDF",
    category: tr(context, "category.pdf"),
    when: "resource.kind == pdf",
  })
  context.menus.registerAction(COMMAND_REFRESH, {
    surface: "view/title",
    title: tr(context, "command.refresh.title"),
    category: tr(context, "category.retainPdf"),
    when: "activeView == extension:retainPdf.tools",
  })
  context.menus.registerAction(COMMAND_TRANSLATE, {
    surface: "view/item/context",
    title: tr(context, "command.translateWithRetainPdf"),
    category: tr(context, "category.retainPdf"),
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
      await context.window.showInformationMessage(tr(context, "toast.completed"))
    } else if (String(result?.taskState || "") === "failed") {
      await context.window.showErrorMessage(tr(context, "toast.failed"))
    }
    return result
  }, {
    title: tr(context, "command.translateCurrent.title"),
    category: tr(context, "category.retainPdf"),
    when: "resourceExtname == .pdf || resource.kind == pdf",
  })

  context.commands.registerCommand(COMMAND_REFRESH, async () => {
    updatePanel(context, {
      description: tr(context, "panel.launchedTimes", { count: launchCount }),
      message: activePdfPath(context)
        ? tr(context, "panel.readyFor", { name: basename(activePdfPath(context)) })
        : tr(context, "panel.openPdfFirstMessage"),
      statusLabel: activePdfPath(context) ? tr(context, "panel.ready") : tr(context, "panel.waiting"),
      statusTone: activePdfPath(context) ? "success" : "warning",
      actionLabel: activePdfPath(context) ? tr(context, "panel.runActivePdf") : tr(context, "panel.openPdfFirstAction"),
    })
    context.views.refresh(VIEW_ID)
    return {
      message: tr(context, "event.panelRefreshed"),
      progressLabel: tr(context, "event.panelRefreshed"),
      changedViews: [VIEW_ID],
    }
  }, {
    title: tr(context, "command.refreshView.title"),
    category: tr(context, "category.retainPdf"),
  })

  context.commands.registerCommand(COMMAND_CAPTURE, async () => {
    const library = await context.references.readCurrentLibrary().catch(() => ({ references: [] }))
    const pdf = currentPdf(context)
    const metadata = pdf.path ? await context.pdf.extractMetadata(pdf.path).catch(() => ({})) : {}
    updatePanel(context, {
      statusLabel: pdf.path ? tr(context, "panel.contextReady") : tr(context, "panel.waiting"),
      statusTone: pdf.path ? "success" : "warning",
      message: tr(context, "event.contextMessage", {
        path: pdf.path || tr(context, "value.none"),
        count: Array.isArray(library?.references) ? library.references.length : 0,
        title: metadata?.metadata?.title ? ` · ${metadata.metadata.title}` : "",
      }),
      actionLabel: tr(context, "panel.contextCapturedAction"),
    })
    return {
      message: tr(context, "event.contextCaptured"),
      progressLabel: tr(context, "event.contextCapturedProgress"),
      changedViews: [VIEW_ID],
    }
  }, {
    title: tr(context, "command.captureContext.title"),
    category: tr(context, "category.retainPdf"),
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
          label: tr(context, "tree.currentPdf"),
          description: tr(context, "tree.currentPdfDescription"),
          tooltip: tr(context, "tree.currentPdfTooltip"),
          contextValue: "retain-pdf-group",
          icon: "folder",
          collapsibleState: "collapsed",
        }
      }
      const targetPath = String(element?.targetPath || "")
      return {
        id: "retain-pdf-current-target",
        handle: String(element?.handle || "retain-pdf-current-target"),
        label: targetPath ? basename(targetPath) : tr(context, "value.noActivePdf"),
        description: targetPath ? tr(context, "tree.translatePreserveLayout") : tr(context, "tree.openPdfFirst"),
        tooltip: targetPath || tr(context, "tree.openPdfFirstTooltip"),
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
        statusLabel: tr(context, "panel.targetSelected"),
        statusTone: "success",
        message: tr(context, "event.selected", { name: basename(targetPath) }),
        actionLabel: tr(context, "panel.runSelectedPdf"),
      })
    }
  })

  context.settings.onDidChange((event) => {
    const keys = Array.isArray(event?.keys) ? event.keys.filter(Boolean) : []
    if (keys.length === 0) return
    updatePanel(context, {
      statusLabel: settingStatus(context).ready ? tr(context, "panel.settingsReady") : tr(context, "panel.needsSettings"),
      statusTone: settingStatus(context).ready ? "success" : "warning",
      message: tr(context, "event.settingsUpdated", { keys: keys.join(", ") }),
      actionLabel: tr(context, "panel.runUpdatedSettings"),
    })
  })

  updatePanel(context, {
    description: tr(context, "panel.launchedTimes", { count: launchCount }),
    message: activePdfPath(context)
      ? activeReferenceId(context)
        ? tr(context, "event.readyForWithReference", { name: basename(activePdfPath(context)), referenceId: activeReferenceId(context) })
        : tr(context, "panel.readyFor", { name: basename(activePdfPath(context)) })
      : tr(context, "panel.openPdfFirstMessage"),
  })
}

export async function deactivate() {}
