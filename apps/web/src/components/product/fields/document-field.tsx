"use client";

import MaskedField, { type MaskedFieldProps } from "./masked-field";

import { CNPJ_MASK, CPF_MASK, isValidCnpj, isValidCpf, isValidCpfCnpj, onlyDigits } from "@flyee/fields";

/**
 * BR registry documents with real check-digit validation (not just length):
 * an invalid CPF/CNPJ is flagged inline the moment it is complete, with the
 * caller's translated `invalidMessage`. Persist `onlyDigits(value)`.
 */

type DocumentFieldProps = Omit<MaskedFieldProps, "mask" | "isComplete" | "isValid">;

export function CpfField(props: DocumentFieldProps) {
  return (
    <MaskedField
      {...props}
      mask={CPF_MASK}
      isComplete={(value) => onlyDigits(value).length === 11}
      isValid={isValidCpf}
    />
  );
}

export function CnpjField(props: DocumentFieldProps) {
  return (
    <MaskedField
      {...props}
      mask={CNPJ_MASK}
      isComplete={(value) => onlyDigits(value).length === 14}
      isValid={isValidCnpj}
    />
  );
}

/** Accepts either document — the mask grows into CNPJ past 11 digits. */
export function CpfCnpjField(props: DocumentFieldProps) {
  return (
    <MaskedField
      {...props}
      mask={[CPF_MASK, CNPJ_MASK]}
      isComplete={(value) => [11, 14].includes(onlyDigits(value).length)}
      isValid={isValidCpfCnpj}
    />
  );
}
