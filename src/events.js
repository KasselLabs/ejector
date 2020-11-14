import EventEmitter from 'event-emitter'

const events = new EventEmitter()

export const FILE_GENERATION_LOADING_STEP = 'file-generation-loading-step'
export const FRAME_LOADING_STEP = 'frame-loading-step'

export default events
