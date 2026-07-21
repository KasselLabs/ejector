// import ffmpeg from './ffmpeg'

export default async function isFFMPEGWorking () {
  return false
  // Disable local ffmpeg as it cannot render large resolution videos depending
  // on the person's device. Rendering the animation on the server will give
  // more consistent results. We can do some more tests with it later.
  //
  // const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  // if (isSafari) {
  //   return false
  // }
  //
  // let isResolved = false
  // return new Promise((resolve) => {
  //   setTimeout(() => {
  //     if (!isResolved) {
  //       isResolved = true
  //       resolve(false)
  //     }
  //   }, 3000)
  //
  //   ffmpeg({
  //     MEMFS: [],
  //     arguments: [
  //       '-version'
  //     ],
  //     onDone: (data) => {
  //       if (!isResolved) {
  //         isResolved = true
  //         resolve(true)
  //       }
  //     }
  //   })
  // })
}
