
import { useState, useEffect, useCallback } from 'react'

import events, { MP4_GENERATION_LOADING_STEP } from '../events'
import getMP4URLFromAnimation from '../util/getMP4URLFromAnimation'

const downloadURL = (url, filename) => {
  const aElement = document.createElement('a')
  document.body.append(aElement)
  aElement.style = 'display: none'
  aElement.href = url
  aElement.download = `${filename}.mp4`
  aElement.click()
  aElement.remove()
}

const useDownloadMp4 = ({ inprogressAudio, completeAudio, ejectedText, impostorText, image }) => {
  const [loading, setLoading] = useState(false)
  const [loadingPercentage, setLoadingPercentage] = useState(0)

  useEffect(() => {
    const onLoadingStep = (percentage) => {
      setLoadingPercentage(Math.round(percentage * 100))
    }

    events.on(MP4_GENERATION_LOADING_STEP, onLoadingStep)
    return () => {
      events.off(MP4_GENERATION_LOADING_STEP, onLoadingStep)
    }
  }, [])

  const generateMp4 = useCallback(async () => {
    if (loading) {
      return
    }

    setLoading(true)
    inprogressAudio.current.play()
    const mp4URL = await getMP4URLFromAnimation(ejectedText, impostorText, image)
    downloadURL(mp4URL, ejectedText.replace(/\s|\n/g, '-'))
    window.URL.revokeObjectURL(mp4URL)
    setLoading(false)
    setLoadingPercentage(0)
    completeAudio.current.play()
  }, [inprogressAudio, completeAudio, ejectedText, impostorText, image])

  return {
    loading,
    loadingPercentage,
    generateMp4
  }
}

export default useDownloadMp4
