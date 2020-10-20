import React from 'react'
import { Box, TextField } from '@material-ui/core'

import CanvasAnimator from '../src/util/CanvasAnimator'
import DownloadGIFButton from '../src/components/DownloadGIFButton'

export default function Index () {
  const [text, setText] = React.useState('Nihey was ejected')

  React.useEffect(() => {
    const canvas = document.getElementById('preview-canvas')
    const animator = new CanvasAnimator(canvas, text)
    animator.play()

    return () => {
      animator.stop()
    }
  }, [text])

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
          <TextField
            label="Ejection Text"
            variant="outlined"
            fullWidth
            multiline
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Box pt={1}>
            <DownloadGIFButton
              text={text}
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
          height: 100%;
        }

        .preview-container {
          width: 600px;
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
