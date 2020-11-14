import getImage from './getImage'

export default async function getCharacterImages (characterImages) {
  if (Array.isArray(characterImages?.frames)) {
    const framesPromises = characterImages.frames.map(async ({ imageURL, ...frame }) => {
      const image = await getImage(imageURL)
      return {
        ...frame,
        image: image
      }
    })

    const frames = await Promise.all(framesPromises)
    return {
      ...characterImages,
      frames
    }
  }

  const image = await getImage(characterImages)
  return {
    duration: 5600,
    frames: [{
      start: 0,
      end: 5600,
      image
    }]
  }
}
