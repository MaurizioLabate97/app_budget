import { describe, it, expect } from "vitest";
import { buildSqlWhere, indexedColumns } from "./sqlWhere";

describe("buildSqlWhere", () => {
  it("query vuota: nessuna condizione", () => {
    expect(buildSqlWhere({})).toEqual({ where: "", params: [] });
    expect(buildSqlWhere(undefined)).toEqual({ where: "", params: [] });
  });

  it("intervallo di date del mese", () => {
    expect(buildSqlWhere({ date: { $gte: "2026-11-01", $lt: "2026-12-01" } })).toEqual({
      where: "WHERE date >= ? AND date < ?",
      params: ["2026-11-01", "2026-12-01"],
    });
  });

  it("tutti gli operatori di confronto sulla data e l'uguaglianza", () => {
    expect(buildSqlWhere({ date: { $gt: "a", $lte: "b" } }).where).toBe("WHERE date > ? AND date <= ?");
    expect(buildSqlWhere({ date: "2026-11-24" })).toEqual({
      where: "WHERE date = ?",
      params: ["2026-11-24"],
    });
  });

  it("tipo e categoria", () => {
    expect(buildSqlWhere({ type: "expense", category_id: "c1" })).toEqual({
      where: "WHERE type = ? AND category_id = ?",
      params: ["expense", "c1"],
    });
  });

  it("categoria con $in", () => {
    expect(buildSqlWhere({ category_id: { $in: ["a", "b"] } })).toEqual({
      where: "WHERE category_id IN (?, ?)",
      params: ["a", "b"],
    });
    expect(buildSqlWhere({ category_id: { $in: [] } }).where).toBe("WHERE 1 = 0");
  });

  it("lascia al filtro JS tutto il resto", () => {
    expect(
      buildSqlWhere({
        $or: [{ merchant_name: { $regex: "x" } }],
        source: "recurring",
        is_categorized: true,
        type: { $ne: "income" },
        category_id: { $in: ["a", 3] },
        date: { $gte: 5, $regex: "x" },
      })
    ).toEqual({ where: "", params: [] });
  });

  it("un operatore non supportato sulla data non toglie gli altri", () => {
    expect(buildSqlWhere({ date: { $gte: "2026-01-01", $ne: "2026-02-02" } })).toEqual({
      where: "WHERE date >= ?",
      params: ["2026-01-01"],
    });
  });
});

describe("indexedColumns", () => {
  it("ricava le colonne di una transazione", () => {
    expect(indexedColumns({ date: "2026-11-24", type: "expense", category_id: "c", x: 1 })).toEqual([
      "2026-11-24",
      "expense",
      "c",
    ]);
  });

  it("valori mancanti o non testuali diventano null", () => {
    expect(indexedColumns({ date: 5 })).toEqual([null, null, null]);
  });
});
