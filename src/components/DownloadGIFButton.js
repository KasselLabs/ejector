import React, { useState, useEffect, useRef } from 'react'
import classnames from 'classnames'
import { withStyles } from '@material-ui/core/styles'
import { Box, Container, Button, LinearProgress } from '@material-ui/core'

import { withTranslation } from '../../i18n'
import events, { GIF_GENERATION_LOADING_STEP } from '../events'
import getGIFURLFromAnimation from '../util/getGIFURLFromAnimation'

const downloadURL = (url, filename) => {
  const aElement = document.createElement('a')
  document.body.append(aElement)
  aElement.style = 'display: none'
  aElement.href = url
  aElement.download = `${filename}.gif`
  aElement.click()
  aElement.remove()
}

const CustomLinearProgress = withStyles((theme) => ({
  root: {
    height: 10,
    borderRadius: 5
  },
  colorPrimary: {
    backgroundColor: theme.palette.grey[800]
  },
  bar: {
    borderRadius: 5,
    backgroundColor: theme.palette.success.main
  }
}))(LinearProgress)

function DownloadGIFButton ({ t, ejectedText, impostorText, characterImages }) {
  const [loading, setLoading] = useState(false)
  const [loadingPercentage, setLoadingPercentage] = useState(0)

  const inprogressAudio = useRef(null)
  const completeAudio = useRef(null)

  useEffect(() => {
    const onLoadingStep = (percentage) => {
      setLoadingPercentage(Math.round(percentage * 100))
    }

    events.on(GIF_GENERATION_LOADING_STEP, onLoadingStep)
    return () => {
      events.off(GIF_GENERATION_LOADING_STEP, onLoadingStep)
    }
  }, [])

  return (
    <Box display="flex" flexDirection="column" width="100%" align="center">
      <audio src="/task_Inprogress.mp3" ref={inprogressAudio} />
      <audio src="/task_Complete.mp3" ref={completeAudio} />
      <Container>
        <Button
          className={classnames('download-gif-button', { loading })}
          variant="contained"
          color="primary"
          onClick={async () => {
            if (loading) {
              return
            }

            setLoading(true)
            inprogressAudio.current.play()
            const gifURL = await getGIFURLFromAnimation(ejectedText, impostorText, characterImages)
            downloadURL(gifURL, ejectedText.replace(/\s|\n/g, '-'))
            window.URL.revokeObjectURL(gifURL)
            setLoading(false)
            setLoadingPercentage(0)
            completeAudio.current.play()
          }}
        >
          {
            loading
              ? (
                <span>
                  {t('Generating GIF')} ({loadingPercentage}%)
                </span>
              )
              : t('Download GIF')
          }
        </Button>
        {loading &&
          <CustomLinearProgress className="loading-progress" variant="determinate" value={loadingPercentage} />
        }
        <style jsx>{`
        :global(.download-gif-button.loading) {
          pointer-events: none;
          margin-bottom: 1em;
        }
      `}</style>
      </Container>
    </Box>
  )
}

export default withTranslation('common')(DownloadGIFButton)
