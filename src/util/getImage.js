const getImage = async (imageURL) => {
  const image = new Image()
  return new Promise((resolve, reject) => {
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = imageURL
  })
}

export default getImage
