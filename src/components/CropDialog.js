import React from 'react'
import {
  Box,
  Button,
  Slider,
  CircularProgress,
  Typography,
  Tooltip
} from '@material-ui/core'
import CropIcon from '@material-ui/icons/Crop'
import VerticalAlignCenterIcon from '@material-ui/icons/VerticalAlignCenter'
import FullscreenIcon from '@material-ui/icons/Fullscreen'
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit'
import Cropper from 'react-easy-crop'
import { useTranslation } from 'react-i18next'

import Dialog from './Dialog'
import getCroppedImages from '../util/getCroppedImages'
import getResizedImages from '../util/getResizedImages'
import track from '../track'

const DEFAULT_CROP = {
  x: 0,
  y: 0
}

const CROP_SIZE = {
  width: 240,
  height: 240
}

const CropDialog = ({ image, onChange, open, onClose }) => {
  const { t } = useTranslation()
  const [mediaSize, setMediaSize] = React.useState(null)
  const [cropArea, setCropArea] = React.useState(null)
  const [crop, setCrop] = React.useState(DEFAULT_CROP)
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      track('event', 'crop_image_modal_open')
    }
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      title={t('Crop Image')}
      actions={(
        <>
          <Button
            color="primary"
            variant="text"
            onClick={onClose}
          >
            {t('Close')}
          </Button>
          <Button
            color="primary"
            variant="contained"
            startIcon={<CropIcon/>}
            disabled={loading}
            onClick={async () => {
              setLoading(true)
              const croppedImages = await getCroppedImages(image, cropArea, rotation)
              const resizedImages = await getResizedImages(
                croppedImages,
                { maxWidth: 240, maxHeight: 240, backgroundColor: 'rgba(0, 0, 0, 0)' }
              )
              onChange(resizedImages)
              onClose()
              setLoading(false)
              track('event', 'crop_image_completed')
            }}
          >
            {
              loading
                ? (
                  <Box display="inline-flex">
                    {t('Loading')}
                    <Box display="flex" justifyContent="center" alignItems="center" ml={1}>
                      <CircularProgress size={16}/>
                    </Box>
                  </Box>
                )
                : t('Confirm')
            }
          </Button>
        </>
      )}
    >
      <Box
        className="cropper-container"
        display="flex"
        position="relative"
        borderRadius="5px"
        overflow="hidden"
      >
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          aspect={1}
          restrictPosition={false}
          onCropAreaChange={(_, newCropArea) => setCropArea(newCropArea)}
          cropSize={CROP_SIZE}
          onMediaLoaded={(loadedMediaSize) => {
            setMediaSize(loadedMediaSize)
          }}
        />
        {mediaSize && (
          <Box
            className="crop-dialog-easy-actions"
            display="flex"
            position="absolute"
            left="8px"
            bottom="8px"
            flexDirection="column"
          >
            <Box style={{ transform: 'rotate(90deg)' }}>
              <Tooltip title={t('Center the image horizontally')} placement="right">
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    setCrop({ ...crop, x: 0 })
                  }}
                >
                  <VerticalAlignCenterIcon/>
                </Button>
              </Tooltip>
            </Box>
            <Tooltip title={t('Center the image vertically')} placement="right">
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setCrop({ ...crop, y: 0 })
                }}
              >
                <VerticalAlignCenterIcon/>
              </Button>
            </Tooltip>
            <Tooltip title={t('Fits the image inside the crop area')} placement="right">
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  // Adjust the size
                  const widthResize = CROP_SIZE.width / mediaSize.width
                  const heightResize = CROP_SIZE.height / mediaSize.height
                  const newZoom = Math.min(widthResize, heightResize)
                  setZoom(newZoom)
                  setRotation(0)

                  // Adjust the alignment
                  setCrop({ x: 0, y: 0 })
                }}
              >
                <FullscreenExitIcon/>
              </Button>
            </Tooltip>
            <Tooltip title={t('Fill the crop area with the image')} placement="right">
              <Button
                variant="contained"
                color="primary"
                onClick={async () => {
                  // Adjust the size
                  const widthResize = CROP_SIZE.width / mediaSize.width
                  const heightResize = CROP_SIZE.height / mediaSize.height
                  const newZoom = Math.max(widthResize, heightResize)
                  setZoom(newZoom)
                  setRotation(0)

                  // Adjust the alignment
                  setCrop({ x: 0, y: 0 })
                }}
              >
                <FullscreenIcon/>
              </Button>
            </Tooltip>
          </Box>
        )}
      </Box>
      <Box display="flex" justifyContent="space-between" mt={2}>
        <Box width="50%" pr={1}>
          <Typography gutterBottom>{t('Zoom')}</Typography>
          <Slider
            value={zoom}
            onChange={(event, newZoom) => setZoom(newZoom)}
            valueLabelDisplay="auto"
            valueLabelFormat={value => value.toFixed(2)}
            min={0.1}
            step={0.01}
            max={10}
          />
        </Box>
        <Box width="50%" pl={1}>
          <Typography gutterBottom>{t('Rotation')}</Typography>
          <Slider
            value={rotation}
            onChange={(event, newRotation) => setRotation(newRotation)}
            valueLabelDisplay="auto"
            valueLabelFormat={value => value.toFixed(1)}
            min={-180}
            step={0.1}
            max={180}
          />
        </Box>
      </Box>

      <style jsx>{`
        :global(.crop-dialog-easy-actions) {
          :global(button) {
            $size: 38px;
            min-width: $size;
            min-height: $size;
            max-width: $size;
            max-height: $size;
          }

          :global(> *) {
            margin-bottom: 8px;
          }
        }

        :global(.cropper-container) {
          width: 50vw;
          height: 50vh;

          @media (max-width: 1024px) {
            width: 100%;
            height: 60vh;
          }
        }
      `}</style>
    </Dialog>
  )
}

export default CropDialog
