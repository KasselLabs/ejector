export default async function ffmpeg ({ type = 'worker', onPrintErr, onPrint, onExit, onDone, ...options }) {
  return new Promise((resolve, reject) => {
    if (type === 'worker') {
      const worker = new window.Worker('/ffmpeg-worker-mp4.js')
      worker.onmessage = function (e) {
        const msg = e.data
        switch (msg.type) {
          case 'ready':
            worker.postMessage({
              type: 'run',
              ...options
            })
            break
          case 'stdout':
            if (onPrint) {
              onPrint(msg.data)
            }
            break
          case 'stderr':
            if (onPrintErr) {
              onPrintErr(msg.data)
            }
            break
          case 'exit':
            if (onExit) {
              onExit(msg.data)
            }
            break
          case 'done':
            if (onDone) {
              onDone(msg.data)
            }
            break
        }
      }
    }

    // if (type === 'sync') {
    //   const runFFMPEG = require('ffmpeg.js/ffmpeg-mp4.js')
    //   const result = runFFMPEG({
    //     ...options,
    //     print: (...args) => {
    //       if (onPrint) {
    //         onPrint(...args)
    //       }
    //     },
    //     printErr: (...args) => {
    //       if (onPrintErr) {
    //         onPrintErr(...args)
    //       }
    //     },
    //     onExit: (...args) => {
    //       if (onExit) {
    //         onExit(...args)
    //       }
    //     }
    //   })
    //   onDone(result)
    // }
  })
}
