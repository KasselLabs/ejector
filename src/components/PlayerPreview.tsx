"use client";

import { useEffect, useRef } from "react";
import { Player } from "@remotion/player";
import {
  EjectorComposition,
  COMPOSITION_FPS,
  COMPOSITION_DURATION_IN_FRAMES,
  COMPOSITION_WIDTH,
  COMPOSITION_HEIGHT,
} from "@/remotion/EjectorComposition";
import type { EjectorProps } from "@/types";

// Browsers block autoplay with sound until the user has interacted with the
// page, so we attempt to play the ambient track immediately and, if that is
// rejected, retry once on the first pointer gesture.
function useAmbientAudio(soundOn: boolean) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!soundOn) {
      audio.pause();
      return;
    }

    // The play() promise may resolve/reject after the effect has been cleaned
    // up (soundOn flipped or unmount); `cancelled` prevents registering a
    // listener at that point, and the listener is always removed on cleanup.
    let cancelled = false;
    const onGesture = () => {
      void audio.play().catch(() => {});
      window.removeEventListener("pointerdown", onGesture);
    };
    void audio.play().catch(() => {
      if (cancelled) return;
      window.addEventListener("pointerdown", onGesture);
    });

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture);
    };
  }, [soundOn]);

  return audioRef;
}

export function PlayerPreview({
  props,
  soundOn,
}: {
  props: EjectorProps;
  soundOn: boolean;
}) {
  const audioRef = useAmbientAudio(soundOn);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/50">
      <Player
        component={EjectorComposition}
        inputProps={props}
        durationInFrames={COMPOSITION_DURATION_IN_FRAMES}
        fps={COMPOSITION_FPS}
        compositionWidth={COMPOSITION_WIDTH}
        compositionHeight={COMPOSITION_HEIGHT}
        loop
        autoPlay
        controls
        initiallyMuted={!soundOn}
        style={{ width: "100%" }}
      />
      <audio ref={audioRef} loop src="/background.mp3" />
    </div>
  );
}
