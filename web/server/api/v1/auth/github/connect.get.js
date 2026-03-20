// GET /api/v1/auth/github/connect?state=xxx&transport=poll|deep-link|loopback&prompt=select_account
// Redirects to GitHub OAuth consent screen
// Uses a signed state payload so callback verification works across server instances

import { createSignedOAuthState, normalizeLoopbackReturnTo } from '../../../../utils/githubOAuthState.js'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const state = query.state
  const transport = ['deep-link', 'loopback', 'poll'].includes(query.transport) ? query.transport : 'poll'
  const returnTo = transport === 'loopback' ? normalizeLoopbackReturnTo(query.return_to) : ''
  const prompt = query.prompt === 'select_account' ? 'select_account' : ''

  if (!state) {
    setResponseStatus(event, 400)
    return { error: 'State parameter is required' }
  }
  if (transport === 'loopback' && !returnTo) {
    setResponseStatus(event, 400)
    return { error: 'Loopback return URL is required' }
  }

  const config = useRuntimeConfig()
  const clientId = config.githubClientId

  if (!clientId) {
    setResponseStatus(event, 500)
    return { error: 'GitHub OAuth not configured' }
  }

  const redirectUri = `${config.baseUrl}/api/v1/auth/github/callback`
  const scope = 'repo read:user user:email'
  const signedState = createSignedOAuthState({ originalState: state, transport, returnTo }, config)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state: signedState,
  })
  if (prompt) params.set('prompt', prompt)

  const url = `https://github.com/login/oauth/authorize?${params.toString()}`

  return sendRedirect(event, url)
})
