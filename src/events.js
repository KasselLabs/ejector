import EventEmitter from 'event-emitter'

const events = new EventEmitter()

export const GIF_GENERATION_LOADING_STEP = 'gif-generation-loading-step'
export const FRAME_LOADING_STEP = 'frame-loading-step'

export default events
