import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Typography, Box, CircularProgress } from '@material-ui/core'
import axios from 'axios'
import { useTranslation } from 'react-i18next'

import Head from '../src/components/Head'

function UnsubscribePage () {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const email = router.query.email
  console.log(email)

  useEffect(() => {
    axios.request({
      method: 'POST',
      url: `${process.env.BACKEND_URL}/user`,
      data: {
        email,
        language: navigator.language,
        isSubscribed: false
      }
    }).then(() => setLoading(false))
  }, [email])

  return (
    <Box display="flex" width="100%" p={2} justifyContent="center">
      <Head title={t('Ejector - Unsubscribe')}/>
      {
        loading
          ? <CircularProgress size={89}/>
          : (
            <Box display="flex" alignItems="center" flexDirection="column">
              <Typography align="center" variant="h5">
                { t('You have successfully unsubscribed to our mailing list') }
              </Typography>
              <img className="see-you-again-image" src={`/images/${t('see-you-again-image')}`}/>
            </Box>
          )
      }
      <style jsx>{`
        .see-you-again-image {
          max-width: calc(100% - 16px);
        }
      `}</style>
    </Box>
  )
}

export default UnsubscribePage
