import test from "node:test";
import assert from "node:assert/strict";
import { sortByStatusOrder } from "../src/lib/status-order.ts";

const ids = (rows) => rows.map((r) => r.status_id);

test("бүртгэлийн (sort_order) дарааллаар — id-аар биш", () => {
  const breakdown = [{ status_id: 101 }, { status_id: 102 }, { status_id: 110 }];
  const statuses = [{ id: 110 }, { id: 101 }, { id: 102 }];
  assert.deepEqual(ids(sortByStatusOrder(breakdown, statuses)), [110, 101, 102]);
});

test("бүртгэлд байхгүй төлөв сүүлд, id-аараа", () => {
  const breakdown = [{ status_id: 999 }, { status_id: 5 }, { status_id: 102 }, { status_id: 101 }];
  const statuses = [{ id: 102 }, { id: 101 }];
  assert.deepEqual(ids(sortByStatusOrder(breakdown, statuses)), [102, 101, 5, 999]);
});

test("бүртгэл хоосон бол id-аар; эх массив өөрчлөгдөхгүй", () => {
  const breakdown = [{ status_id: 3 }, { status_id: 1 }, { status_id: 2 }];
  assert.deepEqual(ids(sortByStatusOrder(breakdown, [])), [1, 2, 3]);
  assert.deepEqual(ids(breakdown), [3, 1, 2]);
});
