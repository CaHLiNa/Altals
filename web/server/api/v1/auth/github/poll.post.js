// POST /api/v1/auth/github/poll
// Desktop polls for GitHub token by state

import { getGitHubToken, hashValue } from '../../../../utils/githubTokenStore.js'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')

  const { state } = await readBody(event)

  if (!state) {
    setResponseStatus(event, 400)
    return { error: 'State is required' }
  }

  const stateHash = hashValue(state)
  const data = getGitHubToken(stateHash)

  if (!data) {
    return { pending: true }
  }

  return data
})
