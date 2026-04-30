export async function activate(context) {
  context.capabilities.registerProvider("pdf.translate", async (request) => {
    const payload = JSON.parse(String(request?.settingsJson || request?.settings_json || "{}") || "{}")
    const targetLang = String(payload?.["examplePdfExtension.targetLang"] || payload?.targetLang || "zh-CN")
    return {
      message: `example-pdf-extension handled ${request?.capability || "unknown"} for ${targetLang}`,
      progressLabel: "Example extension provider executed",
    }
  })

  context.commands.registerCommand("scribeflow.pdf.translate", async (payload) => {
    return await context.capabilities.invoke("pdf.translate", {
      ...payload,
      capability: "pdf.translate",
    })
  })

  context.views.registerTreeDataProvider("examplePdfExtension.translateView", {
    getTitle() {
      return "Translate PDF"
    },
    async getChildren(element, payload) {
      const targetPath = String(payload?.targetPath || "")
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
  })

  context.views.updateView("examplePdfExtension.translateView", {
    title: "Translate PDF",
    description: "Workspace PDF tools",
    message: "Select a PDF target to start translation.",
    badgeValue: 1,
    badgeTooltip: "One quick action is available for the active PDF.",
  })

  context.commands.registerCommand("examplePdfExtension.refreshTranslateView", async () => {
    context.views.refresh("examplePdfExtension.translateView")
    return {
      message: "example-pdf-extension refreshed sidebar view",
      progressLabel: "Example view refreshed",
    }
  })
}

export async function deactivate() {}
