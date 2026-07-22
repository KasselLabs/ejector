"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { EjectorProps } from "@/types";

/** Starfield still from the composition, shown while the player chunk loads. */
const POSTER_SRC = "/among-us-background-images/153.png";

/**
 * The preview poster: same 1920x1080 aspect ratio as the player, so the hero
 * area paints something meaningful immediately and the player swaps in without
 * shifting layout.
 */
function PreviewPoster() {
  return (
    <Image
      src={POSTER_SRC}
      alt=""
      width={1920}
      height={1080}
      loading="eager"
      sizes="(max-width: 720px) 100vw, 680px"
      style={{
        width: "100%",
        height: "auto",
        objectFit: "fill",
        display: "block",
      }}
    />
  );
}

// The Remotion player is ~1MB of JS; loading it lazily keeps it off the
// initial critical path. `ssr: false` because it needs the DOM anyway.
const RemotionPlayer = dynamic(() => import("./RemotionPlayer"), {
  ssr: false,
  loading: () => <PreviewPoster />,
});

// Browsers block autoplay with sound until the user has interacted with the
// page, so we attempt to play the ambient track immediately (when the document
// has already been interacted with) and otherwise wait for the first pointer
// gesture. The <audio> is `preload="none"`, so nothing is fetched until an
// actual play attempt happens.
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
    const waitForGesture = () => {
      if (cancelled) return;
      window.addEventListener("pointerdown", onGesture);
    };

    // Without a prior user activation the play() call is guaranteed to be
    // rejected, and attempting it anyway would download background.mp3 before
    // it can possibly be heard — so we go straight to the gesture path.
    const activation = window.navigator.userActivation;
    if (activation && !activation.hasBeenActive) {
      waitForGesture();
    } else {
      void audio.play().catch(waitForGesture);
    }

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
    <div className="overflow-hidden rounded-[10px] border-[3px] border-solid border-white bg-black">
      <RemotionPlayer props={props} soundOn={soundOn} />
      <audio ref={audioRef} loop preload="none" src="/background.mp3" />
    </div>
  );
}
