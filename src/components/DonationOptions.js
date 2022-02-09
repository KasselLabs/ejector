import React, { useMemo, useState } from 'react'
import { Box } from '@material-ui/core'
import { PayPalButton } from 'react-paypal-button-v2'
import classnames from 'classnames'

import track from '../track'
import { usePaymentContext } from '../contexts/Payment'

const DonationOption = ({
  t,
  selected,
  title,
  price,
  items,
  onClick
}) => {
  return (
    <button
      className={classnames('donation-option', { '-selected': selected })}
      onClick={onClick}
    >
      <span className="title">{ title }</span>
      {items.map((item) => {
        return <span className="item" key={item}>{ item }</span>
      })}
      <span className="price">
        {t('Available for')} <b>{ price }</b>
      </span>
      <style jsx>
        {`
        .donation-option {
          display: flex;
          border-radius: 4px;
          flex-direction: column;
          align-items: center;
          border: 1px solid white;
          padding: 0.5em;
          width: 100%;
          cursor: pointer;
          background: transparent;
          color: white;
          transition: background 0.1s ease, box-shadow 0.3s ease;
          outline: none;

          &.-selected {
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 0 10px white;
          }

          .title {
            font-size: 1.2em;
            font-weight: bold;
            margin-bottom: 0.3em;
          }

          .item {
            font-size: 0.95em;
          }

          .price {
            margin-top: 0.5em;
            font-size: 1.1em;
          }

          :first-child {
            margin-right: 0.4em;
          }

          :last-child {
            margin-left: 0.4em;
          }
        }
        `}
      </style>
    </button>
  )
}

export default function DonationOptions ({ t, setLoading }) {
  const { setOrderId } = usePaymentContext()

  const donationOptions = useMemo(() => [
    {
      title: t('HD Video'),
      price: t('hd-price'),
      priceAmount: t('hd-price-amount'),
      priceCurrency: t('price-currency'),
      items: [
        '1280 x 720',
        t('MP4 File'),
        t('Includes Watermark')
      ]
    },
    {
      title: t('Full HD Video'),
      price: t('full-hd-price'),
      priceAmount: t('full-hd-price-amount'),
      priceCurrency: t('price-currency'),
      items: [
        '1920 x 1080',
        t('MP4 File'),
        t('No Watermark')
      ]
    }
  ], [t])

  const [selectedOption, setSelectedOption] = useState(donationOptions[1])
  return (
    <>
      <Box display="flex" width="100%" px={2} mb={2}>
        {donationOptions.map(option => (
          <DonationOption
            t={t}
            key={option.title}
            selected={option.title === selectedOption.title}
            onClick={() => setSelectedOption(option)}
            {...option}
          />
        ))}
      </Box>
      <div className="paypal-button">
        <PayPalButton
          key={selectedOption.title}
          amount={selectedOption.priceAmount}
          currency={selectedOption.priceCurrency}
          shippingPreference="NO_SHIPPING"
          onClick={() => {
            setLoading(true)
            track('event', 'paypal_button_click')
          }}
          onCancel={() => {
            setLoading(false)
          }}
          onError={() => {
            setLoading(false)
          }}
          onSuccess={(details, data) => {
            setLoading(true)
            setOrderId(data.orderID)
          }}
          style={{
            layout: 'horizontal',
            color: 'white',
            shape: 'rect',
            label: 'paypal',
            height: 40
          }}
          options={{
            clientId: process.env.PAYPAL_ID,
            currency: selectedOption.priceCurrency
          }}
        />
      </div>
      <style jsx>{`
        :global(.paypal-button) {
          height: 40px;
          overflow: hidden;
        }
      `}</style>
    </>
  )
}
