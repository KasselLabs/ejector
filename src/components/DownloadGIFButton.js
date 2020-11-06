import React from 'react'
import classnames from 'classnames'
import { Button } from '@material-ui/core'

import { withTranslation } from '../../i18n'

function DownloadGIFButton ({ t, generateGif, loading, loadingPercentage, ...props }) {
  return (
    <>
      <Button
        className={classnames('download-gif-button', { loading })}
        variant="contained"
        color="primary"
        onClick={generateGif}
        {...props}
      >
        {
          loading
            ? (
              <span>
                {t('Generating GIF')} ({loadingPercentage}%)
              </span>
            )
            : t('Download GIF')
        }
      </Button>
      <style jsx>{`
        :global(.download-gif-button.loading) {
          pointer-events: none;
          margin-bottom: 1em;
        }
      `}</style>
    </>
  )
}

export default withTranslation('common')(DownloadGIFButton)
