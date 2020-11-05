import React, { useState, useEffect, useRef } from 'react'
import classnames from 'classnames'
import { withStyles } from '@material-ui/core/styles'
import { Box, Container, Button, LinearProgress } from '@material-ui/core'

import { withTranslation } from '../../i18n'
import events, { MP4_GENERATION_LOADING_STEP } from '../events'
import getMP4URLFromAnimation from '../util/getMP4URLFromAnimation'

const downloadURL = (url, filename) => {
  const aElement = document.createElement('a')
  document.body.append(aElement)
  aElement.style = 'display: none'
  aElement.href = url
  aElement.download = `${filename}.mp4`
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

function DownloadGIFButton ({ t, ejectedText, impostorText, image }) {
  const [loading, setLoading] = useState(false)
  const [loadingPercentage, setLoadingPercentage] = useState(0)

  const inprogressAudio = useRef(null)
  const completeAudio = useRef(null)

  useEffect(() => {
    const onLoadingStep = (percentage) => {
      setLoadingPercentage(Math.round(percentage * 100))
    }

    events.on(MP4_GENERATION_LOADING_STEP, onLoadingStep)
    return () => {
      events.off(MP4_GENERATION_LOADING_STEP, onLoadingStep)
    }
  }, [])

  return (
    <Box display="flex" flexDirection="column" width="100%" align="center">
      <audio src="/task_Inprogress.mp3" ref={inprogressAudio} />
      <audio src="/task_Complete.mp3" ref={completeAudio} />
      <Container>
        <Button
          className={classnames('download-mp4-button', { loading })}
          variant="contained"
          color="primary"
          onClick={async () => {
            setLoading(true)
            inprogressAudio.current.play()
            const gifURL = await getMP4URLFromAnimation(ejectedText, impostorText, image)
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
                  {t('Generating Video')} ({loadingPercentage}%)
                </span>
              )
              : t('Download Video')
          }
        </Button>
        {loading &&
          <CustomLinearProgress className="loading-progress" variant="determinate" value={loadingPercentage} />
        }
        <style jsx>{`
        :global(.download-mp4-button.loading) {
          margin-bottom: 1em;
        }
      `}</style>
      </Container>
    </Box>
  )
}

export default withTranslation('common')(DownloadGIFButton)
