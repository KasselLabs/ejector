import range from './range'
import getImage from './getImage'

let backgroundFrames = null

export default async function getBackgroundFrames () {
  if (backgroundFrames) {
    return backgroundFrames
  };

  const frameNumbers = range(1, 154)
  const backgroundFramesPromises = frameNumbers.map(frameNumber => {
    return getImage(`among-us-background-images/${frameNumber}.png`)
  })

  backgroundFrames = await Promise.all(backgroundFramesPromises)
  return backgroundFrames
};
