import React, { useRef, useState } from 'react'
import { withStyles } from '@material-ui/core/styles'
import { Box, LinearProgress } from '@material-ui/core'

import { withTranslation } from '../../i18n'
import DropdownMenu from './DropdownMenu'
import useDownloadFile from '../hooks/useDownloadFile'

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

const DownloadButtons = ({ t, ejectedText, impostorText, characterImages }) => {
  const inprogressAudio = useRef(null)
  const completeAudio = useRef(null)
  const [downloadingType, setDownloadingType] = useState('')

  const {
    loading,
    loadingPercentage,
    generateFile
  } = useDownloadFile({ inprogressAudio, completeAudio, ejectedText, impostorText, characterImages })

  return (
    <Box pt={2} width="100%" align="center">
      <audio src="/task_Inprogress.mp3" ref={inprogressAudio} />
      <audio src="/task_Complete.mp3" ref={completeAudio} />
      <Box display="flex" justifyContent="center">
        <DropdownMenu
          text={t('Download')}
          loading={loading}
          loadingText={t('Generating') + ' ' + downloadingType + ` (${loadingPercentage}%)`}
          items={[
            {
              children: t('Download GIF'),
              onClick: () => {
                setDownloadingType(t('GIF'))
                generateFile('gif')
              }
            },
            {
              children: t('Download Video'),
              onClick: () => {
                setDownloadingType(t('Video'))
                generateFile('mp4')
              }
            }
          ]}
        />
      </Box>
      {loading &&
        <Box pt={1}>
          <CustomLinearProgress
            className="loading-progress"
            variant="determinate"
            value={loadingPercentage}
          />
        </Box>
      }
    </Box>
  )
}

export default withTranslation('common')(DownloadButtons)
