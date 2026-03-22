export function sortReferences(list = [], sortBy = 'addedAt', sortDir = 'desc') {
  const copy = [...list]
  const dir = sortDir === 'asc' ? 1 : -1
  switch (sortBy) {
    case 'author':
      return copy.sort((left, right) => {
        const leftAuthor = left.author?.[0]?.family || ''
        const rightAuthor = right.author?.[0]?.family || ''
        return dir * leftAuthor.localeCompare(rightAuthor)
      })
    case 'year':
      return copy.sort((left, right) => {
        const leftYear = left.issued?.['date-parts']?.[0]?.[0] || 0
        const rightYear = right.issued?.['date-parts']?.[0]?.[0] || 0
        return dir * (leftYear - rightYear)
      })
    case 'title':
      return copy.sort((left, right) => dir * (left.title || '').localeCompare(right.title || ''))
    case 'addedAt':
    default:
      return copy.sort((left, right) => {
        const leftDate = left._addedAt || ''
        const rightDate = right._addedAt || ''
        return dir * leftDate.localeCompare(rightDate)
      })
  }
}

export function filterReferences(list = [], query = '') {
  if (!query || !query.trim()) return list

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  return list.filter((ref) => {
    const searchable = [
      ref.title || '',
      ref._key || '',
      ref.DOI || '',
      String(ref.issued?.['date-parts']?.[0]?.[0] || ''),
      ...(ref.author || []).map((author) => `${author.family || ''} ${author.given || ''}`),
      ...(ref._tags || []),
      ref['container-title'] || '',
      ref.abstract || '',
    ].join(' ').toLowerCase()

    return tokens.every((token) => searchable.includes(token))
  })
}

export function searchReferences(list = [], query = '') {
  return filterReferences(list, query)
}

export function searchSortedReferences(list = [], query = '', sortBy = 'addedAt', sortDir = 'desc') {
  return sortReferences(filterReferences(list, query), sortBy, sortDir)
}

function cslTypeToRis(type) {
  const map = {
    'article-journal': 'JOUR',
    'book': 'BOOK',
    'chapter': 'CHAP',
    'paper-conference': 'CONF',
    'report': 'RPRT',
    'thesis': 'THES',
    'webpage': 'ELEC',
    'article-magazine': 'MGZN',
    'article-newspaper': 'NEWS',
    'manuscript': 'UNPB',
    'legislation': 'BILL',
    'legal_case': 'CASE',
    'dataset': 'DATA',
    'patent': 'PAT',
    'motion_picture': 'VIDEO',
    'song': 'SOUND',
    'map': 'MAP',
  }
  return map[type] || 'GEN'
}

function cslTypeToBibtex(type) {
  const map = {
    'article-journal': 'article',
    'paper-conference': 'inproceedings',
    'book': 'book',
    'chapter': 'incollection',
    'thesis': 'phdthesis',
    'report': 'techreport',
    'webpage': 'misc',
  }
  return map[type] || 'misc'
}

export function exportReferencesAsBibTeX(refs = []) {
  return refs.map((ref) => {
    const type = cslTypeToBibtex(ref.type)
    const key = ref._key || ref.id
    const fields = []

    if (ref.title) fields.push(`  title = {${ref.title}}`)
    if (ref.author) {
      const authors = ref.author.map((author) => (
        `${author.family || ''}${author.given ? `, ${author.given}` : ''}`
      )).join(' and ')
      fields.push(`  author = {${authors}}`)
    }
    if (ref.issued?.['date-parts']?.[0]?.[0]) {
      fields.push(`  year = {${ref.issued['date-parts'][0][0]}}`)
    }
    if (ref['container-title']) fields.push(`  journal = {${ref['container-title']}}`)
    if (ref.volume) fields.push(`  volume = {${ref.volume}}`)
    if (ref.issue) fields.push(`  number = {${ref.issue}}`)
    if (ref.page) fields.push(`  pages = {${ref.page}}`)
    if (ref.DOI) fields.push(`  doi = {${ref.DOI}}`)
    if (ref.publisher) fields.push(`  publisher = {${ref.publisher}}`)

    return `@${type}{${key},\n${fields.join(',\n')}\n}`
  }).join('\n\n')
}

export function exportReferencesAsRis(refs = []) {
  return refs.map((ref) => {
    const lines = []
    lines.push(`TY  - ${cslTypeToRis(ref.type)}`)

    if (ref.title) lines.push(`TI  - ${ref.title}`)
    if (ref.author) {
      for (const author of ref.author) {
        const name = author.family && author.given
          ? `${author.family}, ${author.given}`
          : (author.family || author.given || '')
        if (name) lines.push(`AU  - ${name}`)
      }
    }
    if (ref.issued?.['date-parts']?.[0]) {
      const parts = ref.issued['date-parts'][0]
      const year = parts[0]
      const month = parts[1] ? String(parts[1]).padStart(2, '0') : ''
      const day = parts[2] ? String(parts[2]).padStart(2, '0') : ''
      lines.push(`PY  - ${year}`)
      if (month) lines.push(`DA  - ${year}/${month}${day ? `/${day}` : ''}`)
    }
    if (ref['container-title']) lines.push(`JO  - ${ref['container-title']}`)
    if (ref.volume) lines.push(`VL  - ${ref.volume}`)
    if (ref.issue) lines.push(`IS  - ${ref.issue}`)
    if (ref.page) {
      const [startPage, endPage] = ref.page.split('-')
      lines.push(`SP  - ${startPage.trim()}`)
      if (endPage) lines.push(`EP  - ${endPage.trim()}`)
    }
    if (ref.DOI) lines.push(`DO  - ${ref.DOI}`)
    if (ref.URL) lines.push(`UR  - ${ref.URL}`)
    if (ref.abstract) lines.push(`AB  - ${ref.abstract}`)
    if (ref.publisher) lines.push(`PB  - ${ref.publisher}`)
    if (ref.ISSN) lines.push(`SN  - ${ref.ISSN}`)
    else if (ref.ISBN) lines.push(`SN  - ${ref.ISBN}`)
    if (ref._tags?.length) {
      for (const tag of ref._tags) lines.push(`KW  - ${tag}`)
    }
    lines.push('ER  -')

    return lines.join('\n')
  }).join('\n\n')
}
