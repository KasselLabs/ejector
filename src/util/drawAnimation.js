import getBackgroundFrames from './getBackgroundFrames'

async function drawBackgroundVideo (canvas, elapsed = 0) {
  const frames = await getBackgroundFrames()
  const FPS = 30
  const frameNumber = Math.min(frames.length - 1, Math.round(elapsed * FPS))
  const frame = frames[frameNumber]

  const context = canvas.getContext('2d')
  context.drawImage(frame, 0, 0, canvas.width, canvas.height)
}

function getTextToDisplay (text, elapsed) {
  const START_SECONDS = 1.7
  const DURATION_SECONDS = 2
  const FINISHED_SECONDS = START_SECONDS + DURATION_SECONDS

  if (elapsed < START_SECONDS) {
    return ''
  }

  if (elapsed >= FINISHED_SECONDS) {
    return text
  }

  const elapsedSinceStart = elapsed - START_SECONDS
  const percentageOfTextShown = elapsedSinceStart / DURATION_SECONDS
  const textDisplayLength = Math.round(text.length * percentageOfTextShown)
  return text.slice(0, textDisplayLength)
}

function drawText (canvas, context, text = '', elapsed = 0) {
  const canvasTxt = require('canvas-txt').default
  const { width, height } = canvas

  context.font = 'Arial'
  context.textBaseline = 'middle'
  context.textAlign = 'center'
  context.fillStyle = 'white'

  const textToDisplay = getTextToDisplay(text, elapsed)
  canvasTxt.fontSize = 0.067 * height
  canvasTxt.drawText(context, textToDisplay, 0, 0, width, height)
}

const drawAnimation = async (canvas, text, elapsed) => {
  const { width, height } = canvas
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, width, height)
  await drawBackgroundVideo(canvas, elapsed)

  drawText(canvas, context, text, elapsed)
}

export default drawAnimation
