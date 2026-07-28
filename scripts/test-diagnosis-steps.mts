/**
 * Tests for splitting a recommended action into steps.
 *
 * Usage:  npm run test:diagnosis-steps
 *
 * This runs regex over MODEL OUTPUT, where the failure modes are all
 * false-positive splits: a price ("R$99. 2 planos"), a year, a citation "[1,
 * 2]" or a single "1." inside prose must never shatter a paragraph into
 * nonsense. Losing the reader's own words is worse than an ugly paragraph, so
 * every branch here errs toward leaving the text alone.
 */
import process from "node:process";

import { splitActionSteps } from "../apps/web/src/lib/diagnosis/steps";

let failures = 0;
let passes = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passes++;
    return;
  }
  failures++;
  console.log(`FAIL  ${name}\n        expected ${e}\n        actual   ${a}`);
};

// Plain prose stays one block — never invent structure.
check("empty string yields nothing", splitActionSteps(""), []);
check("single sentence stays whole", splitActionSteps("Instale o Pixel na página."), ["Instale o Pixel na página."]);
check(
  "a lone '1.' does not split",
  splitActionSteps("Comece pelo passo 1. Depois avance."),
  ["Comece pelo passo 1. Depois avance."],
);

// The real case from the screenshot.
const real =
  "1. Configuração de Mensuração: Implementar o Meta Pixel e a CAPI na página. " +
  "2. Estrutura da Primeira Campanha: Criar uma campanha com o objetivo de 'Conversões'. " +
  "3. Orçamento Inicial: Definir um orçamento diário.";
check("real enumerated action splits into its steps", splitActionSteps(real).length, 3);
check("the marker is stripped from each step", splitActionSteps(real)[0].startsWith("Configuração"), true);
check("last step keeps its full text", splitActionSteps(real)[2], "Orçamento Inicial: Definir um orçamento diário.");

// A lead-in sentence before "1." must survive as its own step.
const withLead = "Priorize a mensuração antes de tudo. 1. Instale o Pixel. 2. Teste o evento de compra.";
check("lead-in is kept", splitActionSteps(withLead)[0], "Priorize a mensuração antes de tudo.");
check("lead-in plus two steps", splitActionSteps(withLead).length, 3);

// Money, years and citations must not trigger a split.
check(
  "a price does not split",
  splitActionSteps("Defina o preço em R$99. 2 planos ficam disponíveis depois."),
  ["Defina o preço em R$99. 2 planos ficam disponíveis depois."],
);
check(
  "a citation does not split",
  splitActionSteps("Use a deduplicação de eventos [1, 2]. Configure o event_id."),
  ["Use a deduplicação de eventos [1, 2]. Configure o event_id."],
);
// Out-of-order or non-1-based numbering is not a list we understand.
check(
  "non-sequential numbering stays whole",
  splitActionSteps("1. Faça isso. 3. Depois aquilo."),
  ["1. Faça isso. 3. Depois aquilo."],
);
check(
  "numbering not starting at 1 stays whole",
  splitActionSteps("2. Faça isso. 3. Depois aquilo."),
  ["2. Faça isso. 3. Depois aquilo."],
);

// ")" style is common too.
check("paren-style numbering splits", splitActionSteps("1) Instale o Pixel. 2) Teste o evento.").length, 2);

// No words may ever be lost, whatever the shape.
for (const sample of [real, withLead, "Texto simples sem lista.", "1) Um. 2) Dois. 3) Três."]) {
  const joined = splitActionSteps(sample).join(" ");
  const strip = (s: string) => s.replace(/\d{1,2}\s*[.)]\s*/g, "").replace(/\s+/g, " ").trim();
  check(`no text is lost: "${sample.slice(0, 28)}..."`, strip(joined), strip(sample));
}

console.log(
  failures === 0 ? `\nALL PASS — ${passes} assertions.` : `\n${failures} FAILURE(S) out of ${passes + failures}.`,
);
process.exit(failures === 0 ? 0 : 1);
