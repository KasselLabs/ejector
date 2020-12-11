import GIF from 'gif.js'
import events, { FILE_GENERATION_LOADING_STEP } from '../events'

import getCharacterImages from './getCharacterImages'
import drawAnimation from './drawAnimation'
import uploadFileToSpaces from './uploadFileToSpaces'
import {
  ANIMATION_SECONDS,
  ANIMATION_SPEEDUP,
  GIF_ANIMATION_FRAME_TIME_DELAY
} from '../constants/animation'
import track from '../track'

const blobToFile = (blob, filename) => {
  // A Blob() is almost a File() - it's just missing the two properties below which we will add
  blob.lastModifiedDate = new Date()
  blob.name = filename
  return blob
}

const getImageElementFromURL = async (url) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

export default async function getGIFURLFromAnimation (ejectedText, impostorText, characterImageURLs, orderId) {
  track('event', 'download_button_initialize', {
    event_label: 'gif',
    event_category: 'download'
  })

  const characterImages = await getCharacterImages(characterImageURLs)

  const canvas = document.createElement('canvas')
  canvas.width = 1920 / 4
  canvas.height = 1080 / 4

  const gif = new GIF({
    workers: 2,
    quality: 0
  })

  for (let elapsed = 0; elapsed <= ANIMATION_SECONDS; elapsed += (GIF_ANIMATION_FRAME_TIME_DELAY)) {
    const renderingPercentage = elapsed / ANIMATION_SECONDS
    events.emit(FILE_GENERATION_LOADING_STEP, renderingPercentage / 2)
    await drawAnimation(canvas, 'mirahq', ejectedText, impostorText, characterImages, elapsed)

    const imageURL = canvas.toDataURL('image/png')
    const image = await getImageElementFromURL(imageURL)

    gif.addFrame(image, { delay: (GIF_ANIMATION_FRAME_TIME_DELAY * 1000) / ANIMATION_SPEEDUP })
  }

  return new Promise((resolve) => {
    gif.on('finished', (blob) => {
      const blobURL = URL.createObjectURL(blob)
      resolve(blobURL)
      uploadFileToSpaces(ejectedText, 'gif', blobToFile(blob, 'ejection.gif'), orderId)
      track('event', 'download_button_finish', {
        event_label: 'gif',
        event_category: 'download'
      })
    })

    gif.on('progress', (percentage) => {
      events.emit(FILE_GENERATION_LOADING_STEP, 0.5 + (percentage / 2))
    })

    gif.render()
  })
}
