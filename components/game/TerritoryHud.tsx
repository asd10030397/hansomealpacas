import { MOCK_TERRITORY } from "@/data/game/mock";

/** Compact corner HUD panels — high-contrast, first-viewport readable. */
export function TerritoryHud() {
  return (
    <>
      <aside className="territory-hud territory-hud--cougar" aria-label="Cougar territory stats">
        <header className="territory-hud__head">
          <span className="territory-hud__faction" aria-hidden />
          <h2 className="territory-hud__title">COUGAR TERRITORY</h2>
        </header>
        <ul>
          <li>
            <span>Active (demo)</span>
            <strong>{MOCK_TERRITORY.cougarsActive}</strong>
          </li>
          <li>
            <span>Hunts (demo)</span>
            <strong>{MOCK_TERRITORY.huntsToday}</strong>
          </li>
          <li>
            <span>Hunting Pool</span>
            <strong>{MOCK_TERRITORY.huntPoolLabel}</strong>
          </li>
          <li>
            <span>Pressure (demo)</span>
            <strong>{MOCK_TERRITORY.territoryPressure}</strong>
          </li>
        </ul>
        <p className="territory-hud__mock">Demo stats — not live</p>
      </aside>
      <aside className="territory-hud territory-hud--alpaca" aria-label="Alpaca ranch stats">
        <header className="territory-hud__head">
          <span className="territory-hud__faction" aria-hidden />
          <h2 className="territory-hud__title">ALPACA RANCH</h2>
        </header>
        <ul>
          <li>
            <span>Active (demo)</span>
            <strong>{MOCK_TERRITORY.alpacasActive}</strong>
          </li>
          <li>
            <span>Survivals (demo)</span>
            <strong>{MOCK_TERRITORY.survivalsToday}</strong>
          </li>
          <li>
            <span>Alpaca Pool</span>
            <strong>{MOCK_TERRITORY.alpacaPoolLabel}</strong>
          </li>
          <li>
            <span>Activity (demo)</span>
            <strong>{MOCK_TERRITORY.ranchActivity}</strong>
          </li>
        </ul>
        <p className="territory-hud__mock">Demo stats — not live</p>
      </aside>
    </>
  );
}
