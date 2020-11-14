import React from 'react'
import classnames from 'classnames'
import { Button, Menu, MenuItem } from '@material-ui/core'
import { withTranslation } from '../../i18n'

function DropdownMenu ({ t, items, text, loading, loadingText, ...props }) {
  const [anchorEl, setAnchorEl] = React.useState(null)

  return (
    <>
      <Button
        className={classnames('dropdown-menu-button', { loading })}
        variant="contained"
        color="primary"
        onClick={(event) => setAnchorEl(event.currentTarget)}
      >
        {
          loading
            ? (
              <span>
                { loadingText || t('Loading') }
              </span>
            )
            : text || t('Download GIF')
        }
      </Button>
      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {items.map(({ children, ...item }, i) => {
          return (
            <MenuItem
              {...item}
              onClick={(...args) => {
                setAnchorEl(null)

                if (item.onClick) {
                  item.onClick(...args)
                }
              }}
              key={i}
            >
              { children }
            </MenuItem>
          )
        })}
      </Menu>
      <style jsx>{`
        :global(.dropdown-menu-button.loading) {
          pointer-events: none;
        }
      `}</style>
    </>
  )
}

export default withTranslation('common')(DropdownMenu)
