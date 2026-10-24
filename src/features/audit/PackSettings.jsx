// features/audit/PackSettings.jsx
import { listPacks } from '../../engine/rules';
import { useSettings } from '../../context/SettingsContext';

/** Checkboxes that switch rule packs on and off (saved in SettingsContext). */
export default function PackSettings() {
  const { enabledPacks, setPackEnabled } = useSettings();
  return (
    <fieldset className="pack-settings">
      <legend>Rule packs</legend>
      {listPacks().map((pack) => (
        <label key={pack.id} className="pack-settings__option">
          <input
            type="checkbox"
            checked={enabledPacks.includes(pack.id)}
            onChange={(e) => setPackEnabled(pack.id, e.target.checked)}
          />
          <span>{pack.title}</span>{' '}
          <span className="pack-settings__count">
            ({pack.count} {pack.count === 1 ? 'rule' : 'rules'})
          </span>
        </label>
      ))}
    </fieldset>
  );
}
