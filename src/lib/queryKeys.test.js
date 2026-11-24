import { describe, it, expect } from "vitest";
import { entityKey, filterKey, aggregateKey, keysToInvalidate } from "./queryKeys";

describe("chiavi delle query", () => {
  it("le chiavi di filter e aggregate partono dalla chiave dell'entità", () => {
    expect(filterKey("Transaction", { type: "expense" }, { limit: 5 })).toEqual([
      "entity",
      "Transaction",
      "filter",
      { type: "expense" },
      { limit: 5 },
    ]);
    expect(aggregateKey("Transaction", { groupBy: "type" }).slice(0, 2)).toEqual(entityKey("Transaction"));
  });
});

describe("keysToInvalidate", () => {
  it("una scrittura invalida solo la sua entità", () => {
    expect(keysToInvalidate({ entityName: "Budget", action: "update" })).toEqual([["entity", "Budget"]]);
  });

  it("più entità toccate insieme (eliminazione a cascata)", () => {
    expect(keysToInvalidate({ entityNames: ["Category", "Transaction"], action: "delete" })).toEqual([
      ["entity", "Category"],
      ["entity", "Transaction"],
    ]);
  });

  it("un restore, o un cambio senza entità, invalida tutto", () => {
    expect(keysToInvalidate({ action: "import" })).toEqual([["entity"]]);
    expect(keysToInvalidate({})).toEqual([["entity"]]);
    expect(keysToInvalidate(undefined)).toEqual([["entity"]]);
  });
});
