import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router';
import { modelSwitched, selectModelOn } from './clickablesSlice';

/** Status line under the switch: what the model is doing, in plain words. */
function statusText(c, on) {
  if (c.status === 'unavailable') return `Model suggestions are unavailable. ${c.message ?? ''}`;
  if (!c.model) return 'Loading the model details…';
  if (!on) {
    return c.model.defaultOn
      ? 'Off. Switch on for suggestions from a trained model.'
      : 'Off by default: the model has not passed every quality check yet.';
  }
  if (c.status === 'loading') return 'Loading the model…';
  if (c.status === 'checking') return 'Looking for click-only controls…';
  if (c.timing) {
    const t = c.timing;
    return `Checked ${t.elements.toLocaleString()} ${t.elements === 1 ? 'element' : 'elements'} in ${Math.round(t.modelMs)} ms. Suggestions never change the score.`;
  }
  return 'Suggestions never change the score.';
}

/** "Suggestions from the model": sits with the rule packs, saved in this browser. */
export default function ModelSwitch() {
  const dispatch = useDispatch();
  const c = useSelector((s) => s.clickables);
  const on = useSelector(selectModelOn);
  const unavailable = c.status === 'unavailable';
  return (
    <div className="model-switch">
      <label className="packs__option">
        <input
          type="checkbox"
          checked={on}
          disabled={unavailable || !c.model}
          aria-describedby="model-switch-status"
          onChange={(e) => dispatch(modelSwitched(e.target.checked))}
        />
        Suggestions from the model
      </label>
      <p
        id="model-switch-status"
        className="model-switch__status"
        aria-live="polite"
        data-checks={c.checks}
      >
        {statusText(c, on)} <Link to="/learn/model-card">About the model</Link>
      </p>
    </div>
  );
}
