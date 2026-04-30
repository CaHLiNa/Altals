export async function activate(context) {
  context.capabilities.registerProvider("pdf.translate", async (request) => {
    const payload = JSON.parse(String(request?.settings_json || "{}") || "{}")
    const targetLang = String(payload?.targetLang || "zh-CN")
    return {
      message: `example-pdf-extension handled ${request?.capability || "unknown"} for ${targetLang}`,
      progressLabel: "Example extension provider executed",
    }
  })

  context.commands.registerCommand("scribeflow.pdf.translate", async (payload) => {
    return await context.capabilities.invoke("pdf.translate", payload)
  })
}

export async function deactivate() {}
