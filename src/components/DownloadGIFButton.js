import React from 'react'
import classnames from 'classnames'

import { Button } from '@material-ui/core'
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

export default function DownloadGIFButton ({ ejectedText, impostorText, image }) {
  const [loading, setLoading] = React.useState(false)
  const [loadingPercentage, setLoadingPercentage] = React.useState(0)

  React.useEffect(() => {
    const onLoadingStep = (percentage) => {
      setLoadingPercentage(Math.round(percentage * 100))
    }

    events.on(GIF_GENERATION_LOADING_STEP, onLoadingStep)
    return () => {
      events.off(GIF_GENERATION_LOADING_STEP, onLoadingStep)
    }
  }, [])

  return (
    <>
      <Button
        className={classnames('download-gif-button', { loading })}
        variant="contained"
        color="primary"
        onClick={async () => {
          if (loading) {
            return
          }

          setLoading(true)
          const gifURL = await getGIFURLFromAnimation(ejectedText, impostorText, image)
          downloadURL(gifURL, ejectedText.replace(/\s|\n/g, '-'))
          window.URL.revokeObjectURL(gifURL)
          setLoading(false)
          setLoadingPercentage(0)
        }}
      >
        {
          loading
            ? (
              <span>
                Generating GIF ({loadingPercentage}%)
              </span>
            )
            : 'Download GIF'
        }
      </Button>
      <style jsx>{`
        :global(.download-gif-button.loading) {
          pointer-events: none;
        }
      `}</style>
    </>
  )
}
