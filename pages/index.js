import React from 'react'

import getBackgroundFrames from '../src/util/getBackgroundFrames'
import drawAnimation from '../src/util/drawAnimation'

const animateCanvas = async (canvas, text, elapsed = 0) => {
  const DESIRED_FPS = 30
  const DESIRED_DIFF = 1000 / DESIRED_FPS

  let startTimestamp = null
  let lastTimestamp = null
  const step = async (timestamp) => {
    if (!startTimestamp) {
      startTimestamp = timestamp
    }
    const timestampDiff = timestamp - lastTimestamp
    const elapsed = (timestamp - startTimestamp) / 1000

    drawAnimation(canvas, text, elapsed)

    if (elapsed < 5.5) {
      const nextFrameDelay = Math.max(DESIRED_DIFF - timestampDiff, 0)
      setTimeout(() => {
        requestAnimationFrame(step)
      }, nextFrameDelay)
    }
    lastTimestamp = timestamp
  }

  await getBackgroundFrames()
  requestAnimationFrame(step)
}

export default function Index () {
  React.useEffect(() => {
    const text = 'Nihey was ejected...'
    const previewCanvas = document.getElementById('preview-canvas')
    animateCanvas(previewCanvas, text, 2)
  }, [])

  return (
    <div className="page">
      <canvas id="preview-canvas" className="ejection-preview" width="1920" height="1080"/>
      <style jsx>{`
        .page {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .ejection-preview {
          width: 600px;
          border: 1px solid black;
        }
      `}</style>
    </div>
  )
}
