// Mobile checkout steps travel in a validated search param, so back, forward
// and refresh work; an unknown value falls back to the first step.
export type CheckoutStep = "dados" | "carteira" | "revisao";
export const checkoutSteps: CheckoutStep[] = ["dados", "carteira", "revisao"];
export const checkoutSearch = (input: Record<string, unknown>) => ({
  step: checkoutSteps.includes(input.step as CheckoutStep)
    ? (input.step as CheckoutStep)
    : ("dados" as CheckoutStep),
});
