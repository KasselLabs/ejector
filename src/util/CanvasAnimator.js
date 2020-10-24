import Timer from './Timer'
import getBackgroundFrames from './getBackgroundFrames'
import drawAnimation from './drawAnimation'
import getImage from './getImage'
import { ANIMATION_SECONDS, ANIMATION_FRAME_TIME, ANIMATION_SPEEDUP } from '../constants/animation'

export default class CanvasAnimator {
  constructor (canvas, ejectedText, impostorText, characterImageURL) {
    this.canvas = canvas
    this.ejectedText = ejectedText
    this.impostorText = impostorText
    this.stopped = false
    this.characterImageURL = characterImageURL
  }

  playAudio () {
    window.ejectedAudio.currentTime = 0
    if (window.audioOn) {
      window.ejectedAudio.play()
    }
  }

  async play () {
    this.playAudio()
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
        this.playAudio()
      }

      const elapsed = getElapsedSeconds()
      window.elapsedAnimationTime = elapsed
      await drawAnimation(this.canvas, this.ejectedText, this.impostorText, characterImage, elapsed)

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
