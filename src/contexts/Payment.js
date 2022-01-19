import React from 'react'
import axios from 'axios'

import useLocalStorage from '../hooks/useLocalStorage'
import track from '../track'

const PaymentContext = React.createContext({})

const isOrderValid = async (orderId) => {
  return true
  if (!orderId) {
    return false
  }

  try {
    const response = await axios.request({
      url: `${process.env.BACKEND_URL}/api/payment/validate/paypal/${orderId}`,
      method: 'POST'
    })
    return response.data.valid
  } catch (e) {
    return false
  }
}

export const PaymentContextProvider = ({ children }) => {
  const [isPaidUser, setIsPaidUser] = React.useState(false)
  const [orderId, setOrderId] = useLocalStorage('order-id', '5XU99813VM0634813')

  React.useEffect(() => {
    const poolForOrder = async () => {
      const isValid = await isOrderValid(orderId)
      if (isValid !== isPaidUser) {
        setIsPaidUser(isValid)
        if (isValid) {
          track('event', 'paid')
        }
      }
    }
    const intervalId = setInterval(poolForOrder, 3000)
    poolForOrder()

    return () => {
      clearInterval(intervalId)
    }
  }, [orderId, isPaidUser])

  return (
    <PaymentContext.Provider
      value={{
        isPaidUser,
        orderId,
        setOrderId,
        isOrderValid
      }}
    >
      { children }
    </PaymentContext.Provider>
  )
}

export const usePaymentContext = () => React.useContext(PaymentContext)

export default PaymentContext
