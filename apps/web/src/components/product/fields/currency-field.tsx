"use client";

import { useLocale } from "next-intl";
import { forwardRef } from "react";
import { NumericFormat } from "react-number-format";

import { TextField, type TextFieldProps } from "@mui/material";

/**
 * Locale-aware money input: separators derive from the ACTIVE locale via
 * Intl (pt-BR → 1.234,56; en → 1,234.56), so the same form is correct in
 * every language the product ships. The numeric value (not the formatted
 * string) is reported through onChange — persist that.
 */

function localeSeparators(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    thousand: parts.find((p) => p.type === "group")?.value ?? ",",
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

/** Locale-aware separators for forms that compose NumericMaskInput directly. */
export function useCurrencySeparators() {
  return localeSeparators(useLocale());
}

/**
 * Masked numeric input for MUI's `inputComponent` slot — usable inside the
 * house FormControl+FormLabel+Input pattern as well as CurrencyField below.
 * Reports the plain numeric STRING through onChange (Formik-safe: no
 * type="number" float parsing), never the formatted text.
 */
export const NumericMaskInput = forwardRef<
  HTMLInputElement,
  {
    onChange: (event: { target: { name: string; value: string } }) => void;
    name: string;
    thousand: string;
    decimal: string;
    /** 2 for money/percent (default), 0 for integer counts. */
    decimalScale?: number;
  }
>(function NumericMaskInput({ onChange, name, thousand, decimal, decimalScale = 2, ...rest }, ref) {
  return (
    <NumericFormat
      {...rest}
      name={name}
      getInputRef={ref}
      thousandSeparator={thousand}
      decimalSeparator={decimal}
      decimalScale={decimalScale}
      allowNegative={false}
      valueIsNumericString
      onValueChange={(values) => onChange({ target: { name, value: values.value } })}
    />
  );
});

const NumericInput = NumericMaskInput;

export default function CurrencyField({
  currencySymbol,
  slotProps,
  ...props
}: TextFieldProps & {
  /** Adornment shown before the amount (e.g. "R$", "$", "€"). */
  currencySymbol?: string;
}) {
  const locale = useLocale();
  const { thousand, decimal } = localeSeparators(locale);

  return (
    <TextField
      {...props}
      slotProps={{
        ...slotProps,
        input: {
          startAdornment: currencySymbol,
          ...slotProps?.input,
          inputComponent: NumericInput as never,
          inputProps: { thousand, decimal, inputMode: "decimal" },
        },
      }}
    />
  );
}
