import { listPacks } from '../../engine/rules';
import { useSettings } from '../../context/SettingsContext';

/** "Check against": checkboxes that switch rule packs on and off (saved in SettingsContext). */
export default function PackSettings() {
  const { enabledPacks, setPackEnabled } = useSettings();
  return (
    <fieldset className="packs">
      <legend className="packs__legend">Check against</legend>
      {listPacks().map((pack) => (
        <label
          key={pack.id}
          className="packs__option"
          title={`${pack.count} ${pack.count === 1 ? 'rule' : 'rules'}`}
        >
          <input
            type="checkbox"
            checked={enabledPacks.includes(pack.id)}
            onChange={(e) => setPackEnabled(pack.id, e.target.checked)}
          />
          {pack.title}
        </label>
      ))}
    </fieldset>
  );
}
