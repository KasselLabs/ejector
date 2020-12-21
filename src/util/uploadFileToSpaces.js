import axios from 'axios'

export default async function uploadFileToSpaces (text, extension, file, orderId) {
  const isNotProduction = process.env.ENVIRONMENT !== 'production'
  if (isNotProduction) {
    return
  }

  const getUploadURLResponse = await axios.request({
    method: 'POST',
    url: `${process.env.BACKEND_URL}/get-upload-url`,
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      text,
      extension,
      orderId
    }
  })
  const uploadURL = getUploadURLResponse.data.url

  return axios.put(uploadURL, file, {
    crossDomain: true,
    headers: {
      'Content-Type': file.type,
      'X-AMZ-ACL': 'public-read'
    }
  })
}
