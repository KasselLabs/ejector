import Timer from './Timer'
import getBackgroundFrames from './getBackgroundFrames'
import drawAnimation from './drawAnimation'
import getImage from './getImage'
import { ANIMATION_SECONDS, ANIMATION_FRAME_TIME, ANIMATION_SPEEDUP } from '../constants/animation'

export default class CanvasAnimator {
  constructor (canvas, text, characterImageURL) {
    this.canvas = canvas
    this.text = text
    this.stopped = false
    this.characterImageURL = characterImageURL
  }

  async play () {
    const characterImage = await getImage(this.characterImageURL)

    const timer = new Timer()

    const getElapsedSeconds = () => {
      return (timer.elapsed() / 1000) * ANIMATION_SPEEDUP
    }

    const step = async () => {
      if (this.stopped) {
        return
      }

      const shouldResetAnimation = getElapsedSeconds() >= ANIMATION_SECONDS
      if (shouldResetAnimation) {
        timer.reset()
      }

      const elapsed = getElapsedSeconds()
      await drawAnimation(this.canvas, this.text, characterImage, elapsed)

      const elapsedDiff = timer.elapsedDiff() / 1000
      const nextFrameDelay = Math.max(ANIMATION_FRAME_TIME - elapsedDiff, 0)
      setTimeout(() => {
        requestAnimationFrame(step)
      }, nextFrameDelay)
    }

    // Pre-load all background frames
    await getBackgroundFrames()

    requestAnimationFrame(step)
  }

  stop () {
    this.stopped = true
  };
}
