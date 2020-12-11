import getBackgroundFrames from './getBackgroundFrames'
import drawSkeldAnimation from './drawSkeldAnimation'
import drawMiraHQAnimation from './drawMiraHQAnimation'

async function drawBackgroundVideo (canvas, type, elapsed = 0) {
  const frames = await getBackgroundFrames()
  const FPS = 30
  const frameNumber = Math.min(frames.length - 1, Math.round(elapsed * FPS))
  const frame = frames[frameNumber]

  const context = canvas.getContext('2d')
  context.drawImage(frame, 0, 0, canvas.width, canvas.height)

  if (type === 'skeld') {
    // Fill Tiny Imperfection on Background with a black rectangle
    const imperfectionPositionX = canvas.width * 0.5
    const imperfectionPositionY = canvas.height * 0.65
    const imperfectionWidth = canvas.width * 0.05
    const imperfectionHeight = canvas.height * 0.09
    context.fillStyle = 'black'
    context.fillRect(
      imperfectionPositionX,
      imperfectionPositionY,
      imperfectionWidth,
      imperfectionHeight
    )
  }
}

function drawWatermark (canvas, context) {
  const canvasTxt = require('canvas-txt').default
  const { width, height } = canvas

  const rightPadding = 0.008 * width
  const bottomPadding = -0.018 * height
  const fontSize = 0.08 * height
  context.fillStyle = 'rgba(255, 255, 255, 0.6)'
  canvasTxt.font = 'Arial'
  canvasTxt.fontSize = fontSize
  canvasTxt.vAlign = 'bottom'
  canvasTxt.align = 'right'
  canvasTxt.drawText(
    context,
    'EJECTOR.KASSELLABS.IO',
    0,
    0,
    width - rightPadding,
    height - (fontSize / 2) - bottomPadding
  )
}

const drawAnimation = async (canvas, type, ejectedText, impostorText, characterImages, elapsed, showWatermark = true) => {
  const { width, height } = canvas
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, width, height)
  await drawBackgroundVideo(canvas, type, elapsed)

  switch (type) {
    case 'skeld':
      drawSkeldAnimation(canvas, ejectedText, impostorText, characterImages, elapsed)
      break
    case 'mirahq':
      drawMiraHQAnimation(canvas, ejectedText, impostorText, characterImages, elapsed)
      break
  }

  if (showWatermark) {
    drawWatermark(canvas, context)
  }
}

export default drawAnimation
