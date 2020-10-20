export default class Timer {
  constructor () {
    this.reset()
  }

  reset () {
    this.start = new Date()
    this.lastElapsedCall = new Date()
  }

  elapsed () {
    this.lastElapsedCall = new Date()
    return new Date() - this.start
  }

  elapsedDiff () {
    return new Date() - this.lastElapsedCall
  }
}
