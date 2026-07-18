"use client";

import { useAudioSettings } from "@/hooks/game/useAudioSettings";
import { PixelButton } from "@/components/ui/pixel";

/** Music / SFX toggles — preferences only; no audio playback yet. */
export function AudioSettings() {
  const { prefs, setMusicEnabled, setSfxEnabled } = useAudioSettings();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Audio settings placeholders">
      <PixelButton
        size="sm"
        variant={prefs.musicEnabled ? "green" : "ghost"}
        onClick={() => setMusicEnabled(!prefs.musicEnabled)}
        aria-pressed={prefs.musicEnabled}
        title="Music toggle (audio not implemented yet)"
      >
        ♪
      </PixelButton>
      <PixelButton
        size="sm"
        variant={prefs.sfxEnabled ? "green" : "ghost"}
        onClick={() => setSfxEnabled(!prefs.sfxEnabled)}
        aria-pressed={prefs.sfxEnabled}
        title="SFX toggle (audio not implemented yet)"
      >
        ◫
      </PixelButton>
    </div>
  );
}
