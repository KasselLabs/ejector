function getCharacterImageForTime (characterImages, elapsed) {
  const limitedElapsed = Math.round(elapsed * 1000) % Math.round(characterImages.duration * 1000) / 1000
  const foundFrame = characterImages.frames.find(frame => {
    return (
      limitedElapsed >= frame.start &&
      limitedElapsed <= frame.end
    )
  })

  return foundFrame.image
}

function drawCharacter (canvas, context, characterImages, elapsed) {
  const SPEED_X = 0.28
  const ROTATION_SPEED = 1.3

  const positionY = (canvas.height / 2)
  const positionX = canvas.width * (SPEED_X * elapsed)

  const characterImage = getCharacterImageForTime(characterImages, elapsed)
  const aspectRatio = characterImage.width / characterImage.height
  const height = canvas.height / 4.46
  const width = height * aspectRatio

  context.save()
  context.translate(positionX, positionY)
  context.rotate(-elapsed * ROTATION_SPEED)
  context.drawImage(
    characterImage,
    -width / 2,
    -height / 2,
    width,
    height
  )
  context.restore()
}

function getEjectedTextToDisplay (text, elapsed) {
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

function drawEjectedText (canvas, context, text = '', elapsed = 0) {
  const canvasTxt = require('canvas-txt').default
  const { width, height } = canvas

  const textToDisplay = getEjectedTextToDisplay(text, elapsed)
  context.fillStyle = 'white'
  canvasTxt.font = 'Arial'
  canvasTxt.fontSize = 0.067 * height
  canvasTxt.vAlign = 'middle'
  canvasTxt.align = 'center'
  canvasTxt.drawText(context, textToDisplay, 0, 0, width, height)
}

function drawImpostorText (canvas, context, text = '', elapsed = 0) {
  const canvasTxt = require('canvas-txt').default
  const { width, height } = canvas

  const START_IMPOSTOR_TEXT_SECONDS = 3.8
  const diffElapsed = elapsed - START_IMPOSTOR_TEXT_SECONDS

  const animationStages = [0, 0.33, 0.66, 1, 1.2]
  const animationFontSize = [0.7, 1.2, 0.8, 1.1, 1]

  const indexTime = animationStages.findIndex((value, index) => {
    return diffElapsed < value
  })

  if (diffElapsed <= 0) {
    return
  }

  let fontSize = 1
  if (indexTime === -1) {
    fontSize = 1
  } else {
    const initialTime = animationStages[indexTime - 1]
    const endDuration = animationStages[indexTime] - initialTime
    const interpolatedTime = (diffElapsed - initialTime) / endDuration

    const fontSizeStart = animationFontSize[indexTime - 1]
    const fontSizeNext = animationFontSize[indexTime]
    const fontSizeDiff = fontSizeNext - fontSizeStart
    fontSize = fontSizeStart + (fontSizeDiff * interpolatedTime)
  }

  context.fillStyle = 'white'
  canvasTxt.font = 'Arial'
  canvasTxt.fontSize = 0.067 * height * fontSize
  canvasTxt.vAlign = 'middle'
  canvasTxt.align = 'center'
  canvasTxt.drawText(context, text, 0, 0.0804 * height, width, height)
}

const drawSkeldAnimation = async (canvas, ejectedText, impostorText, characterImages, elapsed, showWatermark = true) => {
  const context = canvas.getContext('2d')

  drawEjectedText(canvas, context, ejectedText, elapsed)
  drawImpostorText(canvas, context, impostorText, elapsed)
  drawCharacter(canvas, context, characterImages, elapsed)
}

export default drawSkeldAnimation
