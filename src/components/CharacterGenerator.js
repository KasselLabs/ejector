import React from 'react'
import { Box, Typography } from '@material-ui/core'
import tinycolor from 'tinycolor2'
import classnames from 'classnames'

import { withTranslation } from '../../i18n'
import getImage from '../util/getImage'

const getColorHexAtIndex = (imageData, index) => {
  const color = tinycolor({
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2]
  })

  return color.toHexString()
}

const getColorChangedImage = async (colorToChange) => {
  const canvas = document.createElement('canvas')
  const characterImage = await getImage('/among-us-red-character-color-reduced.png')
  canvas.width = characterImage.width
  canvas.height = characterImage.height
  const context = canvas.getContext('2d')
  context.drawImage(characterImage, 0, 0, canvas.width, canvas.height)

  const darkenPercentage = colorToChange.darken || 24
  const parsedColorToChange = tinycolor(colorToChange.value)
  const parsedColorRGBA = parsedColorToChange.toRgb()
  const darkParsedColorRGBA = parsedColorToChange.darken(darkenPercentage).toRgb()

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

  const COLOR_RED = getColorHexAtIndex(imageData, 47304)
  const COLOR_DARK_RED = getColorHexAtIndex(imageData, 47620)

  for (var i = 0; i < imageData.data.length; i += 4) {
    const red = imageData.data[i]
    const green = imageData.data[i + 1]
    const blue = imageData.data[i + 2]
    const alpha = imageData.data[i + 3]
    const color = tinycolor({ r: red, g: green, b: blue, a: alpha / 255 })
    const colorHex = color.toHexString()

    switch (colorHex) {
      case COLOR_RED:
        imageData.data[i] = parsedColorRGBA.r
        imageData.data[i + 1] = parsedColorRGBA.g
        imageData.data[i + 2] = parsedColorRGBA.b
        break
      case COLOR_DARK_RED:
        imageData.data[i] = darkParsedColorRGBA.r
        imageData.data[i + 1] = darkParsedColorRGBA.g
        imageData.data[i + 2] = darkParsedColorRGBA.b
        break
      default:
        break
    }
  }
  context.putImageData(imageData, 0, 0)

  return getImage(canvas.toDataURL('image/png'))
}

const generateCharacter = async (canvas, color) => {
  const context = canvas.getContext('2d')
  const characterImage = await getColorChangedImage(color)
  context.drawImage(characterImage, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/png')
}

const colors = [
  { value: '#d1211d' },
  { value: '#1e27e2' },
  { value: '#328100', darken: 10 },
  //
  { value: '#e052c2' },
  { value: '#e47e00' },
  { value: '#f6f157', darken: 40 },
  //
  { value: '#3f474e', darken: 10 },
  { value: '#d7e1f1' },
  { value: '#6b2fbc', darken: 20 },
  //
  { value: '#71491e', darken: 10 },
  { value: '#74fdd8', darken: 40 },
  { value: '#75f100' }
]

function CharacterGenerator ({ t, onChange }) {
  const [selectedColor, setSelectedColor] = React.useState(colors[0])

  React.useEffect(() => {
    const canvas = document.getElementById('character-generator')
    generateCharacter(canvas, selectedColor).then(onChange)
  }, [selectedColor])

  return (
    <>
      <Box pb={1}>
        <Typography variant="subtitle2">
          { t('Select Your Character Color') }:
        </Typography>
      </Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
        <canvas id="character-generator" width="125" height="162"/>
        <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent="center">
          {colors.map(color => {
            const isSelected = color.value === selectedColor.value
            return (
              <div
                key={color.value}
                className={classnames('color-selector', { selected: isSelected })}
                style={{ background: color.value }}
                onClick={() => setSelectedColor(color)}
              />
            )
          })}
        </Box>
        <style jsx>{`
        .color-selector {
          width: 42px;
          height: 42px;
          margin: 0 0 8px 8px;
          border-radius: var(--default-border-radius);
          cursor: pointer;

          &.selected {
            border: var(--default-border);
          }
        }

        #character-generator {
          height: 42px;
        }
      `}</style>
      </Box>
    </>
  )
}

export default withTranslation('common')(CharacterGenerator)
