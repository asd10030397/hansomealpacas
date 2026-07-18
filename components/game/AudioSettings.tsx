"use client";

import { useAudioSettings } from "@/hooks/game/useAudioSettings";
import { useGameI18n } from "@/hooks/game/useGameI18n";
import { PixelButton } from "@/components/ui/pixel";

/**
 * Music / SFX toggles (separate channels).
 * - ♪ Music: gameplay BGM (Alpaca Warpath)
 * - ◫ SFX: UI clicks and future game cues
 */
export function AudioSettings() {
  const { t } = useGameI18n();
  const { prefs, setMusicEnabled, setSfxEnabled } = useAudioSettings();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Audio settings">
      <PixelButton
        size="sm"
        variant={prefs.musicEnabled ? "green" : "ghost"}
        onClick={() => setMusicEnabled(!prefs.musicEnabled)}
        aria-pressed={prefs.musicEnabled}
        title={t.common.musicToggleTitle}
      >
        ♪
      </PixelButton>
      <PixelButton
        size="sm"
        variant={prefs.sfxEnabled ? "green" : "ghost"}
        onClick={() => setSfxEnabled(!prefs.sfxEnabled)}
        aria-pressed={prefs.sfxEnabled}
        aria-label={t.common.sfxToggleAria}
        title={t.common.sfxToggleTitle}
      >
        ◫
      </PixelButton>
    </div>
  );
}
