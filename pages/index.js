import React, { useMemo, useState, useEffect } from 'react'
import { Box, TextField } from '@material-ui/core'
import Head from 'next/head'

import { withTranslation } from '../i18n'
import CanvasAnimator from '../src/util/CanvasAnimator'
import CharacterGenerator from '../src/components/CharacterGenerator'
import DownloadButtons from '../src/components/DownloadButtons'
import UploadArea from '../src/components/UploadArea'
import ImageURLField from '../src/components/ImageURLField'
import SoundControl from '../src/components/SoundControl'
import ProductHuntButton from '../src/components/ProductHuntButton'
import SubscribeForm from '../src/components/SubscribeForm'
import DonateMention from '../src/components/DonateMention'
import track from '../src/track'

function Index ({ t }) {
  const DEFAULT_EJECTED_TEXT = t('Red was not The Impostor')
  const DEFAULT_IMPOSTOR_TEXT = t('1 Impostor remains')

  const [characterImages, setCharacterImages] = useState('/among-us-red-character-color-reduced.png')
  const image = useMemo(() => {
    if (Array.isArray(characterImages?.frames)) {
      return characterImages.frames[0].imageURL
    }

    return characterImages
  }, [characterImages])
  const [ejectedText, setEjectedText] = useState(DEFAULT_EJECTED_TEXT)
  const [impostorText, setImpostorText] = useState(DEFAULT_IMPOSTOR_TEXT)

  useEffect(() => {
    const canvas = document.getElementById('preview-canvas')
    const animator = new CanvasAnimator(canvas, ejectedText, impostorText, characterImages)
    animator.play()

    if (
      ejectedText !== DEFAULT_EJECTED_TEXT ||
      impostorText !== DEFAULT_IMPOSTOR_TEXT
    ) {
      track('event', 'ejection_form_text_changed')
    }

    return () => {
      animator.stop()
    }
  }, [ejectedText, impostorText, characterImages])

  return (
    <div className="page">
      <Head>
        <title>{t('Ejector - Eject Someone')}</title>
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
        <DonateMention/>
        <SubscribeForm/>
        <Box
          className="preview-form"
          display="flex"
          alignItems="center"
          flexDirection="column"
          mb={2}
          p={2}
          pb={2}
        >
          <Box
            className="header"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            width="100%"
          >
            <Box display="flex" alignItems="center">
              <h1>
                {t('Ejector')}
              </h1>
              <Box pl={2}>
                <ProductHuntButton />
              </Box>
            </Box>
            <SoundControl />
          </Box>
          <Box width="100%" pb={2} pt={1}>
            <CharacterGenerator
              onChange={setCharacterImages}
            />
          </Box>
          <Box display="flex" width="100%" pb={2}>
            <UploadArea
              value={image}
              onChange={setCharacterImages}
            />
            <Box display="flex" flexDirection="column" width="100%" >
              <TextField
                label={t('Ejection Text')}
                variant="outlined"
                fullWidth
                rows={1}
                value={ejectedText}
                onChange={(e) => setEjectedText(e.target.value)}
                style={{ paddingBottom: '2em' }}
              />
              <TextField
                label={t('Impostor Remain text')}
                variant="outlined"
                fullWidth
                rows={1}
                value={impostorText}
                onChange={(e) => setImpostorText(e.target.value)}
              />
            </Box>
          </Box>
          <Box width="100%">
            <ImageURLField
              value={image}
              onChange={setCharacterImages}
            />
          </Box>
          <DownloadButtons
            ejectedText={ejectedText}
            impostorText={impostorText}
            characterImages={characterImages}
          />
        </Box>
        <canvas id="preview-canvas" className="ejection-preview" width="1920" height="1080"/>
        <Box pt={1}>
          <Box display="flex" alignItems="center" justifyContent="center" width="100%">
            {t('Made with love by')}
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
            {t('Want to discover more web apps like this?')}
            &nbsp;
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://kassellabs.io/"
            >{t('Check our website')}</a>
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

        :global(.header) {
          @media (max-width: 1024px) {
            flex-wrap: wrap;
            justify-content: center !important;
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

Index.getInitialProps = () => ({
  namespacesRequired: ['common']
})

export default withTranslation('common')(Index)
