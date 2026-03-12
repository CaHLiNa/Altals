import { callGemini } from '../../utils/ai'

const OPENALEX_BASE = 'https://api.openalex.org'
const HEADERS = { 'User-Agent': 'Shoulders/1.0 (mailto:service@shoulde.rs)' }

// ─── OpenAlex search functions (used as tools by the agent) ───

async function searchAuthorByName(name) {
  const url = `${OPENALEX_BASE}/authors?search=${encodeURIComponent(name)}&per_page=5`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: HEADERS })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map(formatOpenAlexAuthor)
  } catch { return [] }
}

async function searchAuthorFiltered(name, institution) {
  const filter = `display_name.search:${encodeURIComponent(name)},last_known_institutions.display_name.search:${encodeURIComponent(institution)}`
  const url = `${OPENALEX_BASE}/authors?filter=${filter}&per_page=3`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: HEADERS })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map(formatOpenAlexAuthor)
  } catch { return [] }
}

async function searchAuthorByOrcid(orcid) {
  const cleanOrcid = orcid.replace(/^https?:\/\/orcid\.org\//, '')
  const url = `${OPENALEX_BASE}/authors/orcid:${cleanOrcid}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: HEADERS })
    if (!res.ok) return null
    const data = await res.json()
    return formatOpenAlexAuthor(data)
  } catch { return null }
}

function formatOpenAlexAuthor(a) {
  return {
    openalex_id: a.id || null,
    display_name: a.display_name || '',
    institution: a.last_known_institutions?.[0]?.display_name || null,
    institution_country: a.last_known_institutions?.[0]?.country_code || null,
    works_count: a.works_count || 0,
    cited_by_count: a.cited_by_count || 0,
    orcid: a.orcid?.replace('https://orcid.org/', '') || null,
    topics: (a.topics || []).slice(0, 3).map(t => t.display_name),
  }
}

// ─── Agent: builds author dossiers ───

const SYSTEM_PROMPT = `You are an author profiling agent for academic paper triage. You receive metadata about a paper's authors (names, affiliations, departments, emails, ORCIDs) and OpenAlex search results.

Your job: match each author to the correct OpenAlex profile. This is a DISAMBIGUATION task — common names may have many profiles. You must verify the match using all available evidence.

MATCHING RULES:
- An ORCID match is definitive. If the paper states an ORCID and OpenAlex has the same ORCID, that's the person.
- An email domain match (e.g. paper says @sheffield.ac.uk, OpenAlex says University of Sheffield) is strong evidence.
- Institution + name match is good evidence, but ONLY if the institution matches what the PAPER states.
- Name-only match is NOT sufficient for common names. If you can't verify the institution, mark as unverified.
- OpenAlex "last_known_institution" may differ from the paper's affiliation (people move). Trust the PAPER's affiliation for display, but use OpenAlex institution to verify identity.

CRITICAL: Do NOT return a profile you're not confident about. A wrong profile (wrong person's citation count) is far worse than no profile. When in doubt, return status "unverified".

Return a JSON array with one object per author:

[
  {
    "name": "Author Name (as given)",
    "affiliation": "Institution from the PAPER (not OpenAlex)",
    "department": "Department from the paper or null",
    "email": "email from the paper or null",
    "openalex_id": "https://openalex.org/A... or null",
    "openalex_name": "Display name from OpenAlex or null",
    "works_count": 189,
    "cited_by_count": 8967,
    "orcid": "0000-0003-... or null",
    "topics": ["Topic 1", "Topic 2"],
    "status": "verified",
    "match_reason": "ORCID match" or "Institution + name match" or "Name match, institution unverified"
  }
]

Status values:
- "verified" — high confidence this is the right person (ORCID match, or institution + name match)
- "unverified" — could not confidently match (return paper metadata only, null out OpenAlex fields)
- "not_found" — no plausible OpenAlex results at all

Return ONLY the JSON array, no other text.`

/**
 * Build author dossiers by matching paper metadata against OpenAlex.
 * Uses Gemini Flash Lite as an agent to disambiguate common names.
 * Falls back gracefully: if the agent fails, returns paper metadata only.
 *
 * @param {Object} metadata - Full metadata from metadataExtractor (title, authors, abstract)
 * @returns {Array} Author profiles with OpenAlex data where confidently matched
 */
export async function lookupAuthors(metadata) {
  const authors = metadata?.authors || []
  if (!authors.length) return []

  // Select authors: first 3 + last 2 (if >5 authors)
  let selected
  if (authors.length <= 5) {
    selected = authors
  } else {
    selected = [
      ...authors.slice(0, 3),
      ...authors.slice(-2),
    ]
  }

  // Phase 1: Gather OpenAlex data for all selected authors
  const searchResults = await Promise.all(selected.map(async (author) => {
    const results = {}

    // If ORCID is available, that's the fastest and most reliable path
    if (author.orcid) {
      results.byOrcid = await searchAuthorByOrcid(author.orcid)
    }

    // Search by name + institution (filtered)
    if (author.affiliation) {
      results.byInstitution = await searchAuthorFiltered(author.name, author.affiliation)
    }

    // Broader name search as fallback
    results.byName = await searchAuthorByName(author.name)

    return { author, results }
  }))

  // Phase 2: Give the agent all the data and let it disambiguate
  const agentInput = searchResults.map(({ author, results }) => {
    const entry = {
      from_paper: {
        name: author.name,
        affiliation: author.affiliation || null,
        department: author.department || null,
        email: author.email || null,
        orcid: author.orcid || null,
        is_corresponding: author.is_corresponding || false,
      },
      openalex_results: {},
    }
    if (results.byOrcid) entry.openalex_results.orcid_lookup = results.byOrcid
    if (results.byInstitution?.length) entry.openalex_results.institution_filtered = results.byInstitution
    if (results.byName?.length) entry.openalex_results.name_search = results.byName
    return entry
  })

  // Build context: paper title helps the agent understand the field
  const context = metadata.title ? `Paper title: "${metadata.title}"\n\n` : ''

  try {
    const { text, usage } = await callGemini({
      model: 'gemini-3.1-flash-lite-preview',
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `${context}Match these authors to their OpenAlex profiles:\n\n${JSON.stringify(agentInput, null, 2)}`,
      }],
      maxTokens: 3000,
    })

    let profiles = null
    try {
      const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
      profiles = JSON.parse(cleaned)
    } catch {
      console.error('[authorLookup] Agent returned invalid JSON:', text.slice(0, 300))
    }

    if (Array.isArray(profiles) && profiles.length) {
      return { profiles, usage }
    }
  } catch (e) {
    console.error('[authorLookup] Agent failed:', e.message)
  }

  // Fallback: return paper metadata only (no OpenAlex enrichment)
  const fallback = selected.map(a => ({
    name: a.name,
    affiliation: a.affiliation || null,
    department: a.department || null,
    email: a.email || null,
    orcid: a.orcid || null,
    status: 'unverified',
  }))
  return { profiles: fallback, usage: { input: 0, output: 0 } }
}
