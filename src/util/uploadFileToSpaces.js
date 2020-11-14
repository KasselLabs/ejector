import axios from 'axios'

export default async function uploadFileToSpaces (text, extension, file) {
  const isNotProduction = process.env.ENVIRONMENT !== 'production'
  if (isNotProduction) {
    return
  }

  const getUploadURLResponse = await axios.request({
    method: 'POST',
    url: 'https://ejector-api.nihey.org/get-upload-url',
    headers: {
      'Content-Type': 'application/json'
    },
    data: {
      text,
      extension
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
