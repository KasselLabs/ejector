import events, { MP4_GENERATION_LOADING_STEP } from '../events'

import getImage from './getImage'
import drawAnimation from './drawAnimation'
import uploadFileToSpaces from './uploadFileToSpaces'
import {
  ANIMATION_SECONDS,
  MP4_ANIMATION_FPS
} from '../constants/animation'

export async function URLToFile (url, fileName) {
  const result = await fetch(url)
  return result.arrayBuffer()
}

export default async function getGIFURLFromAnimation (ejectedText, impostorText, characterImageURL) {
  const FRAME_DELAY = MP4_ANIMATION_FPS / 1000
  const characterImage = await getImage(characterImageURL)
  const backgroundSound = await URLToFile('/background.m4a')

  const canvas = document.createElement('canvas')
  canvas.width = 1920 / 4
  canvas.height = 1080 / 4

  const images = []

  for (let elapsed = 0; elapsed <= ANIMATION_SECONDS; elapsed += FRAME_DELAY) {
    const renderingPercentage = elapsed / ANIMATION_SECONDS
    events.emit(MP4_GENERATION_LOADING_STEP, renderingPercentage / 2)

    await drawAnimation(canvas, ejectedText, impostorText, characterImage, elapsed)

    const imageURL = canvas.toDataURL('image/png')
    const imageFile = await URLToFile(imageURL)
    images.push(imageFile)
  }

  const MEMFSImages = images.map((image, i) => ({
    name: `image-${i}.png`,
    data: image
  }))

  return new Promise((resolve, reject) => {
    const worker = new window.Worker('/ffmpeg-worker-mp4.js')
    worker.onmessage = function (e) {
      const msg = e.data
      switch (msg.type) {
        case 'ready':
          worker.postMessage({
            type: 'run',
            MEMFS: [
              {
                name: 'background.mp3',
                data: backgroundSound
              },
              ...MEMFSImages
            ],
            arguments: [
              '-i',
              'background.mp3',
              '-framerate',
              '30',
              '-i',
              'image-%d.png',
              '-c:a', 'copy',
              '-c:v', 'libx264',
              '-pix_fmt', 'yuv420p',
              '-shortest',
              'out.mp4'
            ]
          })
          break
        case 'stdout':
          console.log('out', msg.data)
          break
        case 'stderr':
          const frameMatch = msg.data.match(/frame= +([0-9]+)/)
          console.log(frameMatch)
          if (frameMatch) {
            const frameNumber = parseInt(frameMatch[1], 10)
            const frameTotal = images.length
            const renderingPercentage = 0.5 + ((frameNumber / frameTotal) * 0.48)
            console.log(renderingPercentage, frameTotal)
            events.emit(MP4_GENERATION_LOADING_STEP, renderingPercentage)
          }
          break
        case 'done':
          const videoData = Uint8Array.from(msg.data.MEMFS[0].data)
          const videoBlob = new Blob([videoData], { type: 'video/mp4' })
          const videoURL = window.URL.createObjectURL(videoBlob)
          events.emit(MP4_GENERATION_LOADING_STEP, 1)
          console.log(videoURL)
          resolve(videoURL)
          break
      }
    }
  })
}
