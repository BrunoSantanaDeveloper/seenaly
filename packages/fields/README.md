# @flyee/fields

Pure logic for **semantic form fields** — the fields every product form eventually needs and every project used to reimplement (or forget): phone, CPF/CNPJ, CEP/postal code. Zero dependencies, framework-free: web and mobile share these rules; the UI components live in each app.

## What lives here vs in the apps

| Here (`@flyee/fields`) | In the app |
|---|---|
| Check-digit validators (`isValidCpf`, `isValidCnpj`, `isValidCpfCnpj`, `isValidPhoneBr`, `isValidCep`) | MUI field components: `apps/web/src/components/product/fields/*` |
| Formatters (`formatCpf`, `formatCnpj`, `formatPhoneBr`, `formatCep`) + mask expressions (`CPF_MASK`, `PHONE_BR_MASKS`, …) | Labels and error messages (translated by the caller, `product` i18n namespace) |
| `AddressLookupProvider` interface + `viaCep` BR provider | Which provider a form uses (prop-injectable) |

## Rules

- **Persist digits, never masks**: run `onlyDigits(value)` before writing to the DB. Masks are presentation.
- **Lookup never blocks the form**: `AddressLookupProvider.lookup` resolves `null` on ANY failure (invalid code, network, provider down) and never throws — the user always can type the address manually. Same graceful-degradation contract as `@flyee/email` / `sendEvent`.
- **Yup integration** (the template's form stack) — the package stays dependency-free; wire validators with `.test`:

```ts
import { isValidCpf, isValidPhoneBr } from "@flyee/fields";

const schema = Yup.object({
  cpf: Yup.string().test("cpf", t("fields.invalidCpf"), (v) => !v || isValidCpf(v)),
  phone: Yup.string().test("phone", t("fields.invalidPhone"), (v) => !v || isValidPhoneBr(v)),
});
```

## Locale scope

BR documents (CPF/CNPJ/CEP + ViaCEP) ship because Brazil-first is the common case for derived projects; everything is opt-in per form. International projects: use the generic mask/`AddressLookupProvider` seams — a phone lib like `libphonenumber-js` or a country-specific postal provider plugs in at the app layer without touching this package.

## Web components (already wired)

`apps/web/src/components/product/fields/` ships `PhoneField`, `CpfField`, `CnpjField`, `CpfCnpjField`, `CepField` (with debounced auto-fill via `viaCep`, injectable) and `CurrencyField` — all MUI `TextField`-compatible (Formik `getFieldProps` works directly). The `product-screen` skill mandates them for semantic data; `product-lint` advises when a raw `TextField` is named like one.

Mobile: consume the validators/formatters from this package directly; RN Paper input components are a planned follow-up.
