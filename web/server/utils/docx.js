import mammoth from 'mammoth'
import TurndownService from 'turndown'
import sharp from 'sharp'

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function convertDocx(buffer) {
  let imageCounter = 0
  const images = []

  const { value: html } = await mammoth.convertToHtml({ buffer }, {
    convertImage: mammoth.images.imgElement(image => {
      return image.read('base64').then(async (data) => {
        let contentType = image.contentType || 'image/png'
        let imgBuffer = Buffer.from(data, 'base64')

        // Convert unsupported formats (TIFF, BMP, etc.) to PNG
        if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
          try {
            imgBuffer = await sharp(imgBuffer).png().toBuffer()
            contentType = 'image/png'
          } catch (err) {
            console.warn(`[convertDocx] Failed to convert ${contentType} image, skipping: ${err.message}`)
            return { src: '', alt: '' }
          }
        }

        const base64 = imgBuffer.toString('base64')
        const id = `image-${++imageCounter}`
        images.push({ id, buffer: imgBuffer, base64, contentType })
        return { src: id, alt: id }
      })
    }),
  })

  // Build display HTML with base64 data URIs for browser rendering
  let displayHtml = html
  for (const img of images) {
    displayHtml = displayHtml.replace(
      new RegExp(`src="${img.id}"`, 'g'),
      `src="data:${img.contentType};base64,${img.base64}"`
    )
  }

  // Convert to markdown for AI consumption
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  const markdown = turndown.turndown(html)

  return { html: displayHtml, markdown, images }
}
