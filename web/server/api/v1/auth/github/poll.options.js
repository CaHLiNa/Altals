export default defineEventHandler((event) => {
  setHeader(event, 'Access-Control-Allow-Origin', '*')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')
  setResponseStatus(event, 204)
  return ''
})
