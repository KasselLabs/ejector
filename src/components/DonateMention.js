import React from 'react'
import { Button, Box } from '@material-ui/core'

import { useTranslation } from 'react-i18next'

function DonateMention () {
  const { t } = useTranslation()
  return (
    <div className="donate-mention">
      <Box mb={2} textAlign="center">
        {t('Help us keep producing free web apps like these!')}
        <div className="call-to-action">
          <a
            href={`https://www.paypal.com/donate/?hosted_button_id=${t('R3TX8EDJ889SJ')}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Button variant="contained" color="primary">
              <Box display="flex" alignItems="center">
                {t('Donate with')}&nbsp;&nbsp;<img src="/paypal.png"/>
              </Box>
            </Button>
          </a>
        </div>
      </Box>
      <style jsx>{`
        .donate-mention {
          position: fixed;
          bottom: 16px;
          right: 16px;

          @media (max-width: 1279px) {
            position: unset;
          }
        }

        .call-to-action {
          padding-top: 16px;

          img {
            height: 24px;
          }
        }
      `}</style>
    </div>
  )
}

export default withTranslation('common')(DonateMention)
