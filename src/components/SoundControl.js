import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@material-ui/core'

import { withTranslation } from '../../i18n'

const SoundControl = ({ t }) => {
  const [audioOn, setAudioOn] = useState(false)
  const ambianceAudio = useRef(null)
  const ejectedAudio = useRef(null)

  const onClickButton = useCallback(() => {
    const nexState = !audioOn
    setAudioOn(nexState)
    if (nexState) {
      ambianceAudio.current.play()
      if (window.elapsedAnimationTime) {
        ejectedAudio.current.currentTime = window.elapsedAnimationTime
      }
      ejectedAudio.current.play()
    }
    if (!nexState) {
      ambianceAudio.current.pause()
      ejectedAudio.current.pause()
    }
    window.audioOn = nexState
  }, [audioOn])

  useEffect(() => {
    window.ejectedAudio = ejectedAudio.current
  }, [ejectedAudio])

  const audioImage = audioOn ? '/audio-on.svg' : '/audio-off.svg'
  return (
    <div>
      <audio src="/ambiance.mp3" ref={ambianceAudio} loop/>
      <audio src="/ejected.mp3" ref={ejectedAudio} />
      <Button onClick={onClickButton}>
        <h3 style={{ paddingRight: '5px' }}>{t('Sound')}</h3>
        <img src={audioImage} height="24"/>
      </Button>
    </div>
  )
}

export default withTranslation('common')(SoundControl)
