import { callGemini } from '../../utils/ai'

const SYSTEM_PROMPT = `You are a metadata extraction tool. Given the beginning of an academic paper (converted from PDF/DOCX to markdown), extract structured metadata.

Return a JSON object with this exact structure:

{
  "title": "Full paper title exactly as it appears",
  "authors": [
    {
      "name": "First Last",
      "affiliation": "Full institutional affiliation as stated in the paper",
      "department": "Department or school name if stated (e.g. 'School of Health and Related Research (ScHARR)')",
      "email": "author@institution.edu or null",
      "orcid": "0000-0000-0000-0000 or null",
      "is_corresponding": true/false
    }
  ],
  "abstract": "Full abstract text if present",
  "sections": ["Introduction", "Methods", "Results", ...],
  "appendix": true/false
}

Rules:
- title: Extract the actual title, not a description. If not clearly identifiable, use null.
- authors: Extract ALL authors with as much identifying information as possible.
  - Match numbered/footnoted affiliations to the correct authors (e.g. "Author1,2" means affiliations 1 and 2).
  - affiliation: The university or institution. Use the FULL name as stated (e.g. "University of Sheffield" not just "Sheffield").
  - department: School, department, or research group if stated separately from the institution.
  - email: Extract from correspondence section, footnotes, or author info block. Often marked with * or "Corresponding author".
  - orcid: Extract if present (usually in author info block or footnotes). Return just the ID (0000-0000-0000-0000), not the full URL.
  - is_corresponding: true if marked as corresponding author (*, "Corresponding author", listed email).
  - If none found, return empty array.
- abstract: The full abstract text. If labeled "Abstract" or "Summary", include the content. If none found, use null.
- sections: Main section headings only (not subsections). Extract from markdown headers or bold/caps section labels.
- appendix: true if any appendix/supplementary section exists.

Return ONLY the JSON object, no other text.`

/**
 * Extract title, authors, abstract, and sections from paper markdown.
 * Uses Gemini Flash Lite — cheap and fast (~2-3 seconds, ~$0.001).
 * Extracts rich author data: name, affiliation, department, email, ORCID.
 */
export async function extractMetadata(markdown) {
  // First ~6000 chars — title page + author block + abstract + start of paper
  const snippet = markdown.slice(0, 6000)

  const { text, usage } = await callGemini({
    model: 'gemini-3.1-flash-lite-preview',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Extract metadata from this paper:\n\n${snippet}` }],
    maxTokens: 2000,
  })

  let metadata = null
  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    metadata = JSON.parse(cleaned)
  } catch {
    console.error('[metadataExtractor] Failed to parse response:', text.slice(0, 300))
    metadata = { title: null, authors: [], abstract: null, sections: [], appendix: false }
  }

  return { metadata, usage }
}
