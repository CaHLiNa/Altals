import { marked } from 'marked'
import { callGemini } from './ai.js'

const GEMINI_OCR_PROMPT = `You are an AI assistant specialized in converting PDF images to Markdown format. Please follow these instructions for the conversion:

1. Text Processing:
- Accurately recognize all text content in the PDF image without guessing or inferring.
- Convert the recognized text into Markdown format.
- Maintain the original document structure, including headings, paragraphs, lists, etc.

2. Mathematical Formula Processing:
- Convert all mathematical formulas to LaTeX format.
- Enclose inline formulas with \\( \\). For example: This is an inline formula \\( E = mc^2 \\)
- Enclose block formulas with \\[ \\]. For example: \\[ \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]

3. Table Processing:
- Convert tables to HTML format.
- Wrap the entire table with <table> and </table>.

4. Figure Handling:
- Ignore figures content in the PDF image. Do not attempt to describe or convert images.

5. Output Format:
- Ensure the output Markdown document has a clear structure with appropriate line breaks between elements.
- For complex layouts, try to maintain the original document's structure and format as closely as possible.

Please strictly follow these guidelines to ensure accuracy and consistency in the conversion. Your task is to accurately convert the content of the PDF image into Markdown format without adding any extra explanations or comments.`

/**
 * Convert a PDF buffer to { html, markdown, images } via Z OCR API (GLM-OCR),
 * with Gemini 3.1 Pro as fallback if z.ai returns a 400.
 */
export async function convertPdf(buffer) {
  const config = useRuntimeConfig()
  const base64 = buffer.toString('base64')

  // --- Primary: z.ai GLM-OCR ---
  if (config.zApiKey) {
    try {
      const response = await $fetch('https://api.z.ai/api/paas/v4/layout_parsing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.zApiKey}`,
          'Content-Type': 'application/json',
        },
        body: {
          model: 'glm-ocr',
          file: `data:application/pdf;base64,${base64}`,
        },
        timeout: 120_000,
      })

      const markdown = response?.md_results
      if (markdown) {
        const html = await marked.parse(markdown)
        return { html, markdown, images: [], ocrUsage: response.usage || {}, ocrModel: 'glm-ocr', provider: 'glm-ocr' }
      }
    } catch (err) {
      const status = err?.response?.status || err?.status
      if (status === 400) {
        console.warn('[pdfOcr] z.ai returned 400 — falling back to Gemini')
      } else {
        throw err
      }
    }
  }

  // --- Fallback: Gemini 3.1 Pro inline PDF ---
  const { text: markdown, usage } = await callGemini({
    model: 'gemini-3.1-pro-preview',
    messages: [{
      role: 'user',
      content: [
        { type: 'pdf', data: base64, mimeType: 'application/pdf' },
        { type: 'text', text: GEMINI_OCR_PROMPT },
      ],
    }],
    maxTokens: 65536,
    thinkingLevel: 'low',
  })

  if (!markdown) throw new Error('Gemini OCR returned no text')

  const html = await marked.parse(markdown)
  return { html, markdown, images: [], ocrUsage: usage, ocrModel: 'gemini-3.1-pro', provider: 'gemini' }
}
