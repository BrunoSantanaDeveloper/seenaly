"use client";

import MaskedField, { type MaskedFieldProps } from "./masked-field";

import { isValidPhoneBr, onlyDigits, PHONE_BR_MASKS } from "@flyee/fields";

/**
 * Phone input, BR mask by default — (00) 0000-0000 / (00) 00000-0000,
 * switching automatically as the 9th digit arrives. International projects
 * pass their own `mask`/`isValid` (e.g. via libphonenumber-js at the app
 * layer); the field itself stays country-agnostic plumbing.
 *
 * Persist `onlyDigits(value)`, never the masked string.
 */
export default function PhoneField({
  mask = PHONE_BR_MASKS,
  isValid = isValidPhoneBr,
  ...props
}: Omit<MaskedFieldProps, "mask" | "isComplete"> & { mask?: string | string[] }) {
  return (
    <MaskedField
      type="tel"
      autoComplete="tel"
      {...props}
      mask={mask}
      isComplete={(value) => onlyDigits(value).length >= 10}
      isValid={isValid}
    />
  );
}
