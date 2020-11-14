import events, { FILE_GENERATION_LOADING_STEP } from '../events'

import ffmpeg from './ffmpeg'
import getCharacterImages from './getCharacterImages'
import drawAnimation from './drawAnimation'
import uploadFileToSpaces from './uploadFileToSpaces'
import {
  ANIMATION_SECONDS,
  MP4_ANIMATION_FPS
} from '../constants/animation'

const blobToFile = (blob, filename) => {
  // A Blob() is almost a File() - it's just missing the two properties below which we will add
  blob.lastModifiedDate = new Date()
  blob.name = filename
  return blob
}

export async function URLToFile (url, fileName) {
  const result = await fetch(url)
  return result.arrayBuffer()
}

export default async function getGIFURLFromAnimation (ejectedText, impostorText, characterImageURLs) {
  const FRAME_DELAY = MP4_ANIMATION_FPS / 1000
  const characterImages = await getCharacterImages(characterImageURLs)
  const backgroundSound = await URLToFile('/background.m4a')

  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720

  const images = []

  for (let elapsed = 0; elapsed <= ANIMATION_SECONDS; elapsed += FRAME_DELAY) {
    const renderingPercentage = elapsed / ANIMATION_SECONDS
    events.emit(FILE_GENERATION_LOADING_STEP, renderingPercentage / 2)

    await drawAnimation(canvas, ejectedText, impostorText, characterImages, elapsed)

    const imageURL = canvas.toDataURL('image/png')
    const imageFile = await URLToFile(imageURL)
    images.push(imageFile)
  }

  const MEMFSImages = images.map((image, i) => ({
    name: `image-${i}.png`,
    data: image
  }))

  return new Promise((resolve, reject) => {
    ffmpeg({
      MEMFS: [
        {
          name: 'background.m4a',
          data: backgroundSound
        },
        ...MEMFSImages
      ],
      arguments: [
        '-i',
        'background.m4a',
        '-framerate',
        '30',
        '-i',
        'image-%d.png',
        '-c:a', 'copy',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        'out.mp4'
      ],
      onPrintErr: (data) => {
        const frameMatch = data.match(/frame= +([0-9]+)/)
        if (frameMatch) {
          const frameNumber = parseInt(frameMatch[1], 10)
          const frameTotal = images.length
          const renderingPercentage = 0.5 + ((frameNumber / frameTotal) * 0.48)
          events.emit(FILE_GENERATION_LOADING_STEP, renderingPercentage)
        }
      },
      onDone: (data) => {
        const videoData = Uint8Array.from(data.MEMFS[0].data)
        const videoBlob = new Blob([videoData], { type: 'video/mp4' })
        const videoURL = window.URL.createObjectURL(videoBlob)
        events.emit(FILE_GENERATION_LOADING_STEP, 1)
        resolve(videoURL)
        uploadFileToSpaces(ejectedText, 'mp4', blobToFile(videoBlob, 'ejection.mp4'))
      }
    })
  })
}
