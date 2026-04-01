import { h } from 'preact';
import * as state from '../state/configuration';

export function StepNavigator() {
  const total = state.totalSteps.value;
  const current = state.currentStep.value;

  // Build step labels from option groups
  const stepLabels: string[] = [];
  const stepNumbers = [
    ...new Set(state.optionGroups.value.map((g) => g.stepNumber ?? g.sortOrder)),
  ].sort((a, b) => a - b);

  for (const stepNum of stepNumbers) {
    const groups = state.optionGroups.value.filter(
      (g) => (g.stepNumber ?? g.sortOrder) === stepNum
    );
    stepLabels.push(groups.map((g) => g.name).join(' & '));
  }

  return (
    <div class="zc-step-nav">
      {/* Progress bar */}
      <div class="zc-step-nav__progress">
        <div
          class="zc-step-nav__progress-fill"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>

      {/* Step indicators */}
      <div class="zc-step-nav__steps">
        {stepLabels.map((label, index) => (
          <button
            key={index}
            type="button"
            class={`zc-step-nav__step ${
              index === current ? 'zc-step-nav__step--active' : ''
            } ${index < current ? 'zc-step-nav__step--completed' : ''}`}
            onClick={() => state.goToStep(index)}
            aria-current={index === current ? 'step' : undefined}
          >
            <span class="zc-step-nav__step-number">{index + 1}</span>
            <span class="zc-step-nav__step-label">{label}</span>
          </button>
        ))}
      </div>

      {/* Navigation buttons */}
      <div class="zc-step-nav__buttons">
        {!state.isFirstStep.value && (
          <button
            type="button"
            class="zc-btn zc-btn--secondary"
            onClick={state.prevStep}
          >
            Back
          </button>
        )}
        {!state.isLastStep.value && (
          <button
            type="button"
            class="zc-btn zc-btn--primary"
            onClick={state.nextStep}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
