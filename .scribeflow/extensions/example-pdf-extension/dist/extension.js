export async function activate(context) {
  const translateTreeView = context.views.createTreeView("examplePdfExtension.translateView")
  const launchCount = Number(context.globalState.get("launchCount") || 0) + 1
  context.globalState.update("launchCount", launchCount)
  let lastSettingsChange = ""

  context.menus.registerAction("scribeflow.pdf.translate", {
    surface: "commandPalette",
    title: "Translate",
    category: "PDF",
    when: "resourceExtname == .pdf || resource.kind == pdf",
  })
  context.menus.registerAction("scribeflow.pdf.translate", {
    surface: "pdf.preview.actions",
    title: "Translate",
    category: "PDF",
    when: "resource.kind == pdf",
  })
  context.menus.registerAction("examplePdfExtension.refreshTranslateView", {
    surface: "view/title",
    title: "Refresh Translate View",
    category: "PDF",
    when: "activeView == extension:examplePdfExtension.tools",
  })
  context.menus.registerAction("examplePdfExtension.refreshTranslateView", {
    surface: "view/item/context",
    title: "Refresh Translate View",
    category: "PDF",
    when: "viewItem.contextValue == translation-group",
  })

  function currentDocumentTarget() {
    return context.documents?.target || { kind: "", path: "" }
  }

  function currentResource() {
    return context.documents?.resource || { kind: "", path: "", filename: "" }
  }

  function currentReference() {
    return context.references?.current || { id: "", hasReference: false, pdfPath: "" }
  }

  function currentPdf() {
    return context.pdf?.current || { path: "", isPdf: false, filename: "", referenceId: "" }
  }

  context.capabilities.registerProvider("pdf.translate", async (request) => {
    const payload = JSON.parse(String(request?.settingsJson || request?.settings_json || "{}") || "{}")
    const configuredTargetLang = String(
      context.settings.get("examplePdfExtension.targetLang", "zh-CN") || "zh-CN",
    )
    const targetLang = String(payload?.["examplePdfExtension.targetLang"] || payload?.targetLang || configuredTargetLang)
    const workspaceRoot = String(context.workspace?.rootPath || "")
    const resource = currentResource()
    const reference = currentReference()
    return {
      message: `example-pdf-extension handled ${request?.capability || "unknown"} for ${targetLang}${resource.path ? ` · ${resource.path}` : ""}${reference.id ? ` · ref:${reference.id}` : ""}${workspaceRoot ? ` · ${workspaceRoot}` : ""}`,
      progressLabel: "Example extension provider executed",
    }
  })

  context.commands.registerCommand("scribeflow.pdf.translate", async (payload) => {
    const targetLang = await context.window.showQuickPick(
      [
        { label: "Chinese (Simplified)", description: "zh-CN", value: "zh-CN" },
        { label: "English", description: "en", value: "en" },
      ],
      {
        title: "Translation target language",
        placeHolder: "Choose translation language",
      },
    )
    if (!targetLang) {
      await context.window.showWarningMessage("Translation cancelled")
      return {
        message: "example-pdf-extension cancelled translation",
        progressLabel: "Translation cancelled",
      }
    }
    const activeTarget = currentDocumentTarget()
    const targetPath = String(payload?.targetPath || activeTarget.path || "")
    const result = await context.capabilities.invoke("pdf.translate", {
      ...payload,
      capability: "pdf.translate",
      targetLang,
      targetPath,
    })
    await context.window.showInformationMessage(`PDF translation queued for ${targetPath || "current target"}`)
    return result
  }, {
    title: "Translate",
    category: "PDF",
    when: "resourceExtname == .pdf || resource.kind == pdf",
  })

  context.commands.registerCommand("examplePdfExtension.announceRefresh", async () => {
    const note = await context.window.showInputBox({
      title: "Refresh note",
      prompt: "Annotate this refresh action",
      placeHolder: "Optional note",
      value: "Translate view refreshed",
    })
    await context.window.showInformationMessage(String(note || "Translate view refreshed"))
    return {
      message: "example-pdf-extension announced refresh",
      progressLabel: "Refresh notification sent",
    }
  }, {
    title: "Announce Refresh",
    category: "PDF",
  })

  context.commands.registerCommand("examplePdfExtension.captureContext", async () => {
    const resource = currentResource()
    const reference = currentReference()
    const pdf = currentPdf()
    context.views.updateView("examplePdfExtension.translateView", {
      description: context.workspace?.hasWorkspace
        ? `Workspace PDF tools · launched ${launchCount} times`
        : `PDF tools · launched ${launchCount} times`,
      message: `Context: ${pdf.path || resource.path || "none"}${reference.id ? ` · ref:${reference.id}` : ""}${lastSettingsChange ? ` · settings:${lastSettingsChange}` : ""}`,
    })
    context.views.refresh("examplePdfExtension.translateView")
    return {
      message: `captured context${reference.id ? ` for ${reference.id}` : ""}`,
      progressLabel: "Context captured",
    }
  }, {
    title: "Capture Context",
    category: "PDF",
  })

  context.commands.registerCommand("examplePdfExtension.inspectRuntimeApis", async () => {
    const pdf = currentPdf()
    const library = await context.references.readCurrentLibrary()
    const metadata = pdf.path ? await context.pdf.extractMetadata(pdf.path) : {}
    context.views.updateView("examplePdfExtension.translateView", {
      description: context.workspace?.hasWorkspace
        ? `Workspace PDF tools · launched ${launchCount} times`
        : `PDF tools · launched ${launchCount} times`,
      message: `Runtime APIs: refs:${Array.isArray(library?.references) ? library.references.length : 0}${metadata?.metadata?.title ? ` · title:${metadata.metadata.title}` : ""}`,
    })
    context.views.refresh("examplePdfExtension.translateView")
    return {
      message: "example-pdf-extension inspected runtime apis",
      progressLabel: "Runtime APIs inspected",
    }
  }, {
    title: "Inspect Runtime APIs",
    category: "PDF",
  })

  context.commands.registerCommand("examplePdfExtension.inspectProcessApi", async () => {
    const result = await context.process.exec("node", {
      args: ["-e", "process.stdout.write('process-ok')"],
      cwd: context.workspace?.rootPath || "",
    })
    context.views.updateView("examplePdfExtension.translateView", {
      description: context.workspace?.hasWorkspace
        ? `Workspace PDF tools · launched ${launchCount} times`
        : `PDF tools · launched ${launchCount} times`,
      message: `Process API: ${String(result?.stdout || "").trim() || "empty"}`,
    })
    context.views.refresh("examplePdfExtension.translateView")
    return {
      message: "example-pdf-extension inspected process api",
      progressLabel: "Process API inspected",
    }
  }, {
    title: "Inspect Process API",
    category: "PDF",
  })

  context.views.registerTreeDataProvider("examplePdfExtension.translateView", {
    getTitle() {
      return "Translate PDF"
    },
    async getChildren(element, payload) {
      const targetPath = String(payload?.targetPath || currentDocumentTarget().path || "")
      if (!element) {
        return [
          {
            id: "translate-group",
            handle: "translate-group",
            kind: "group",
            targetPath,
          },
        ]
      }
      if (String(element?.handle || element?.id || "") === "translate-group") {
        return [
          {
            id: "translate-current-pdf",
            handle: targetPath ? `translate-current-pdf:${targetPath}` : "translate-current-pdf",
            kind: "translate-target",
            targetPath,
          },
        ]
      }
      return []
    },
    async getTreeItem(element) {
      if (String(element?.kind || "") === "group") {
        return {
          id: "translate-group",
          handle: "translate-group",
          label: "Translation Actions",
          description: "Commands for the current PDF target.",
          tooltip: "Expand to inspect the available translation actions.",
          contextValue: "translation-group",
          icon: "folder",
          collapsibleState: "collapsed",
        }
      }
      const targetPath = String(element?.targetPath || "")
      const label = targetPath ? targetPath.split(/[\\/]/).pop() : "Current PDF"
      return {
        id: "translate-current-pdf",
        handle: String(element?.handle || "translate-current-pdf"),
        label,
        description: "Run the PDF translation command for the current target.",
        tooltip: targetPath || "Translate the current PDF target.",
        contextValue: "translation-target",
        icon: "file",
        commandId: "scribeflow.pdf.translate",
        commandArguments: [
          {
            source: "treeItem",
            targetPath,
          },
        ],
        collapsibleState: "none",
      }
    },
  }, {
    title: "Translate PDF",
    when: "resourceExtname == .pdf || resource.kind == pdf",
  })

  context.views.updateView("examplePdfExtension.translateView", {
    title: "Translate PDF",
    description: context.workspace?.hasWorkspace ? "Workspace PDF tools" : "PDF tools",
    message: currentPdf().path
      ? `Select a PDF target to start translation.${currentReference().id ? ` Reference: ${currentReference().id}` : ""}`
      : "Open a PDF document to start translation.",
    badgeValue: 1,
    badgeTooltip: "One quick action is available for the active PDF.",
  })

  context.settings.onDidChange((event) => {
    const keys = Array.isArray(event?.keys) ? event.keys.filter(Boolean) : []
    if (keys.length === 0) return
    lastSettingsChange = keys.join(", ")
    context.views.updateView("examplePdfExtension.translateView", {
      description: context.workspace?.hasWorkspace
        ? `Workspace PDF tools · launched ${launchCount} times`
        : `PDF tools · launched ${launchCount} times`,
      message: `Settings updated: ${lastSettingsChange}`,
    })
  })

  translateTreeView.onDidChangeSelection((event) => {
    const selected = Array.isArray(event?.selection) ? event.selection[0] : null
    const label = String(selected?.targetPath || selected?.label || selected?.handle || "")
    context.workspaceState.update("lastSelectedLabel", label)
    context.views.updateView("examplePdfExtension.translateView", {
      message: label
        ? `Selected translation target: ${label}`
        : "Select a PDF target to start translation.",
      description: `Workspace PDF tools · launched ${launchCount} times`,
    })
  })

  context.commands.registerCommand("examplePdfExtension.refreshTranslateView", async () => {
    await context.commands.executeCommand("examplePdfExtension.announceRefresh")
    const resource = currentResource()
    context.views.refresh("examplePdfExtension.translateView")
    context.views.updateView("examplePdfExtension.translateView", {
      description: context.workspace?.hasWorkspace
        ? `Workspace PDF tools · launched ${launchCount} times`
        : `PDF tools · launched ${launchCount} times`,
      message: resource.path
        ? `Ready for ${resource.filename || resource.path}${currentReference().id ? ` · ref:${currentReference().id}` : ""}`
        : "Open a PDF document to start translation.",
    })
    translateTreeView.reveal("translate-group", {
      focus: true,
      select: true,
      expand: true,
    })
    return {
      message: "example-pdf-extension refreshed sidebar view",
      progressLabel: "Example view refreshed",
    }
  }, {
    title: "Refresh Translate View",
    category: "PDF",
  })
}

export async function deactivate() {}
