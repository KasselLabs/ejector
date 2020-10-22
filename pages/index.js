import React from 'react'
import { Box, TextField } from '@material-ui/core'

import CanvasAnimator from '../src/util/CanvasAnimator'
import CharacterGenerator from '../src/components/CharacterGenerator'
import DownloadGIFButton from '../src/components/DownloadGIFButton'
import UploadArea from '../src/components/UploadArea'

export default function Index () {
  const [image, setImage] = React.useState('/among-us-red-character-color-reduced.png')
  const [text, setText] = React.useState('Nihey was ejected')

  React.useEffect(() => {
    const canvas = document.getElementById('preview-canvas')
    const animator = new CanvasAnimator(canvas, text, image)
    animator.play()

    return () => {
      animator.stop()
    }
  }, [text, image])

  return (
    <div className="page">
      <div className="preview-container">
        <Box
          className="preview-form"
          display="flex"
          alignItems="center"
          flexDirection="column"
          mb={2}
          p={2}
          pb={2}
        >
          <Box width="100%" pb={3} pt={1}>
            <CharacterGenerator onChange={setImage}/>
          </Box>
          <Box display="flex" width="100%">
            <UploadArea
              value={image}
              onChange={setImage}
            />
            <TextField
              label="Ejection Text"
              variant="outlined"
              fullWidth
              multiline
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Box>
          <Box pt={1}>
            <DownloadGIFButton
              text={text}
              image={image}
            />
          </Box>
        </Box>
        <canvas id="preview-canvas" className="ejection-preview" width="1920" height="1080"/>
      </div>
      <style jsx>{`
        .page {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          min-height: 100%;
          width: 100%;

          @media (max-width: 1024px) {
            justify-content: start;
          }
        }

        .preview-container {
          width: 680px;

          @media (max-width: 1024px) {
            width: calc(100vw - 32px);
          }
        }

        .ejection-preview {
          width: 100%;
          border: var(--default-border);
          border-radius: var(--default-border-radius);
        }

        :global(.preview-form) {
          border: var(--default-border);
          border-radius: var(--default-border-radius);
        }
      `}</style>
    </div>
  )
}
