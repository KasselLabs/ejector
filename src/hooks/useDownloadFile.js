import { useState, useEffect, useCallback } from 'react'

import { usePaymentContext } from '../contexts/Payment'
import events, { FILE_GENERATION_LOADING_STEP } from '../events'
import getGIFURLFromAnimation from '../util/getGIFURLFromAnimation'
import getMP4URLFromAnimation from '../util/getMP4URLFromAnimation'

const downloadURL = (url, filename, extension) => {
  const aElement = document.createElement('a')
  document.body.append(aElement)
  aElement.style = 'display: none'
  aElement.href = url
  aElement.download = `${filename}.${extension}`
  aElement.click()
  aElement.remove()
}

const getFileURLFromAnimation = (extension, ...args) => {
  if (extension === 'gif') {
    return getGIFURLFromAnimation(...args)
  }

  if (extension === 'mp4') {
    return getMP4URLFromAnimation(...args)
  }

  throw new Error('No exporter for this extension')
}

const useDownloadFile = ({ inprogressAudio, completeAudio, ejectedText, impostorText, characterImages }) => {
  const { orderId } = usePaymentContext()
  const [loading, setLoading] = useState(false)
  const [loadingPercentage, setLoadingPercentage] = useState(0)

  useEffect(() => {
    const onLoadingStep = (percentage) => {
      setLoadingPercentage(Math.round(percentage * 100))
    }

    events.on(FILE_GENERATION_LOADING_STEP, onLoadingStep)
    return () => {
      events.off(FILE_GENERATION_LOADING_STEP, onLoadingStep)
    }
  }, [])

  const generateFile = useCallback(async (extension) => {
    if (loading) {
      return
    }

    setLoading(true)
    inprogressAudio.current.play()
    const fileURL = await getFileURLFromAnimation(extension, ejectedText, impostorText, characterImages)
    downloadURL(fileURL, ejectedText.replace(/\s|\n/g, '-'), extension, orderId)
    window.URL.revokeObjectURL(fileURL)
    setLoading(false)
    setLoadingPercentage(0)
    completeAudio.current.play()
  }, [inprogressAudio, completeAudio, ejectedText, impostorText, characterImages, orderId])

  return {
    loading,
    loadingPercentage,
    generateFile
  }
}

export default useDownloadFile
