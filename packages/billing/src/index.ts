import { AsaasProvider } from "./providers/asaas";
import { StripeProvider } from "./providers/stripe";
import type { BillingProviderName, PaymentProvider } from "./types";

export * from "./types";
export * from "./credits";

export const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
export const isAsaasConfigured = Boolean(process.env.ASAAS_API_KEY);

/** Providers available in this deployment, in display order. */
export function configuredProviders(): BillingProviderName[] {
  const providers: BillingProviderName[] = [];
  if (isStripeConfigured) providers.push("stripe");
  if (isAsaasConfigured) providers.push("asaas");
  return providers;
}

export function getProvider(name: BillingProviderName): PaymentProvider {
  switch (name) {
    case "stripe":
      return new StripeProvider();
    case "asaas":
      return new AsaasProvider();
  }
}
