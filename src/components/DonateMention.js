import React from 'react'
import { Box } from '@material-ui/core'

import { withTranslation } from '../../i18n'

function DonateMention ({ t }) {
  return (
    <Box mb={2} textAlign="center">
      {t('Help us keep producing free web apps like these!')}
      <div>
        <a
          href={`https://www.paypal.com/donate/?hosted_button_id=${t('R3TX8EDJ889SJ')}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('Click here to donate')}.
        </a>
        {' '}
        {t('Every penny counts!')}
      </div>
    </Box>
  )
}

export default withTranslation('common')(DonateMention)
