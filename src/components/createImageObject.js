const createImageObject = (url) => {
  const shouldUseCors = url.match(/(https|http):\/\//)
  const corsUrl = shouldUseCors ? `https://cors.kassellabs.io/${url}` : url

  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = true
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.src = corsUrl
  })
}

export default createImageObject
