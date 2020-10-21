import React from 'react'
import classnames from 'classnames'
import { CircularProgress } from '@material-ui/core'

import CropDialog from './CropDialog'
import getURLFromFile from '../util/getURLFromFile'

export default function UploadArea ({ label, sublabel, value, onChange }) {
  const fileInputRef = React.useRef()
  const [loading, setLoading] = React.useState(false)
  const [imageToCrop, setImageToCrop] = React.useState(null)

  return (
    <>
      <div
        className={classnames('upload-area', { loading })}
        onClick={() => {
          fileInputRef.current.click()
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept=".jpg,.jpeg,.png"
          onChange={async (e) => {
            const file = e.target.files[0]
            if (!file) {
              return
            }

            setLoading(true)
            const newImage = await getURLFromFile(file)
            setImageToCrop(newImage)
            fileInputRef.current.value = null
            setLoading(false)
          }}
        />
        {value && <img className="image-preview" src={value} height="32"/>}
        <span className="upload-text">
          {
            loading
              ? <CircularProgress size={52}/>
              : 'Upload an Ejection Image Here'
          }
        </span>
      </div>
      <CropDialog
        image={imageToCrop}
        open={Boolean(imageToCrop)}
        onClose={() => setImageToCrop(null)}
        onChange={onChange}
      />
      <style jsx>{`
        .upload-area {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          min-width: 113px;
          max-width: 113px;
          min-height: 100%;
          border: var(--default-border);
          border-radius: var(--default-border-radius);
          border-style: dotted;
          margin-right: 8px;
          cursor: pointer;

          > .image-preview {
            margin-bottom: 8px;
          }

          > .upload-text {
            text-align: center;
            font-size: 0.85em;
          }

          &.loading {
            opacity: 0.5;
            pointer-events: none;
          }
        }
      `}</style>
    </>
  )
}
