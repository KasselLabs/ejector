import React from 'react'
import {
  Box,
  Dialog,
  Button,
  Slider,
  DialogTitle,
  DialogContent,
  Typography,
  Tooltip
} from '@material-ui/core'
import CropIcon from '@material-ui/icons/Crop'
import CloseIcon from '@material-ui/icons/Close'
import VerticalAlignCenterIcon from '@material-ui/icons/VerticalAlignCenter'
import FullscreenIcon from '@material-ui/icons/Fullscreen'
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit'
import Cropper from 'react-easy-crop'

import getCroppedImage from '../util/getCroppedImage'
import getResizedImage from '../util/getResizedImage'

const DEFAULT_CROP = {
  x: 0,
  y: 0
}

const CROP_SIZE = {
  width: 240,
  height: 240
}

const CropDialog = ({ image, onChange, open, onClose }) => {
  const [mediaSize, setMediaSize] = React.useState(null)
  const [cropArea, setCropArea] = React.useState(null)
  const [crop, setCrop] = React.useState(DEFAULT_CROP)
  const [zoom, setZoom] = React.useState(1)
  const [rotation, setRotation] = React.useState(0)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl">
      <DialogTitle id="alert-dialog-title">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <span>Crop Image</span>
          <CloseIcon onClick={onClose}/>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box
          display="flex"
          position="relative"
          height="50vh"
          width="50vw"
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
            onCropComplete={(_, newCropArea) => setCropArea(newCropArea)}
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
                <Tooltip title="Center the image horizontally" placement="right">
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
              <Tooltip title="Center the image vertically" placement="right">
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
              <Tooltip title="Fits the image inside the crop area" placement="right">
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
              <Tooltip title="Fill the crop area with the image" placement="right">
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
            <Typography gutterBottom>Zoom</Typography>
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
            <Typography gutterBottom>Rotation</Typography>
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
      </DialogContent>
      <Box display="flex" justifyContent="space-between" px={3} pb={2} pt={1}>
        <Button
          color="primary"
          variant="text"
          onClick={onClose}
        >
          Close
        </Button>
        <Button
          color="primary"
          variant="contained"
          startIcon={<CropIcon/>}
          onClick={async () => {
            const croppedImage = await getCroppedImage(image, cropArea, rotation)
            const resizedImage = await getResizedImage(
              croppedImage,
              { maxWidth: 240, maxHeight: 240, backgroundColor: 'rgba(0, 0, 0, 0)' }
            )
            onChange(resizedImage)
            onClose()
          }}
        >
          Confirm
        </Button>
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
      `}</style>
    </Dialog>
  )
}

export default CropDialog
