#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

function parseArgs(argv = []) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "")
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const next = argv[index + 1]
    if (!next || String(next).startsWith("--")) {
      result[key] = "true"
      continue
    }
    result[key] = String(next)
    index += 1
  }
  return result
}

function normalizeBaseUrl(value = "") {
  return String(value || "http://127.0.0.1:41000").trim().replace(/\/+$/, "")
}

function isTerminalStatus(value = "") {
  return ["succeeded", "failed", "canceled", "cancelled"].includes(String(value || "").trim().toLowerCase())
}

function toScribeFlowState(value = "") {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "succeeded") return "succeeded"
  if (normalized === "canceled" || normalized === "cancelled") return "cancelled"
  if (normalized === "failed") return "failed"
  return "running"
}

function safeBasename(filePath = "") {
  const name = path.basename(String(filePath || "").trim()) || "document.pdf"
  return name.replace(/[^\w.\-()[\]\s]+/g, "_")
}

function readSecret(name = "", fallback = "") {
  return String(process.env[name] || fallback || "").trim()
}

async function ensureParent(filePath = "") {
  const parent = path.dirname(filePath)
  await mkdir(parent, { recursive: true })
}

async function appendLog(logPath = "", line = "") {
  if (!logPath) return
  await ensureParent(logPath)
  await writeFile(logPath, `${new Date().toISOString()} ${line}\n`, { flag: "a" })
}

async function writeJson(filePath = "", payload = {}) {
  if (!filePath) return
  await ensureParent(filePath)
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
}

async function fetchJson(url = "", options = {}) {
  const response = await fetch(url, options)
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text }
  }
  if (!response.ok) {
    const message = body?.message || body?.error || text || `HTTP ${response.status}`
    throw new Error(`${message}`)
  }
  if (body && typeof body === "object" && Number(body.code || 0) !== 0) {
    throw new Error(String(body.message || "RetainPDF API returned an error"))
  }
  return body
}

async function downloadFile(url = "", outputPath = "", headers = {}) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await ensureParent(outputPath)
  await writeFile(outputPath, buffer)
  return buffer.length
}

function artifactEndpoint(baseUrl = "", jobId = "", artifact = {}) {
  const direct = String(artifact.resource_url || artifact.resourceUrl || "").trim()
  if (direct) {
    return direct.startsWith("http://") || direct.startsWith("https://")
      ? direct
      : `${baseUrl}${direct.startsWith("/") ? "" : "/"}${direct}`
  }
  const key = String(artifact.artifact_key || artifact.artifactKey || "").trim()
  if (key === "translated_pdf") return `${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/pdf`
  if (key === "markdown_raw") return `${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/markdown?raw=true`
  if (key) {
    return `${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(key)}`
  }
  return ""
}

function findArtifact(manifest = {}, keys = []) {
  const entries = Array.isArray(manifest?.data)
    ? manifest.data
    : Array.isArray(manifest?.data?.artifacts)
      ? manifest.data.artifacts
      : Array.isArray(manifest?.artifacts)
        ? manifest.artifacts
        : []
  return entries.find((entry) => {
    const key = String(entry?.artifact_key || entry?.artifactKey || "").trim()
    return keys.includes(key) && entry?.ready !== false
  }) || null
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const sourcePdf = String(args.sourcePdf || "").trim()
  const settingsPath = String(args.settings || "").trim()
  const resultPath = String(args.result || "").trim()
  const logPath = String(args.log || "").trim()
  const outputDir = String(args.outputDir || "").trim()
  const sourceFilename = safeBasename(sourcePdf)
  const stem = sourceFilename.replace(/\.pdf$/i, "")
  const translatedPdfPath = String(args.translatedPdf || path.join(outputDir, `${stem}.retainpdf.translated.pdf`))
  const translatedTextPath = String(args.translatedText || path.join(outputDir, `${stem}.retainpdf.translation.md`))

  try {
    if (!sourcePdf) {
      throw new Error("sourcePdf is required")
    }
    const settings = settingsPath ? JSON.parse(await readFile(settingsPath, "utf8")) : {}
    const baseUrl = normalizeBaseUrl(process.env.RETAIN_PDF_API_BASE_URL)
    const apiKey = readSecret("RETAIN_PDF_API_KEY", settings.apiKey)
    const headers = apiKey ? { "X-API-Key": apiKey } : {}
    const pollIntervalMs = Math.max(1000, Number(settings.pollIntervalSeconds || 5) * 1000)
    const timeoutMs = Math.max(30, Number(settings.timeoutSeconds || 1800)) * 1000
    const startedAt = Date.now()

    await appendLog(logPath, `RetainPDF worker started for ${sourcePdf}`)
    await appendLog(logPath, `API base: ${baseUrl}`)

    const healthUrl = `${baseUrl}/health`
    await appendLog(logPath, `Checking ${healthUrl}`)
    await fetch(healthUrl).catch((error) => {
      throw new Error(`RetainPDF API is not reachable at ${healthUrl}: ${error.message}`)
    })

    const pdfBytes = await readFile(sourcePdf)
    const uploadForm = new FormData()
    uploadForm.set("file", new Blob([pdfBytes], { type: "application/pdf" }), sourceFilename)
    uploadForm.set("developer_mode", settings.developerMode === false ? "false" : "true")
    await appendLog(logPath, `Uploading ${sourceFilename} (${pdfBytes.length} bytes)`)
    const upload = await fetchJson(`${baseUrl}/api/v1/uploads`, {
      method: "POST",
      headers,
      body: uploadForm,
    })
    const uploadId = String(upload?.data?.upload_id || upload?.data?.uploadId || "").trim()
    if (!uploadId) {
      throw new Error("RetainPDF upload response did not include upload_id")
    }
    await appendLog(logPath, `Upload created: ${uploadId}`)

    const ocrProvider = String(settings.ocrProvider || "mineru").trim().toLowerCase()
    const workflow = String(settings.workflow || "book").trim().toLowerCase() === "translate" ? "translate" : "book"
    const requestBody = {
      workflow,
      source: {
        upload_id: uploadId,
      },
      ocr: {
        provider: ocrProvider,
        mineru_token: ocrProvider === "mineru" ? readSecret("RETAIN_PDF_MINERU_TOKEN", settings.mineruToken) : "",
        paddle_token: ocrProvider === "paddle" ? readSecret("RETAIN_PDF_PADDLE_TOKEN", settings.paddleToken) : "",
        model_version: String(settings.modelVersion || "vlm"),
        language: String(settings.ocrLanguage || "ch"),
        page_ranges: String(settings.pageRanges || ""),
      },
      translation: {
        mode: String(settings.translationMode || "sci"),
        math_mode: String(settings.mathMode || "direct_typst"),
        model: String(settings.model || "deepseek-v4-flash"),
        base_url: String(settings.modelBaseUrl || "https://api.deepseek.com/v1"),
        api_key: readSecret("RETAIN_PDF_MODEL_API_KEY", settings.modelApiKey),
        skip_title_translation: Boolean(settings.skipTitleTranslation),
        batch_size: Number(settings.batchSize || 1),
        workers: Number(settings.workers || 0),
        classify_batch_size: Number(settings.classifyBatchSize || 12),
        rule_profile_name: String(settings.ruleProfileName || "general_sci"),
        custom_rules_text: String(settings.customRulesText || ""),
      },
      render: {
        render_mode: String(settings.renderMode || "auto"),
        compile_workers: Number(settings.compileWorkers || 0),
        translated_pdf_name: `${stem}.retainpdf.translated.pdf`,
      },
      runtime: {
        timeout_seconds: Number(settings.timeoutSeconds || 1800),
      },
    }

    await appendLog(logPath, `Creating RetainPDF ${workflow} job`)
    const job = await fetchJson(`${baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })
    const jobId = String(job?.data?.job_id || job?.data?.jobId || "").trim()
    if (!jobId) {
      throw new Error("RetainPDF create job response did not include job_id")
    }
    await appendLog(logPath, `Job created: ${jobId}`)

    let detail = null
    while (Date.now() - startedAt < timeoutMs) {
      detail = await fetchJson(`${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}`, {
        method: "GET",
        headers,
      })
      const data = detail?.data || {}
      const status = String(data.status || "").trim().toLowerCase()
      const stage = String(data.stage || "").trim()
      const stageDetail = String(data.stage_detail || data.stageDetail || "").trim()
      await appendLog(logPath, `Job ${jobId}: status=${status || "unknown"} stage=${stage || "unknown"} ${stageDetail}`)
      if (isTerminalStatus(status)) break
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    const finalData = detail?.data || {}
    const finalStatus = String(finalData.status || "").trim().toLowerCase()
    if (!isTerminalStatus(finalStatus)) {
      await fetch(`${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: "POST",
        headers,
      }).catch(() => null)
      throw new Error(`RetainPDF job timed out after ${Math.round(timeoutMs / 1000)} seconds`)
    }

    const manifest = await fetchJson(`${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/artifacts-manifest`, {
      method: "GET",
      headers,
    }).catch((error) => {
      return { data: [], manifestError: error.message }
    })
    const eventsUrl = `${baseUrl}/api/v1/jobs/${encodeURIComponent(jobId)}/events`
    const events = await fetchJson(eventsUrl, { method: "GET", headers }).catch((error) => ({
      code: 1,
      message: error.message,
      data: [],
    }))
    await appendLog(logPath, `Events endpoint: ${eventsUrl}`)
    await appendLog(logPath, JSON.stringify(events).slice(0, 8000))

    let translatedPdfBytes = 0
    let translatedTextBytes = 0
    const translatedPdfArtifact = findArtifact(manifest, ["translated_pdf", "typst_render_pdf"])
    const translatedTextArtifact = findArtifact(manifest, ["markdown_raw", "translation_manifest_json", "pipeline_summary"])

    if (finalStatus === "succeeded" && translatedPdfArtifact) {
      const url = artifactEndpoint(baseUrl, jobId, translatedPdfArtifact)
      translatedPdfBytes = await downloadFile(url, translatedPdfPath, headers)
      await appendLog(logPath, `Downloaded translated PDF: ${translatedPdfBytes} bytes`)
    }

    if (finalStatus === "succeeded" && translatedTextArtifact) {
      const url = artifactEndpoint(baseUrl, jobId, translatedTextArtifact)
      translatedTextBytes = await downloadFile(url, translatedTextPath, headers)
      await appendLog(logPath, `Downloaded text artifact: ${translatedTextBytes} bytes`)
    }

    const summary = {
      ok: finalStatus === "succeeded",
      status: toScribeFlowState(finalStatus),
      retainPdfJobId: jobId,
      uploadId,
      sourcePdf,
      workflow,
      finalStatus,
      finalStage: finalData.stage || "",
      finalStageDetail: finalData.stage_detail || finalData.stageDetail || "",
      translatedPdfPath: translatedPdfBytes > 0 ? translatedPdfPath : "",
      translatedTextPath: translatedTextBytes > 0 ? translatedTextPath : "",
      logPath,
      apiBaseUrl: baseUrl,
      artifactsManifest: manifest?.data || [],
      failure: finalData.failure || finalData.failure_diagnostic || null,
      message: finalStatus === "succeeded"
        ? `RetainPDF job ${jobId} succeeded`
        : `RetainPDF job ${jobId} ended with ${finalStatus || "unknown"}`,
    }
    await writeJson(resultPath, summary)
    await appendLog(logPath, summary.message)
    process.exit(finalStatus === "succeeded" ? 0 : finalStatus === "canceled" ? 130 : 1)
  } catch (error) {
    const summary = {
      ok: false,
      status: "failed",
      sourcePdf,
      translatedPdfPath: "",
      translatedTextPath: "",
      logPath,
      message: error?.message || String(error),
    }
    await appendLog(logPath, `ERROR ${summary.message}`).catch(() => null)
    await writeJson(resultPath, summary).catch(() => null)
    process.exit(1)
  }
}

main()
