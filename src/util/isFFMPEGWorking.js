import ffmpeg from './ffmpeg'
import events, { BACKGROUND_FRAMES_LOADED } from '../events'

export default async function isFFMPEGWorking () {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  if (isSafari) {
    return false
  }

  let isResolved = false
  return new Promise((resolve) => {
    const checkIfFFMPEGWorks = () => {
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          resolve(false)
        }
      }, 3000)
      ffmpeg({
        MEMFS: [],
        arguments: [
          '-version'
        ],
        onDone: (data) => {
          if (!isResolved) {
            isResolved = true
            resolve(true)
          }
        }
      })
    }

    events.on(BACKGROUND_FRAMES_LOADED, checkIfFFMPEGWorks)
  })
}
