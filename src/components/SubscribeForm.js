import React from 'react'
import Link from 'next/link'
import axios from 'axios'
import { toast } from 'react-toastify'
import { Box, Button, TextField, CircularProgress } from '@material-ui/core'

import { withTranslation } from '../../i18n'
import track from '../track'

function MapImageBase ({ t, src, href = '', available }) {
  const content = (
    <a className="map-image">
      <img className="image" src={src} height="38"/>
      {!available && <div className="available-soon">{ t('Available Soon!') }</div>}
      <style jsx>{`
      .map-image {
        display: flex;
        justify-content: center;
        margin-bottom: 8px;
        position: relative;
        min-width: 175px;
        margin: 8px;
        cursor: ${available ? 'pointer' : 'unset'};

        > .image {
          opacity: ${available ? 1 : 0.3};
        }

        > .available-soon {
          font-size: 16px;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          white-space: nowrap;
        }
      }
    `}</style>
    </a>
  )

  if (!available) {
    return content
  }

  return (
    <Link href={href}>
      { content }
    </Link>
  )
}

const MapImage = withTranslation('common')(MapImageBase)

function SubscribeForm ({ t }) {
  const [email, setEmail] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  return (
    <form
      className="subscribe-form"
      onSubmit={async (e) => {
        e.preventDefault()

        setLoading(true)
        await axios.request({
          method: 'POST',
          url: 'https://sheet.best/api/sheets/2fb54828-0d8f-404c-8ab5-d3496126f9a7',
          data: {
            email,
            language: navigator.language
          }
        })
        setLoading(false)
        toast.dark(t("Thanks! We'll notify you as soon as it is ready! 🚀"), {
          position: 'top-right',
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true
        })
        track('event', 'subscribe_submit', {
          event_category: 'email'
        })
      }}
    >
      <div className="form-items-container">
        <div className="choose-your-map">
          {t('Choose your map')}
        </div>
        <div className="maps-container">
          <MapImage src="images/skeld.png" href="/" available/>
          <MapImage src="images/mirahq.png" />
          <MapImage src="images/polus.png" />
        </div>
        <Box pb={1} textAlign="center">
          {t('We plan to launch more features, like victory/defeat screen generators, video download and much more!')}
        </Box>
        <Box pb={2} textAlign="center">
          {t('Add your email below if you want to get notified as soon as we do it!')}
        </Box>
        <div className="fields-container">
          <div className="fields-container-items">
            <TextField
              label={t('Your Email')}
              variant="outlined"
              fullWidth
              rows={1}
              value={email}
              type="email"
              onChange={(e) => {
                setEmail(e.target.value)
                track('event', 'subscribe_fill_text', {
                  event_category: 'email'
                })
              }}
              InputLabelProps={{ shrink: true }}
              required
            />
            <Box pt={1}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                disabled={loading}
                type="submit"
              >
                {
                  loading
                    ? (
                      <Box display="inline-flex">
                        {t('Loading')}
                        <Box display="flex" justifyContent="center" alignItems="center" ml={1}>
                          <CircularProgress size={16}/>
                        </Box>
                      </Box>
                    )
                    : t('Notify Me')
                }
              </Button>
            </Box>
          </div>
        </div>
      </div>
      <style jsx>{`
        .subscribe-form {
          position: fixed;
          top: 16px;
          left: 16px;
          border: var(--default-border);
          border-radius: var(--default-border-radius);
          max-width: 280px;

          @media (max-width: 1279px) {
            width: 100%;
            position: unset;
            margin-bottom: 8px;
            max-width: unset;
          }
        }

        .maps-container {
          padding-bottom: 8px;

          @media (max-width: 1279px) {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: space-evenly;
          }
        }

        .fields-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .fields-container-items {
          @media (max-width: 1279px) {
            width: 320px;
          }

          @media (max-width: 380px) {
            width: 100%;
          }
        }

        .form-items-container {
          position: relative;
          padding: 16px;
        }

        .choose-your-map {
          position: absolute;
          padding: 0 8px;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: black;
          font-weight: bold;
          font-size: 1.1em;
          white-space: nowrap;
        }
      `}</style>
    </form>
  )
}

export default withTranslation('common')(SubscribeForm)
