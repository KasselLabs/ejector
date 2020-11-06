import React from 'react'
import classnames from 'classnames'
import { Button } from '@material-ui/core'

import { withTranslation } from '../../i18n'

function DownloadMP4Button ({ t, generateMp4, loading, loadingPercentage, ...props }) {
  return (
    <>
      <Button
        className={classnames('download-mp4-button', { loading })}
        variant="contained"
        color="primary"
        onClick={generateMp4}
      >
        {
          loading
            ? (
              <span>
                {t('Generating MP4 Video')} ({loadingPercentage}%)
              </span>
            )
            : t('Download MP4 Video')
        }
      </Button>
      <style jsx>{`
        :global(.download-mp4-button.loading) {
          margin-bottom: 1em;
        }
      `}</style>
    </>
  )
}

export default withTranslation('common')(DownloadMP4Button)
