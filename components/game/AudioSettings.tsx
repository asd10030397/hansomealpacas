"use client";

import { useAudioSettings } from "@/hooks/game/useAudioSettings";
import { PixelButton } from "@/components/ui/pixel";

/** Music / SFX toggles — ♪ controls gameplay battle-theme BGM. */
export function AudioSettings() {
  const { prefs, setMusicEnabled, setSfxEnabled } = useAudioSettings();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Audio settings">
      <PixelButton
        size="sm"
        variant={prefs.musicEnabled ? "green" : "ghost"}
        onClick={() => setMusicEnabled(!prefs.musicEnabled)}
        aria-pressed={prefs.musicEnabled}
        title="Music — HANSOME gameplay theme"
      >
        ♪
      </PixelButton>
      <PixelButton
        size="sm"
        variant={prefs.sfxEnabled ? "green" : "ghost"}
        onClick={() => setSfxEnabled(!prefs.sfxEnabled)}
        aria-pressed={prefs.sfxEnabled}
        title="SFX (reserved for future UI sounds)"
      >
        ◫
      </PixelButton>
    </div>
  );
}
