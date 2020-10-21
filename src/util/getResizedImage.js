import createImageObject from './createImageObject'

export default async function getResizedImage (imageSrc, { maxWidth, maxHeight, backgroundColor }) {
  let image
  try {
    image = await createImageObject(imageSrc)
  } catch (error) {
    console.error(error)
    return null
  }

  const canvas = document.createElement('canvas')
  let { width, height } = image

  // First, try to fit the image by width
  if (width !== maxWidth) {
    height *= maxWidth / width
    width = maxWidth
  }

  // If it does not work, try fitting it by height
  const isImageFitInsideModel = height <= maxHeight && width <= maxWidth
  if (!isImageFitInsideModel) {
    width *= maxHeight / height
    height = maxHeight
  }

  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')

  // Optionally apply a background color the the resized image
  if (backgroundColor) {
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(
    image,
    0,
    0,
    width,
    height
  )

  return canvas.toDataURL('image/png')
}
