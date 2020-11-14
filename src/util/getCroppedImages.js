import getCORSImage from './getCORSImage'
import getCORSURL from './getCORSURL'
import gifFrames from 'gif-frames'

function getRadianAngle (degreeValue) {
  return (degreeValue * Math.PI) / 180
}

async function getCroppedGIF (gifSrc, cropArea, rotation) {
  const frames = await gifFrames({
    url: getCORSURL(gifSrc),
    frames: 'all',
    outputType: 'canvas'
  })

  const croppedFrames = []
  let frameTime = 0
  for (const frame of frames) {
    const { frameInfo, getImage } = frame
    const delay = frameInfo.delay || 10
    const rawImageURL = getImage().toDataURL('image/png')
    const croppedImageURL = await getCroppedImages(
      rawImageURL,
      cropArea,
      rotation
    )

    croppedFrames.push({
      start: frameTime / 1000,
      end: (frameTime + (delay * 10)) / 1000,
      imageURL: croppedImageURL
    })

    frameTime += delay * 10
  }

  return {
    duration: frameTime / 1000,
    frames: croppedFrames
  }
}

/**
 * This function was adapted from the one in the ReadMe of https://github.com/DominicTobias/react-image-crop
 * @param {File} image - Image File url or array of images
 * @param {Object} cropArea - cropArea Object provided by react-easy-crop
 * @param {number} rotation - optional rotation parameter
 */
export default async function getCroppedImages (imageSrc, cropArea, rotation = 0) {
  const isGIFImage = Boolean(imageSrc.match(/(^data:image\/gif)|(\.gif$)/))

  let image
  try {
    image = await getCORSImage(imageSrc)
  } catch (error) {
    console.error(error)
    return null
  }

  if (isGIFImage) {
    return getCroppedGIF(imageSrc, cropArea, rotation)
  }

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  const maxSize = Math.max(image.width, image.height)
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2))

  // set each dimensions to double largest dimension to allow for a safe area for the
  // image to rotate in without being clipped by canvas context
  canvas.width = safeArea
  canvas.height = safeArea

  // translate canvas context to a central location on image to allow rotating around the center.
  context.translate(safeArea / 2, safeArea / 2)
  context.rotate(getRadianAngle(rotation))
  context.translate(-safeArea / 2, -safeArea / 2)

  // draw rotated image and store data.
  context.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  )
  const data = context.getImageData(0, 0, safeArea, safeArea)

  // set canvas width to final desired crop size - this will clear existing context
  canvas.width = cropArea.width
  canvas.height = cropArea.height

  // paste generated rotate image with correct offsets for x,y crop values.
  context.putImageData(
    data,
    0 - safeArea / 2 + image.width * 0.5 - cropArea.x,
    0 - safeArea / 2 + image.height * 0.5 - cropArea.y
  )

  return canvas.toDataURL('image/png')
}
