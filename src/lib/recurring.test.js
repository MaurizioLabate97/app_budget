import { describe, test, expect } from "vitest";
import {
  periodKey,
  occurrenceDate,
  getDueOccurrences,
  nextOccurrence,
  periodsToSkipOnResume,
  periodsToSkipOnRuleChange,
} from "./recurring";

const rent = {
  id: "r1",
  frequency: "monthly",
  start_date: "2026-01-31",
  active: true,
  amount: 650,
  description: "Affitto",
};
const tx = (id, occ) => ({ id: "t" + occ, recurring_id: id, occurrence_date: occ });

describe("periodKey", () => {
  test("mensile e annuale", () => {
    expect(periodKey("monthly", "2026-03-05")).toBe("2026-03");
    expect(periodKey("yearly", "2026-03-05")).toBe("2026");
  });
});

describe("occurrenceDate", () => {
  test("fine mese: 31 → 28/2, 29/2 bisestile, 31/3", () => {
    expect(occurrenceDate(rent, "2026-02")).toBe("2026-02-28");
    expect(occurrenceDate(rent, "2028-02")).toBe("2028-02-29");
    expect(occurrenceDate(rent, "2026-03")).toBe("2026-03-31");
  });

  test("annuale 29/2 in anno non bisestile → 28/2", () => {
    expect(occurrenceDate({ frequency: "yearly", start_date: "2028-02-29" }, "2029")).toBe(
      "2029-02-28"
    );
  });
});

describe("getDueOccurrences", () => {
  test("scadenze fino a oggi incluso, ordinate", () => {
    const due = getDueOccurrences([rent], [], "2026-03-31");
    expect(due.map((d) => d.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(due[0].recurring).toBe(rent);
    expect(due[0].periodKey).toBe("2026-01");
  });

  test("scadenza di oggi non ancora arrivata se oggi è prima del giorno", () => {
    expect(getDueOccurrences([rent], [], "2026-03-30").map((d) => d.periodKey)).toEqual([
      "2026-01",
      "2026-02",
    ]);
  });

  test("confermata o saltata non ricompare", () => {
    const r = { ...rent, skipped_periods: ["2026-02"] };
    expect(
      getDueOccurrences([r], [tx("r1", "2026-01-31")], "2026-03-31").map((d) => d.periodKey)
    ).toEqual(["2026-03"]);
  });

  test("giorno spostato: il mese già confermato resta gestito", () => {
    const moved = { ...rent, start_date: "2026-01-10" };
    expect(getDueOccurrences([moved], [tx("r1", "2026-01-31")], "2026-01-31")).toEqual([]);
  });

  test("sospesa, end_date passata, inizio futuro", () => {
    expect(getDueOccurrences([{ ...rent, active: false }], [], "2026-03-31")).toEqual([]);
    expect(getDueOccurrences([{ ...rent, end_date: "2026-01-31" }], [], "2026-03-31")).toHaveLength(1);
    expect(getDueOccurrences([{ ...rent, start_date: "2026-05-01" }], [], "2026-03-31")).toEqual([]);
  });

  test("movimenti di altre ricorrenze ignorati", () => {
    expect(getDueOccurrences([rent], [tx("altro", "2026-01-31")], "2026-01-31")).toHaveLength(1);
  });

  test("annuale: una scadenza all'anno", () => {
    const prime = { id: "p", frequency: "yearly", start_date: "2025-06-15", active: true };
    expect(getDueOccurrences([prime], [], "2026-11-19").map((d) => d.date)).toEqual([
      "2025-06-15",
      "2026-06-15",
    ]);
  });

  test("più ricorrenze ordinate per data", () => {
    const netflix = { id: "n", frequency: "monthly", start_date: "2026-01-10", active: true };
    expect(getDueOccurrences([rent, netflix], [], "2026-01-31").map((d) => d.recurring.id)).toEqual([
      "n",
      "r1",
    ]);
  });
});

describe("nextOccurrence", () => {
  test("prossima scadenza o null se terminata", () => {
    expect(nextOccurrence(rent, "2026-02-01")).toBe("2026-02-28");
    expect(nextOccurrence(rent, "2026-01-31")).toBe("2026-01-31");
    expect(nextOccurrence({ ...rent, start_date: "2026-05-01" }, "2026-02-01")).toBe("2026-05-01");
    expect(nextOccurrence({ ...rent, end_date: "2026-01-31" }, "2026-02-01")).toBeNull();
  });

  test("salta i periodi già confermati o saltati", () => {
    expect(nextOccurrence(rent, "2026-01-31", [tx("r1", "2026-01-31")])).toBe("2026-02-28");
    expect(
      nextOccurrence({ ...rent, skipped_periods: ["2026-02"] }, "2026-02-01", [])
    ).toBe("2026-03-31");
  });
});

describe("periodsToSkipOnRuleChange", () => {
  test("annuale → mensile: niente valanga di mesi arretrati", () => {
    const prev = { id: "a", frequency: "yearly", start_date: "2024-03-10", active: true };
    const next = { ...prev, frequency: "monthly" };
    const confirmed = [tx("a", "2024-03-10"), tx("a", "2025-03-10"), tx("a", "2026-03-10")];
    const skip = periodsToSkipOnRuleChange(prev, next, confirmed, "2026-11-19");
    const due = getDueOccurrences([{ ...next, skipped_periods: skip }], confirmed, "2026-11-19");
    expect(due.map((d) => d.periodKey)).toEqual(["2026-11"]);
  });

  test("mensile → annuale: gli anni passati non ricompaiono", () => {
    const prev = { id: "m", frequency: "monthly", start_date: "2024-01-05", active: true, skipped_periods: ["2024-02", "2024-03"] };
    const next = { ...prev, frequency: "yearly" };
    const skip = periodsToSkipOnRuleChange(prev, next, [], "2026-11-19");
    expect(skip).toEqual(["2024", "2025"]);
  });

  test("inizio anticipato: salta solo i periodi prima del vecchio inizio", () => {
    const prev = { id: "r", frequency: "monthly", start_date: "2026-01-05", active: true };
    const next = { ...prev, start_date: "2025-06-05" };
    const skip = periodsToSkipOnRuleChange(prev, next, [], "2026-03-10");
    expect(skip).toEqual(["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]);
  });

  test("regola invariata o solo giorno spostato: nessun salto (le arretrate restano)", () => {
    const prev = { id: "r", frequency: "monthly", start_date: "2026-01-05", active: true };
    expect(periodsToSkipOnRuleChange(prev, { ...prev, amount: 9 }, [], "2026-03-10")).toEqual([]);
    expect(periodsToSkipOnRuleChange(prev, { ...prev, start_date: "2026-01-10" }, [], "2026-03-10")).toEqual([]);
  });
});

describe("periodsToSkipOnResume", () => {
  test("esclude il periodo corrente e quelli gestiti", () => {
    const r = { ...rent, active: false };
    expect(periodsToSkipOnResume(r, [tx("r1", "2026-01-31")], "2026-04-15")).toEqual([
      "2026-02",
      "2026-03",
    ]);
  });

  test("il periodo corrente già scaduto non viene saltato", () => {
    const r = { ...rent, start_date: "2026-01-05", active: false };
    expect(periodsToSkipOnResume(r, [], "2026-03-10")).toEqual(["2026-01", "2026-02"]);
  });
});
