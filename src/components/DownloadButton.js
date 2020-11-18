import React, { useRef, useState, useEffect } from 'react'
import { withStyles } from '@material-ui/core/styles'
import {
  Box,
  Button,
  CircularProgress,
  // TextField,
  // InputAdornment,
  LinearProgress
} from '@material-ui/core'
import { PayPalButton } from 'react-paypal-button-v2'

import { withTranslation } from '../../i18n'
import Dialog from './Dialog'
import isFFMPEGWorking from '../util/isFFMPEGWorking'
import track from '../track'
import useDownloadFile from '../hooks/useDownloadFile'
import { usePaymentContext } from '../contexts/Payment'

const VideoDownloadNotSupportedDialogBase = ({ t, open, onClose }) => {
  React.useEffect(() => {
    if (open) {
      track('event', 'modal_video_not_supported_open')
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={t('Download Video')}
      actions={(
        <Button
          color="primary"
          variant="text"
          onClick={onClose}
        >
          {t('Close')}
        </Button>
      )}
    >
      <Box align="center" mb={2}>
        {t('Unfortunately, downloading videos is currently only enabled on Desktop')}.
      </Box>
      <Box align="center">
        {t('If you really want to download videos, please access this website via a computer, preferrably on a Chrome Browser')}.
      </Box>
    </Dialog>
  )
}

const VideoDownloadNotSupportedDialog = withTranslation('common')(VideoDownloadNotSupportedDialogBase)

const VideoDownloadDialogBase = ({ t, open, onClose, onFinish }) => {
  // TODO check if necessary allow manual validation by the user
  // const [error, setError] = React.useState('')
  // const [textLoading, setTextLoading] = React.useState(false)
  // const [localOrderId, setLocalOrderId] = React.useState('')

  const [loading, setLoading] = React.useState(false)
  const { isPaidUser, setOrderId } = usePaymentContext()

  React.useEffect(() => {
    if (open && isPaidUser) {
      onClose()
      onFinish()
    }
  }, [open, isPaidUser])

  React.useEffect(() => {
    if (open) {
      track('event', 'modal_payment_open')
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      title={t('Download Video')}
      actions={(
        <Button
          color="primary"
          variant="text"
          onClick={onClose}
        >
          {t('Close')}
        </Button>
      )}
    >
      <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" minHeight="100%">
        <Box mb={1} align="center">
          {t('You can download a HD Quality video with sound for a small fee of')}
        &nbsp;
          <b>{ t('US$ 3') }</b>
        .&nbsp;
          { t('After this payment, you\'ll be able export unlimited videos in this same device for 1 day') }
        .
        </Box>
        <div className="paypal-button">
          <PayPalButton
            amount={t('3')}
            currency={t('USD')}
            shippingPreference="NO_SHIPPING"
            onClick={() => {
              setLoading(true)
              track('event', 'paypal_button_click')
            }}
            onCancel={() => {
              setLoading(false)
            }}
            onError={() => {
              setLoading(false)
            }}
            onSuccess={(details, data) => {
              setLoading(true)
              setOrderId(data.orderID)
            }}
            style={{
              layout: 'horizontal',
              color: 'white',
              shape: 'rect',
              label: 'paypal',
              height: 40
            }}
            options={{
              clientId: process.env.PAYPAL_ID,
              currency: t('USD')
            }}
          />
        </div>
        {loading && <Box py={2} display="flex" alignItems="center" flexDirection="column">
          <p>{t('Validating Payment')}</p>
          <CircularProgress/>
        </Box>}
        {/* <Box align="center" mt={4} mb={2}>
          {t('Have you paid from another device? Insert the your Paypal Order ID here so we can validate it for you')}
          .
        </Box>
        <TextField
          error={Boolean(error)}
          helperText={error}
          label={t('Order ID')}
          placeholder={t('Paste your Order ID here')}
          variant="outlined"
          fullWidth
          value={localOrderId}
          onChange={async (e) => {
            const newOrderId = e.target.value
            setLocalOrderId(newOrderId)
            setError('')
            setTextLoading(true)

            const isValid = await isOrderValid(newOrderId)
            if (isValid) {
              setOrderId(newOrderId)
              setTimeout(() => {
                setTextLoading(false)
              }, 10000)
              return
            }

            setError(t('Invalid Order Id'))
            setTextLoading(false)
          }}
          InputLabelProps={{ shrink: true }}
          InputProps={textLoading ? {
            endAdornment: (
              <InputAdornment position="end">
                <CircularProgress size={32}/>
              </InputAdornment>
            )
          } : null}
        /> */}
        <Box mt={1} align="center">
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
      </Box>
      <style jsx>{`
        :global(.paypal-button) {
          height: 40px;
          overflow: hidden;
        }
      `}</style>
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

  const [isTestingVideoDownload, setIsTestingVideoDownload] = useState(true)
  const [isVideoDownloadWorking, setIsVideoDownloadWorking] = useState(false)

  const {
    loading,
    loadingPercentage,
    generateFile
  } = useDownloadFile({ inprogressAudio, completeAudio, ejectedText, impostorText, characterImages })

  useEffect(() => {
    isFFMPEGWorking().then(isWorking => {
      setIsVideoDownloadWorking(isWorking)
      setIsTestingVideoDownload(false)
    })
  }, [])

  return (
    <Box pt={2} width="100%" align="center">
      <audio src="/task_Inprogress.mp3" ref={inprogressAudio} />
      <audio src="/task_Complete.mp3" ref={completeAudio} />
      <Box display="flex" justifyContent="center">
        <Button
          disabled={loading}
          variant="contained"
          color="primary"
          onClick={() => {
            setDownloadingType(t('GIF'))
            generateFile('gif')
          }}
          style={{
            marginRight: '1em'
          }}
        >
          {
            t('Download GIF')
          }
        </Button>
        <Button
          disabled={loading}
          variant="contained"
          color="primary"
          onClick={() => {
            if (isTestingVideoDownload) {
              // TODO show loading progress when validating browser support
              return
            }

            if (isPaidUser) {
              setDownloadingType(t('Video'))
              generateFile('mp4')
              return
            }

            setIsVideoDownloadDialogOpen(true)
          }}
        >
          {
            t('Download Video')
          }
        </Button>
      </Box>
      {loading &&
        <Box pt={1}>
          <Box pb={1}>
            { t('Generating') }&nbsp;{ downloadingType }
          </Box>
          <CustomLinearProgress
            className="loading-progress"
            variant="determinate"
            value={loadingPercentage}
          />
        </Box>
      }
      <VideoDownloadDialog
        open={isVideoDownloadDialogOpen && isVideoDownloadWorking}
        onClose={() => setIsVideoDownloadDialogOpen(false)}
        onFinish={() => {
          setDownloadingType(t('Video'))
          generateFile('mp4')
        }}
      />
      <VideoDownloadNotSupportedDialog
        open={isVideoDownloadDialogOpen && !isVideoDownloadWorking}
        onClose={() => setIsVideoDownloadDialogOpen(false)}
      />
      <style jsx>{`
        :global(.download-button.loading) {
          pointer-events: none;
        }
      `}</style>
    </Box>
  )
}

export default withTranslation('common')(DownloadButton)
