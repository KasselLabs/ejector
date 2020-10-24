import React, { useState, useEffect } from 'react'
import { Box, TextField } from '@material-ui/core'
import Head from 'next/head'

import CanvasAnimator from '../src/util/CanvasAnimator'
import CharacterGenerator from '../src/components/CharacterGenerator'
import DownloadGIFButton from '../src/components/DownloadGIFButton'
import UploadArea from '../src/components/UploadArea'
import ImageURLField from '../src/components/ImageURLField'

export default function Index () {
  const [image, setImage] = useState('/among-us-red-character-color-reduced.png')
  const [text, setText] = useState('Nihey was ejected')

  useEffect(() => {
    const canvas = document.getElementById('preview-canvas')
    const animator = new CanvasAnimator(canvas, text, image)
    animator.play()

    return () => {
      animator.stop()
    }
  }, [text, image])

  return (
    <div className="page">
      <Head>
        <title>Ejector - Eject Someone</title>
        <meta property="og:title" content="Ejector" />
        <meta property="og:type" content="website" />
        <meta property="og:description" content="Create an Among Us ejection animation for fun!" />
        <meta property="og:image" content="https://ejector.kassellabs.io/og-image.png" />
        <meta property="og:image:width" content="200" />
        <meta property="og:image:height" content="200" />
        <meta property="og:url" content="https://ejector.kassellabs.io" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Ejector" />
        <meta name="twitter:description" content="Create an Among Us ejection animation for fun!" />
        <meta name="twitter:image" content="https://ejector.kassellabs.io/twitter-card.png"/>
      </Head>
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
          <Box width="100%" pb={2} pt={1}>
            <CharacterGenerator
              onChange={setImage}
            />
          </Box>
          <Box display="flex" width="100%" pb={2}>
            <UploadArea
              value={image}
              onChange={setImage}
            />
            <TextField
              label="Ejection Text"
              variant="outlined"
              fullWidth
              multiline
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Box>
          <Box width="100%">
            <ImageURLField
              value={image}
              onChange={setImage}
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
        <Box pt={1}>
          <Box display="flex" alignItems="center" justifyContent="center" width="100%">
            Made with love by
            &nbsp;
            <a
              className="kassel-labs-logo"
              target="_blank"
              rel="noopener noreferrer"
              href="https://kassellabs.io/"
            >
              <img src="/kassel-labs-logo.svg" height="24"/>
            </a>
          </Box>
          <Box display="flex" justifyContent="center" width="100%" flexWrap="wrap">
            Want to discover more web apps like this?
            &nbsp;
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://kassellabs.io/"
            >Check our website</a>
          </Box>
        </Box>
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

        .kassel-labs-logo {
          display: inline-flex;
          align-items: center;
        }

        :global(.preview-form) {
          border: var(--default-border);
          border-radius: var(--default-border-radius);
        }
      `}</style>
    </div>
  )
}
