import React, { useRef, useState } from 'react'
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
import dynamic from 'next/dynamic'

import { withTranslation } from '../../i18n'
import Dialog from './Dialog'
import track from '../track'
import useDownloadFile from '../hooks/useDownloadFile'
import { usePaymentContext } from '../contexts/Payment'

// Load the Email on Client side only to avoid receiving spam emails
const SupportEmailLink = dynamic(() => import('./SupportEmailLink'), {
  ssr: false
})

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
          <p>
            { t('Downloaded videos will have the same watermark as in the preview') }
            .&nbsp;
            { t('If you wish to generate videos without watermark, we can do it for you for US$ 5') }
            .&nbsp;
            { t("Contact us through the email below and we'll generate it for you") }
            .
          </p>
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
            <SupportEmailLink/>
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
        open={isVideoDownloadDialogOpen}
        onClose={() => setIsVideoDownloadDialogOpen(false)}
        onFinish={() => {
          setDownloadingType(t('Video'))
          generateFile('mp4')
        }}
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
