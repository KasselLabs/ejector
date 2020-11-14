import React from 'react'

const PaymentContext = React.createContext({})

export const PaymentContextProvider = ({ children }) => {
  const [isPaidUser, setIsPaidUser] = React.useState(false)

  React.useEffect(() => {
    setIsPaidUser(false)
  }, [])

  return (
    <PaymentContext.Provider
      value={{
        isPaidUser
      }}
    >
      { children }
    </PaymentContext.Provider>
  )
}

export const usePaymentContext = () => React.useContext(PaymentContext)

export default PaymentContext
