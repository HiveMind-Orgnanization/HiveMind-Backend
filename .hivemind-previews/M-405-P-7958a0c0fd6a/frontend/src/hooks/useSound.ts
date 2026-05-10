import { useEffect, useRef } from 'react';

interface UseSoundOptions {
  src: string;
  volume?: number;
}

export function useSound({ src, volume = 0.5 }: UseSoundOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.volume = volume;
    audioRef.current = audio;
    return () => {
      audioRef.current = null;
    };
  }, [src, volume]);

  const play = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // autoplay restrictions; ignore
    });
  };

  return play;
}
