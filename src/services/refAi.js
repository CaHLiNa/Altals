/**
 * Multi-provider AI service for reference parsing.
 *
 * Uses resolveApiAccess({ strategy: 'cheapest' }) for model selection.
 */

import { generateText } from 'ai'
import { resolveApiAccess, hasAnyAccess } from './apiClient'
import { createModel, convertSdkUsage } from './aiSdk'
import { createTauriFetch } from './tauriFetch'
import { calculateCost } from './tokenUsage'

const PARSE_SYSTEM = `You are an expert citation parser. Extract bibliographic references from text.

The input may be:
- A single citation in any format (APA, Chicago, IEEE, Nature, Vancouver, etc.)
- Multiple citations separated by newlines or numbers
- A full bibliography from a document
- Plain DOIs (10.xxxx/...)
- Paper metadata or abstracts

RULES:
1. Extract ALL references found in the text
2. If uncertain about a field, omit it rather than guess
3. For DOIs, extract the 10.xxxx/yyyy part only
4. Authors should be split into family/given names when possible
5. Year should be a 4-digit number

Return a JSON array of objects, each with these fields (omit uncertain ones):
{
  "title": "string",
  "authors": [{"family": "Last", "given": "First"}],
  "year": 2024,
  "journal": "journal or conference name",
  "volume": "string",
  "issue": "string",
  "pages": "string",
  "doi": "10.xxxx/yyyy",
  "type": "article-journal|paper-conference|book|chapter|thesis|report"
}

Return ONLY the JSON array. No markdown fences, no explanation.`

const EXTRACT_SYSTEM = `Extract bibliographic metadata from academic paper text. Return ONLY valid JSON (no markdown fences). Omit any fields you're uncertain about.`

const EXTRACT_SCHEMA = `{
  "title": "paper title",
  "authors": [{"family": "LastName", "given": "FirstName"}],
  "year": 2024,
  "journal": "journal or conference name",
  "doi": "10.xxxx/yyyy",
  "type": "article-journal|paper-conference|book|thesis",
  "abstract": "abstract text if clearly visible",
  "volume": "string",
  "issue": "string",
  "pages": "string"
}`

/**
 * Check if any AI model is available.
 */
export function hasAiAccess(workspace) {
  return hasAnyAccess(workspace)
}

/**
 * Helper: call generateText with tauriFetch and record usage.
 */
async function _generate(access, system, userContent, feature) {
  const tauriFetch = createTauriFetch()
  const model = createModel(access, tauriFetch)
  const provider = access.providerHint || access.provider

  const result = await generateText({
    model,
    system,
    messages: [{ role: 'user', content: userContent }],
  })

  // Record usage
  if (result.usage) {
    const usage = convertSdkUsage(result.usage, result.providerMetadata, provider)
    usage.cost = calculateCost(usage, access.model, access.provider)
    import('../stores/usage').then(({ useUsageStore }) => {
      useUsageStore().record({ usage, feature, provider: access.provider, modelId: access.model })
    })
  }

  return result.text || null
}

/**
 * Parse text into structured references via AI.
 */
export async function aiParseReferences(text, workspace) {
  const { useUsageStore } = await import('../stores/usage')
  if (useUsageStore().isOverBudget) return null

  const access = await resolveApiAccess({ strategy: 'cheapest' }, workspace)
  if (!access) return null

  const truncated = text.slice(0, 8000)
  try {
    const responseText = await _generate(
      access,
      PARSE_SYSTEM,
      `Extract all bibliographic references from this text:\n\n${truncated}`,
      'references',
    )
    if (!responseText) return null

    const arrMatch = responseText.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      const parsed = JSON.parse(arrMatch[0])
      return Array.isArray(parsed) ? parsed : [parsed]
    }
    const objMatch = responseText.match(/\{[\s\S]*\}/)
    if (objMatch) {
      return [JSON.parse(objMatch[0])]
    }
  } catch (e) {
    console.warn('[refAi] AI call failed:', e)
  }
  return null
}

/**
 * Extract metadata from paper text (for PDF import).
 */
export async function aiExtractPdfMetadata(text, workspace) {
  const { useUsageStore } = await import('../stores/usage')
  if (useUsageStore().isOverBudget) return null

  const access = await resolveApiAccess({ strategy: 'cheapest' }, workspace)
  if (!access) return null

  const truncated = text.slice(0, 3000)
  try {
    const responseText = await _generate(
      access,
      EXTRACT_SYSTEM,
      `Extract metadata from this document and return JSON matching this schema:\n${EXTRACT_SCHEMA}\n\nDocument text:\n${truncated}`,
      'references',
    )
    if (!responseText) return null

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.warn('[refAi] AI extraction failed:', e)
  }
  return null
}
