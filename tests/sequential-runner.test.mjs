// Дараалсан дуудалтын гогцоо — ГУС-аас нэгж талбарын мэдээллийг бөөнөөр татахад
// хэрэглэгддэг. Шалгах зүйлс: дараалал, хүсэлт ХООРОНД delay (сүүлийнхийн дараа
// БИШ), нэг унасан ч үргэлжлэх, зогсоох, прогрессын тоо.

import { test } from "node:test";
import assert from "node:assert/strict";

import { runSequentialWithDelay } from "../src/lib/sequential-runner.ts";

// Хуурамч sleep — бодит хугацаа хүлээхгүй, зөвхөн дуудалтуудыг тэмдэглэнэ.
function fakeSleep() {
  const calls = [];
  return { calls, sleep: async (ms) => void calls.push(ms) };
}

test("дараалан ажиллаж, хүсэлт хооронд л delay тавина", async () => {
  const { calls, sleep } = fakeSleep();
  const order = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const outcome = await runSequentialWithDelay(
    ["a", "b", "c"],
    async (item) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      order.push(item);
      inFlight -= 1;
    },
    { delayMs: 1000, sleep },
  );

  assert.deepEqual(order, ["a", "b", "c"], "дараалал хадгалагдана");
  assert.equal(maxInFlight, 1, "зэрэг нэгээс их хүсэлт явуулахгүй");
  // 3 элемент → 2 delay (сүүлийн хүсэлтийн дараа хүлээхгүй)
  assert.deepEqual(calls, [1000, 1000]);
  assert.deepEqual(outcome, { total: 3, ok: 3, failed: [], stopped: false });
});

test("нэг элемент байхад delay огт тавихгүй", async () => {
  const { calls, sleep } = fakeSleep();
  const outcome = await runSequentialWithDelay(["a"], async () => {}, { delayMs: 1000, sleep });
  assert.deepEqual(calls, []);
  assert.equal(outcome.ok, 1);
});

test("хоосон жагсаалт — task ч, delay ч дуудагдахгүй", async () => {
  const { calls, sleep } = fakeSleep();
  let taskCalls = 0;
  const outcome = await runSequentialWithDelay([], async () => void (taskCalls += 1), {
    delayMs: 1000,
    sleep,
  });
  assert.equal(taskCalls, 0);
  assert.deepEqual(calls, []);
  assert.deepEqual(outcome, { total: 0, ok: 0, failed: [], stopped: false });
});

test("нэг элемент унасан ч бусад нь үргэлжилнэ", async () => {
  const { calls, sleep } = fakeSleep();
  const done = [];

  const outcome = await runSequentialWithDelay(
    ["a", "bad", "c", "bad2"],
    async (item) => {
      if (item.startsWith("bad")) throw new Error(`${item} татагдсангүй`);
      done.push(item);
    },
    { delayMs: 1000, sleep },
  );

  assert.deepEqual(done, ["a", "c"], "унасны дараа ч дараагийнх ажиллана");
  assert.equal(outcome.ok, 2);
  assert.deepEqual(
    outcome.failed,
    [
      { item: "bad", message: "bad татагдсангүй" },
      { item: "bad2", message: "bad2 татагдсангүй" },
    ],
    "бүтэлгүйтэл нь элемент + шалтгаантай нэгтгэгдэнэ",
  );
  assert.equal(outcome.stopped, false);
  assert.equal(calls.length, 3, "унасан хүсэлтийн дараа ч delay хэвээр");
});

test("toMessage-ээр алдааг хүн уншихаар текст болгоно", async () => {
  const outcome = await runSequentialWithDelay(
    ["a"],
    async () => {
      throw { response: { status: 404 } };
    },
    { delayMs: 0, toMessage: (err) => `HTTP ${err.response.status}` },
  );
  assert.deepEqual(outcome.failed, [{ item: "a", message: "HTTP 404" }]);
});

test("зогсоох хүсэлт — дараагийн хүсэлт явуулахгүй, stopped=true", async () => {
  const { calls, sleep } = fakeSleep();
  const seen = [];
  let stop = false;

  const outcome = await runSequentialWithDelay(
    ["a", "b", "c", "d"],
    async (item) => {
      seen.push(item);
      if (item === "b") stop = true; // 2 дахийн дараа хэрэглэгч зогсоов
    },
    { delayMs: 1000, sleep, shouldStop: () => stop },
  );

  assert.deepEqual(seen, ["a", "b"], "зогссоны дараа шинэ хүсэлт явуулахгүй");
  assert.deepEqual(outcome, { total: 4, ok: 2, failed: [], stopped: true });
  assert.deepEqual(calls, [1000], "зогссон үед дэмий хүлээхгүй");
});

test("прогресс: onStart нь хүсэлтийн өмнө, onSettled нь дараа", async () => {
  const { sleep } = fakeSleep();
  const events = [];

  await runSequentialWithDelay(
    ["a", "bad"],
    async (item) => {
      events.push(`run:${item}`);
      if (item === "bad") throw new Error("алдаа");
    },
    {
      delayMs: 0,
      sleep,
      onStart: (item, index) => events.push(`start:${item}#${index}`),
      onSettled: ({ done, total, item, ok, failed }) =>
        events.push(`settled:${item} ${done}/${total} ok=${ok} fail=${failed.length}`),
    },
  );

  assert.deepEqual(events, [
    "start:a#0",
    "run:a",
    "settled:a 1/2 ok=1 fail=0",
    "start:bad#1",
    "run:bad",
    "settled:bad 2/2 ok=1 fail=1",
  ]);
});

test("onSettled-д өгсөн failed нь хуулбар — дараа нь өөрчлөгдөхгүй", async () => {
  const snapshots = [];
  await runSequentialWithDelay(
    ["bad1", "bad2"],
    async (item) => {
      throw new Error(item);
    },
    { delayMs: 0, onSettled: ({ failed }) => snapshots.push(failed) },
  );
  assert.equal(snapshots[0].length, 1, "1-р snapshot нь хойшдын алдаагаар бохирдохгүй");
  assert.equal(snapshots[1].length, 2);
});
