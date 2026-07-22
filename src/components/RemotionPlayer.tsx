"use client";

import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import {
  EjectorComposition,
  COMPOSITION_FPS,
  COMPOSITION_DURATION_IN_FRAMES,
  COMPOSITION_WIDTH,
  COMPOSITION_HEIGHT,
} from "@/remotion/EjectorComposition";
import type { EjectorProps } from "@/types";

/**
 * The Remotion `<Player>` in its own module so `PlayerPreview` can pull it in
 * with `next/dynamic({ ssr: false })` — the player bundle (~1MB raw) then
 * leaves the initial critical path instead of executing in the same render
 * pass as the hero. Everything player-specific (the imperative mute sync)
 * lives here so it only runs once the chunk has actually mounted.
 */
export default function RemotionPlayer({
  props,
  soundOn,
}: {
  props: EjectorProps;
  soundOn: boolean;
}) {
  const playerRef = useRef<PlayerRef>(null);

  // `initiallyMuted` only sets the mount-time state; imperatively (un)mute the
  // player whenever the sound toggle changes so the preview audio follows it.
  useEffect(() => {
    if (soundOn) playerRef.current?.unmute();
    else playerRef.current?.mute();
  }, [soundOn]);

  return (
    <Player
      ref={playerRef}
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
  );
}
