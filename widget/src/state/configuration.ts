import { signal, computed } from 'preact/signals';
import type {
  OptionGroupData,
  EvaluationResult,
  PricingData,
  MediaData,
  SummaryData,
  AvailableOptionData,
} from '../api/client';

// ──── Core State ────

export const sessionId = signal<string | null>(null);
export const productFamilyName = signal('');
export const optionGroups = signal<OptionGroupData[]>([]);
export const selections = signal<Record<string, string>>({});
export const availableOptions = signal<Record<string, AvailableOptionData[]>>({});
export const pricing = signal<PricingData | null>(null);
export const media = signal<MediaData | null>(null);
export const summary = signal<SummaryData | null>(null);
export const errors = signal<Array<{ type: string; optionGroupSlug: string; message: string }>>([]);
export const isValid = signal(false);

// ──── UI State ────

export const currentStep = signal(0);
export const isLoading = signal(true);
export const isValidating = signal(false);
export const isAddingToCart = signal(false);
export const cartError = signal<string | null>(null);
export const cartSuccess = signal(false);
export const initError = signal<string | null>(null);

// ──── Computed ────

export const totalSteps = computed(() => {
  const steps = new Set(optionGroups.value.map((g) => g.stepNumber ?? g.sortOrder));
  return steps.size || 1;
});

export const currentStepGroups = computed(() => {
  const step = currentStep.value;
  const groups = optionGroups.value;

  // Group by stepNumber
  const stepNumbers = [...new Set(groups.map((g) => g.stepNumber ?? g.sortOrder))].sort((a, b) => a - b);
  const targetStep = stepNumbers[step];

  return groups.filter((g) => (g.stepNumber ?? g.sortOrder) === targetStep);
});

export const isFirstStep = computed(() => currentStep.value === 0);
export const isLastStep = computed(() => currentStep.value >= totalSteps.value - 1);

export const formattedPrice = computed(() => {
  if (!pricing.value) return '';
  return `$${pricing.value.totalPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
});

export const formattedCompareAtPrice = computed(() => {
  if (!pricing.value?.compareAtPrice) return null;
  return `$${pricing.value.compareAtPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
});

// ──── Actions ────

export function setSelection(groupSlug: string, valueSlug: string) {
  selections.value = { ...selections.value, [groupSlug]: valueSlug };
}

export function goToStep(step: number) {
  if (step >= 0 && step < totalSteps.value) {
    currentStep.value = step;
  }
}

export function nextStep() {
  goToStep(currentStep.value + 1);
}

export function prevStep() {
  goToStep(currentStep.value - 1);
}

export function resetCart() {
  cartError.value = null;
  cartSuccess.value = false;
  isAddingToCart.value = false;
}
