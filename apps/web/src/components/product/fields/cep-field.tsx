"use client";

import MaskedField, { type MaskedFieldProps } from "./masked-field";
import { useEffect, useRef, useState } from "react";

import { CircularProgress, InputAdornment } from "@mui/material";

import {
  type AddressLookupProvider,
  CEP_MASK,
  isValidCep,
  onlyDigits,
  type PostalAddress,
  viaCep,
} from "@flyee/fields";

/**
 * CEP with auto-fill: once 8 digits are in, the address is looked up
 * (debounced, spinner in the adornment) and handed to `onAddressFound` so the
 * form can pre-fill street/district/city/state — which MUST stay editable
 * (auto-fill is a head start, not a lock). Lookup failure is silent by
 * contract (`AddressLookupProvider` resolves null, never throws): the user
 * simply types the address manually — the form is never blocked.
 *
 * Provider defaults to ViaCEP (BR); inject any `AddressLookupProvider` for
 * other markets. Persist `onlyDigits(value)`.
 */
export default function CepField({
  onAddressFound,
  provider = viaCep,
  debounceMs = 400,
  slotProps,
  ...props
}: Omit<MaskedFieldProps, "mask" | "isComplete" | "isValid"> & {
  /** Receives the found address to pre-fill the sibling fields. */
  onAddressFound?: (address: PostalAddress) => void;
  provider?: AddressLookupProvider;
  debounceMs?: number;
}) {
  const [looking, setLooking] = useState(false);
  const value = String(props.value ?? "");
  const cep = onlyDigits(value);
  const lastLookedUp = useRef<string | null>(null);
  const callbackRef = useRef(onAddressFound);
  callbackRef.current = onAddressFound;
  const providerRef = useRef(provider);
  providerRef.current = provider;

  useEffect(() => {
    if (!callbackRef.current || cep.length !== 8 || cep === lastLookedUp.current) return;
    const timer = setTimeout(async () => {
      lastLookedUp.current = cep;
      setLooking(true);
      const address = await providerRef.current.lookup(cep);
      setLooking(false);
      // The field may have changed while the lookup was in flight — a stale
      // result must not overwrite what the user is typing now.
      if (address && lastLookedUp.current === cep) callbackRef.current?.(address);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [cep, debounceMs]);

  return (
    <MaskedField
      autoComplete="postal-code"
      {...props}
      mask={CEP_MASK}
      isComplete={(v) => onlyDigits(v).length === 8}
      isValid={isValidCep}
      slotProps={{
        ...slotProps,
        input: {
          ...slotProps?.input,
          endAdornment: looking ? (
            <InputAdornment position="end">
              <CircularProgress size={16} />
            </InputAdornment>
          ) : (
            (slotProps?.input as { endAdornment?: React.ReactNode } | undefined)?.endAdornment
          ),
        },
      }}
    />
  );
}
