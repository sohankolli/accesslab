// components/Segmented.jsx

/**
 * A segmented control built from native radio buttons, so it is keyboard
 * operable for free (Tab in, arrow keys to choose) and announced as a group.
 * @param {{
 *   legend: string, name: string, value: string, onChange: (value: string) => void,
 *   options: {value: string, label: string, icon?: import('react').ReactNode}[],
 *   iconOnly?: boolean, variant?: 'track'|'ink',
 * }} props  iconOnly keeps the labels for screen readers and as tooltips;
 *   variant 'ink' marks the chosen option in solid ink (the theme switch).
 */
export default function Segmented({
  legend,
  name,
  value,
  onChange,
  options,
  iconOnly = false,
  variant = 'track',
}) {
  return (
    <fieldset className={`segmented segmented--${variant}`}>
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="segmented__option"
          title={iconOnly ? option.label : undefined}
        >
          <input
            type="radio"
            className="sr-only"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className="segmented__face">
            {option.icon}
            <span className={iconOnly ? 'sr-only' : undefined}>{option.label}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
