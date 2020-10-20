import GIF from 'gif.js'
import events, { GIF_GENERATION_LOADING_STEP } from '../events'

import drawAnimation from './drawAnimation'
import {
  ANIMATION_SECONDS,
  ANIMATION_FRAME_TIME_SECONDS,
  ANIMATION_SPEEDUP
} from '../constants/animation'
const ANIMATION_FRAME_TIME_DELAY = ANIMATION_FRAME_TIME_SECONDS * 5

const getImageElementFromURL = async (url) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

export default async function getGIFURLFromAnimation (text) {
  const canvas = document.createElement('canvas')
  canvas.width = 1920 / 4
  canvas.height = 1080 / 4

  const gif = new GIF({
    workers: 2,
    quality: 0
  })

  for (let elapsed = 0; elapsed <= ANIMATION_SECONDS; elapsed += (ANIMATION_FRAME_TIME_DELAY)) {
    const renderingPercentage = elapsed / ANIMATION_SECONDS
    events.emit(GIF_GENERATION_LOADING_STEP, renderingPercentage / 2)

    await drawAnimation(canvas, text, elapsed)

    const imageURL = canvas.toDataURL('image/png')
    const image = await getImageElementFromURL(imageURL)

    gif.addFrame(image, { delay: (ANIMATION_FRAME_TIME_DELAY * 1000) / ANIMATION_SPEEDUP })
  }

  return new Promise((resolve) => {
    gif.on('finished', (blob) => {
      const blobURL = URL.createObjectURL(blob)
      resolve(blobURL)
    })

    gif.on('progress', (percentage) => {
      events.emit(GIF_GENERATION_LOADING_STEP, 0.5 + (percentage / 2))
    })

    gif.render()
  })
}
