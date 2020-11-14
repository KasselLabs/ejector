import React, { useRef, useState } from 'react'
import { withStyles } from '@material-ui/core/styles'
import { Box, Button, TextField, CircularProgress, LinearProgress } from '@material-ui/core'

import { withTranslation } from '../../i18n'
import Dialog from './Dialog'
import DropdownMenu from './DropdownMenu'
import useDownloadFile from '../hooks/useDownloadFile'
import { usePaymentContext } from '../contexts/Payment'

const VideoDownloadDialogBase = ({ t, open, onClose, onFinish }) => {
  const [error, setError] = React.useState('')
  const [promo, setPromo] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const { isPaidUser } = usePaymentContext()

  React.useEffect(() => {
    if (open && isPaidUser) {
      onClose()
      onFinish()
    }
  }, [open, isPaidUser])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={t('Download Video')}
      actions={(
        <>
          <Button
            color="primary"
            variant="text"
            onClick={onClose}
          >
            {t('Close')}
          </Button>
          <div/>
        </>
      )}
    >
      <Box align="center" display="flex" justifyContent="center" alignItems="center" flexDirection="column" minHeight="100%">
        <Box mb={1}>
          {t('You can download a HD Quality video with sound for a small fee of')}
        &nbsp;
          <b>{ t('US$ 2') }</b>
        .&nbsp;
          { t('After this payment, you\'ll be able export unlimited videos in this same device for 1 week') }
        .
        </Box>
        <div className="call-to-action">
          <a
            href={`https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=${t('95XS97FYK5XKC')}`}
            rel="noopener noreferrer"
            target="_blank"
            onClick={() => setLoading(true)}
          >
            <Button variant="contained" color="primary">
              <Box display="flex" alignItems="center">
                {t('Buy with')}&nbsp;&nbsp;<img src="/paypal.png"/>
              </Box>
            </Button>
          </a>
        </div>
        {loading && <Box py={2} display="flex" alignItems="center" flexDirection="column">
          <p>{t('Waiting Payment')}</p>
          <CircularProgress/>
        </Box>}
        <Box align="center" mt={4} mb={2}>
          {t('If you have a promo code, you can also insert it below to get access to 1 week of unlimited exports')}
        .
        </Box>
        <TextField
          error={Boolean(error)}
          helperText={error}
          label={t('Promo Code')}
          placeholder={t('Paste your promo code here')}
          variant="outlined"
          fullWidth
          value={promo}
          onChange={async (e) => {
            const newPromo = e.target.value
            setPromo(newPromo)
            setError('')
          }}
          InputLabelProps={{ shrink: true }}
        />
        <Box mt={3}>
          {t('By using this website you are agreeing to our')}:&nbsp;
          <div>
            <a
              href="https://help.kassellabs.io/starwars/#termsOfService"
              rel="noopener noreferrer"
              target="_blank"
            >
              { t('Terms of Service') }
            </a>
          </div>
        </Box>
        <Box mt={1}>
          {t('If you have any questions, please email us at')}:&nbsp;
          <div>
            <a
              href="mailto:contact@kassellabs.io"
              rel="noopener noreferrer"
              target="_blank"
            >
              contact@kassellabs.io
            </a>
          </div>
        </Box>
        <style jsx>{`
        .call-to-action {
          display: flex;
          justify-content: center;

          a {
            text-decoration: none;
          }

          img {
            height: 24px;
          }
        }
      `}</style>
      </Box>
    </Dialog>
  )
}
const VideoDownloadDialog = withTranslation('common')(VideoDownloadDialogBase)

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

const DownloadButton = ({ t, ejectedText, impostorText, characterImages }) => {
  const inprogressAudio = useRef(null)
  const completeAudio = useRef(null)
  const [downloadingType, setDownloadingType] = useState('')
  const [isVideoDownloadDialogOpen, setIsVideoDownloadDialogOpen] = useState(false)
  const { isPaidUser } = usePaymentContext()

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
                if (isPaidUser) {
                  setDownloadingType(t('Video'))
                  generateFile('mp4')
                  return
                }

                setIsVideoDownloadDialogOpen(true)
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
      <VideoDownloadDialog
        open={isVideoDownloadDialogOpen}
        onClose={() => setIsVideoDownloadDialogOpen(false)}
        onFinish={() => {
          setDownloadingType(t('Video'))
          generateFile('mp4')
        }}
      />
    </Box>
  )
}

export default withTranslation('common')(DownloadButton)
