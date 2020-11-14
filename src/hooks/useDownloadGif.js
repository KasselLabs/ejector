
import { useState, useEffect, useCallback } from 'react'

import events, { GIF_GENERATION_LOADING_STEP } from '../events'
import getGIFURLFromAnimation from '../util/getGIFURLFromAnimation'

const downloadURL = (url, filename) => {
  const aElement = document.createElement('a')
  document.body.append(aElement)
  aElement.style = 'display: none'
  aElement.href = url
  aElement.download = `${filename}.gif`
  aElement.click()
  aElement.remove()
}

const useDownloadGif = ({ inprogressAudio, completeAudio, ejectedText, impostorText, characterImages }) => {
  const [loading, setLoading] = useState(false)
  const [loadingPercentage, setLoadingPercentage] = useState(0)

  useEffect(() => {
    const onLoadingStep = (percentage) => {
      setLoadingPercentage(Math.round(percentage * 100))
    }

    events.on(GIF_GENERATION_LOADING_STEP, onLoadingStep)
    return () => {
      events.off(GIF_GENERATION_LOADING_STEP, onLoadingStep)
    }
  }, [])

  const generateGif = useCallback(async () => {
    if (loading) {
      return
    }

    setLoading(true)
    inprogressAudio.current.play()
    const gifURL = await getGIFURLFromAnimation(ejectedText, impostorText, characterImages)
    downloadURL(gifURL, ejectedText.replace(/\s|\n/g, '-'))
    window.URL.revokeObjectURL(gifURL)
    setLoading(false)
    setLoadingPercentage(0)
    completeAudio.current.play()
  }, [inprogressAudio, completeAudio, ejectedText, impostorText, characterImages])

  return {
    loading,
    loadingPercentage,
    generateGif
  }
}

export default useDownloadGif
