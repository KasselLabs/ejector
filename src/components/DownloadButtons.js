import React, { useRef } from 'react'
import { withStyles } from '@material-ui/core/styles'
import { Box, LinearProgress } from '@material-ui/core'

import { withTranslation } from '../../i18n'
import DownloadGIFButton from './DownloadGIFButton'
import DownloadMP4Button from './DownloadMP4Button'

import useDownloadGif from '../hooks/useDownloadGif'
import useDownloadMp4 from '../hooks/useDownloadMp4'

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

const DownloadButtons = ({ t, ejectedText, impostorText, image }) => {
  const inprogressAudio = useRef(null)
  const completeAudio = useRef(null)
  const inprogressAudioMp4 = useRef(null)
  const completeAudioMp4 = useRef(null)

  const {
    loading: loadingGif,
    loadingPercentage: loadingGifPercentage,
    generateGif
  } = useDownloadGif({ inprogressAudio, completeAudio, ejectedText, impostorText, image })

  const {
    loading: loadingMp4,
    loadingPercentage: loadingMp4Percentage,
    generateMp4
  } = useDownloadMp4({ inprogressAudio: inprogressAudioMp4, completeAudio: completeAudioMp4, ejectedText, impostorText, image })

  return (
    <Box pt={1} width="100%" align="center" >
      <audio src="/task_Inprogress.mp3" ref={inprogressAudio} />
      <audio src="/task_Complete.mp3" ref={completeAudio} />
      <audio src="/task_Inprogress.mp3" ref={inprogressAudioMp4} />
      <audio src="/task_Complete.mp3" ref={completeAudioMp4} />
      <DownloadGIFButton
        generateGif={generateGif}
        loading={loadingGif}
        loadingPercentage={loadingGifPercentage}
        style={{ marginRight: '1em' }}
      />
      <DownloadMP4Button
        generateMp4={generateMp4}
        loading={loadingMp4}
        loadingPercentage={loadingMp4Percentage}
      />
      {loadingGif &&
        <div style={{ marginBottom: '1em' }}>
          {t('Generating GIF')}
          <CustomLinearProgress className="loading-progress" variant="determinate" value={loadingGifPercentage} />
        </div>
      }
      {loadingMp4 &&
        <div>
          {t('Generating MP4 Video')}
          <CustomLinearProgress className="loading-progress" variant="determinate" value={loadingMp4Percentage} />
        </div>
      }
    </Box>
  )
}

export default withTranslation('common')(DownloadButtons)
