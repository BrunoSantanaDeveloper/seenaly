"use client";

import { forwardRef } from "react";
import { IMaskInput } from "react-imask";

import { TextField, type TextFieldProps } from "@mui/material";

/**
 * Base for the semantic fields (phone, CPF/CNPJ, CEP): a MUI TextField whose
 * input is masked by IMask (proper caret handling while editing mid-string)
 * and, when the value is COMPLETE but invalid, surfaces `invalidMessage` as
 * an inline error — the reassuring as-you-type validation the product-screen
 * skill asks for. An incomplete value is never flagged (don't shout while
 * the user is still typing); required/empty rules stay in the form schema.
 *
 * Formik-compatible: spread `getFieldProps(name)` directly. onChange always
 * receives the MASKED value — strip with `onlyDigits` before persisting.
 */

type MaskDef = { mask: string } | { mask: { mask: string }[] };

const MaskedInput = forwardRef<HTMLInputElement, MaskDef & { onChange: (event: unknown) => void; name: string }>(
  function MaskedInput({ onChange, name, mask, ...rest }, ref) {
    return (
      <IMaskInput
        {...rest}
        mask={mask as never}
        inputRef={ref}
        // IMask owns the input; report changes through the standard event
        // shape so Formik/handlers treat it like any other TextField.
        onAccept={(value: string) => onChange({ target: { name, value } })}
        overwrite={false}
      />
    );
  },
);

export type MaskedFieldProps = TextFieldProps & {
  /** IMask expression(s): "000.000.000-00" or variants chosen by length. */
  mask: string | string[];
  /** True once the value is complete enough to be judged (e.g. 11 digits). */
  isComplete?: (value: string) => boolean;
  /** Validator from @flyee/fields run only on complete values. */
  isValid?: (value: string) => boolean;
  /** Translated message shown when complete-but-invalid (product namespace). */
  invalidMessage?: string;
};

export default function MaskedField({
  mask,
  isComplete,
  isValid,
  invalidMessage,
  error,
  helperText,
  slotProps,
  ...props
}: MaskedFieldProps) {
  const value = String(props.value ?? "");
  const complete = isComplete ? isComplete(value) : value.length > 0;
  const invalid = Boolean(invalidMessage && isValid && complete && !isValid(value));
  const maskDef = Array.isArray(mask) ? mask.map((m) => ({ mask: m })) : mask;

  return (
    <TextField
      {...props}
      error={error || invalid}
      helperText={invalid ? invalidMessage : helperText}
      slotProps={{
        ...slotProps,
        input: {
          ...slotProps?.input,
          inputComponent: MaskedInput as never,
          inputProps: { mask: maskDef },
        },
      }}
    />
  );
}
