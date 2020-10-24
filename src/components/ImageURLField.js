import React from 'react'
import { TextField, CircularProgress } from '@material-ui/core'
import { debounce } from 'lodash'

import CropDialog from './CropDialog'
import getImage from '../util/getImage'
import createImageObject from '../util/createImageObject'

const validateImage = async (url) => {
  // Check if URL is Valid
  await getImage(url)
  // Check if URL can be manipulated on canvas
  await createImageObject(url)
}

const debouncedOnImageURLChange = debounce(async (
  imageURL,
  setLoading,
  setImageToCrop,
  setError
) => {
  setLoading(true)
  try {
    await validateImage(imageURL)
    setImageToCrop(imageURL)
  } catch (error) {
    setError('Invalid URL')
  } finally {
    setLoading(false)
  }
}, 300)

export default function ImageURLField ({ value, onChange }) {
  const [inputValue, setInputValue] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const [imageToCrop, setImageToCrop] = React.useState(null)

  React.useEffect(() => {

  })

  return (
    <>
      <div className="text-field-container">
        <TextField
          error={Boolean(error)}
          helperText={error}
          label="Image URL"
          placeholder="Or Paste a Image URL here"
          variant="outlined"
          fullWidth
          value={inputValue}
          onChange={async (e) => {
            const imageURL = e.target.value
            setInputValue(imageURL)
            setError('')

            if (!imageURL) {
              return
            }

            debouncedOnImageURLChange(
              imageURL,
              setLoading,
              setImageToCrop,
              setError
            )
          }}
          InputLabelProps={{ shrink: true }}
        />
        {loading && <div className="loading">
          <CircularProgress size={32}/>
        </div>}
        <style jsx>{`
          .text-field-container {
            position: relative;
          }

          .loading {
            position: absolute;
            top: 50%;
            right: 8px;
            transform: translateY(-50%);
          }
        `}</style>
      </div>
      <CropDialog
        image={imageToCrop}
        open={Boolean(imageToCrop)}
        onClose={() => setImageToCrop(null)}
        onChange={croppedImage => {
          onChange(croppedImage)
          setInputValue('')
        }}
      />
    </>
  )
}
