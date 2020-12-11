import range from './range'
import getImage from './getImage'
import events, { BACKGROUND_FRAMES_LOADED } from '../events'

const animations = {
  skeld: {
    range: [1, 154],
    loading: false,
    frames: []
  },
  mirahq: {
    range: [1, 142],
    loading: false,
    frames: []
  }
}

async function loadBackgroundFrames (type) {
  if (!animations[type]) {
    throw Error('Animation Type is Invalid')
  }

  const animation = animations[type]
  if (animation.loading) {
    return new Promise((resolve) => {
      events.on(BACKGROUND_FRAMES_LOADED, (loadedType) => {
        if (loadedType === type) {
          resolve()
        }
      })
    })
  }

  const isNotLoaded = animation.frames.length === 0
  if (isNotLoaded) {
    const frameNumbers = range(...animation.range)
    const backgroundFramesPromises = frameNumbers.map(frameNumber => {
      return getImage(`among-us-background-images/${type}/${frameNumber}.png`)
    })

    animation.frames = await Promise.all(backgroundFramesPromises)
    events.emit(BACKGROUND_FRAMES_LOADED, type)
  }
}

export default async function getBackgroundFrames (type = 'mirahq') {
  await loadBackgroundFrames(type)
  return animations[type].frames
};
