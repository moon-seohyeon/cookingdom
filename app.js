// 영광의 항로 무역 도우미 - 메인 로직

const STORAGE_KEY = "glory_route_trade_tracker_v2";
const MAX_ROUTE_LEN = 4; // 한 장(15턴) 동안 최대로 방문 가능한 섬 수

function emptyGrid() {
  const grid = {};
  ITEMS.forEach((it) => {
    grid[it.name] = {};
    ISLANDS.forEach((isl) => {
      grid[it.name][isl] = { buy: null, sell: null, stock: null };
    });
  });
  return grid;
}

function defaultState() {
  return {
    currentChapter: 1,
    chapters: {
      1: { prices: JSON.parse(JSON.stringify(SEED_CHAPTER_1)), notes: "", startIsland: null, commissions: [], currentCargo: [] },
    },
    ledger: [],
    budget: 0,
    // 항해(내구도 소진 등)가 리셋돼도 사라지지 않는, 품목별 누적 가격 통계
    archivedPriceStats: {},
    // 이번 항해 지도의 섬 배치(고리 순서). 1번째~6번째 섬이 실제 어느 섬인지. 항해가 리셋되면 지도가 바뀌므로 함께 초기화된다.
    ringOrder: new Array(ISLANDS.length).fill(null),
    // 이번 장에서 실제로 몇 개 섬을 돌 예정인지 (턴이 부족해 3개만 돌 수도 있음)
    routeVisitCount: MAX_ROUTE_LEN,
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed.chapters || !parsed.chapters[1]) return defaultState();
    if (parsed.budget === undefined) parsed.budget = 0;
    if (!parsed.archivedPriceStats) parsed.archivedPriceStats = {};
    if (!parsed.ringOrder || parsed.ringOrder.length !== ISLANDS.length) {
      parsed.ringOrder = new Array(ISLANDS.length).fill(null);
    }
    if (!parsed.routeVisitCount) parsed.routeVisitCount = MAX_ROUTE_LEN;
    return parsed;
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getChapter(num) {
  if (!state.chapters[num]) {
    state.chapters[num] = { prices: emptyGrid(), notes: "", startIsland: null, commissions: [], currentCargo: [] };
  }
  if (state.chapters[num].startIsland === undefined) state.chapters[num].startIsland = null;
  if (!state.chapters[num].commissions) state.chapters[num].commissions = [];
  if (!state.chapters[num].currentCargo) state.chapters[num].currentCargo = [];
  return state.chapters[num];
}

function chapterNums() {
  return Object.keys(state.chapters)
    .map(Number)
    .sort((a, b) => a - b);
}

// 한 장(chapter) 안에서 어떤 품목의 섬별 최저 구매가 / 최고 판매가
function chapterMinMax(chapterPrices, itemName) {
  const grid = chapterPrices[itemName];
  let lowBuy = null;
  let highSell = null;
  if (!grid) return { lowBuy, highSell };
  ISLANDS.forEach((isl) => {
    const cell = grid[isl];
    if (cell.buy !== null && cell.buy !== undefined) {
      if (lowBuy === null || cell.buy < lowBuy) lowBuy = cell.buy;
    }
    if (cell.sell !== null && cell.sell !== undefined) {
      if (highSell === null || cell.sell > highSell) highSell = cell.sell;
    }
  });
  return { lowBuy, highSell };
}

// 지금까지 기록된(이번 항해 진행분 + 리셋 전 항해들에서 보관된) 품목별 평균가.
// avgLowBuy: 장마다의 "가장 싼 구매가"를 평균낸 값 -> 지금 가격이 이보다 낮으면 평소보다 싼 것
// avgHighSell: 장마다의 "가장 비싼 판매가"를 평균낸 값 -> 지금 가격이 이보다 높으면 평소보다 비싸게 파는 것
function computeItemStats(itemName) {
  const archived = state.archivedPriceStats[itemName] || {
    lowBuySum: 0,
    lowBuyCount: 0,
    highSellSum: 0,
    highSellCount: 0,
  };
  let lowBuySum = archived.lowBuySum;
  let lowBuyCount = archived.lowBuyCount;
  let highSellSum = archived.highSellSum;
  let highSellCount = archived.highSellCount;

  chapterNums().forEach((n) => {
    const { lowBuy, highSell } = chapterMinMax(state.chapters[n].prices, itemName);
    if (lowBuy !== null) {
      lowBuySum += lowBuy;
      lowBuyCount += 1;
    }
    if (highSell !== null) {
      highSellSum += highSell;
      highSellCount += 1;
    }
  });

  return {
    avgLowBuy: lowBuyCount ? lowBuySum / lowBuyCount : null,
    avgHighSell: highSellCount ? highSellSum / highSellCount : null,
    lowBuyCount,
    highSellCount,
  };
}

// 새 항해 시작: 이번 항해의 시세/구매기록은 지우되, 품목별 누적 평균 통계는 archivedPriceStats에 보관해 유지한다.
function resetVoyage() {
  const ok = confirm(
    "새 항해를 시작할까요?\n\n지금 입력된 이번 항해의 장별 시세와 구매 기록, 섬 배치 정보가 모두 사라집니다.\n(품목별 평균 가격 기록은 계속 유지됩니다)"
  );
  if (!ok) return;

  const archive = state.archivedPriceStats;
  ITEMS.forEach((it) => {
    if (!archive[it.name]) {
      archive[it.name] = { lowBuySum: 0, lowBuyCount: 0, highSellSum: 0, highSellCount: 0 };
    }
  });
  chapterNums().forEach((n) => {
    ITEMS.forEach((it) => {
      const { lowBuy, highSell } = chapterMinMax(state.chapters[n].prices, it.name);
      if (lowBuy !== null) {
        archive[it.name].lowBuySum += lowBuy;
        archive[it.name].lowBuyCount += 1;
      }
      if (highSell !== null) {
        archive[it.name].highSellSum += highSell;
        archive[it.name].highSellCount += 1;
      }
    });
  });

  state.chapters = { 1: { prices: emptyGrid(), notes: "", startIsland: null, commissions: [], currentCargo: [] } };
  state.currentChapter = 1;
  state.ledger = [];
  state.ringOrder = new Array(ISLANDS.length).fill(null);
  window.__tradeOrigin = null;
  window.__tradeDest = null;
  window.__selectedRouteKey = null;
  window.__recalcFormOpen = false;
  window.__recalcStaging = null;
  saveState();
  activeTab = "price";
  document.querySelectorAll("nav.tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === "price"));
  render();
}

function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toLocaleString("ko-KR");
}

function parseNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// ---------- TAB SWITCHING ----------

let activeTab = "price";

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll("nav.tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  render();
}

function render() {
  const main = document.getElementById("app-main");
  main.innerHTML = "";
  if (activeTab === "price") renderPriceTab(main);
  if (activeTab === "trade") renderTradeTab(main);
  if (activeTab === "ledger") renderLedgerTab(main);
  if (activeTab === "history") renderHistoryTab(main);
}

// ---------- TAB 1: 시세 입력 ----------

function renderPriceTab(main) {
  const panel = document.createElement("div");
  panel.className = "panel";

  const chapters = chapterNums();
  const cur = state.currentChapter;
  const chapterData = getChapter(cur);

  panel.innerHTML = `
    <div class="row">
      <label>항해 일지</label>
      <select id="chapter-select">
        ${chapters.map((c) => `<option value="${c}" ${c === cur ? "selected" : ""}>${c}장</option>`).join("")}
      </select>
      <button class="btn small" id="new-chapter-btn">다음 장 새로 추가</button>
      <button class="btn small secondary" id="copy-prev-btn">이전 장 값 복사해서 채우기</button>
      <button class="btn small secondary" id="reset-voyage-btn" style="border-color:var(--bad);color:var(--bad);margin-left:auto">🔄 새 항해 시작 (리셋)</button>
    </div>
    <p class="hint">품목별 구매가 / 판매가 / 재고량을 섬마다 입력하세요. 산지 전용 품목은 원산지 섬 외에는 구매 칸이 비활성화됩니다. 내구도가 다 떨어져 항해가 끝나면 "새 항해 시작"을 눌러 초기화하세요 (품목별 평균 가격 기록은 유지됩니다).</p>
    <div class="row" style="flex-direction:column;align-items:stretch;">
      <label>이번 장 특이사항 (돌발 이벤트, 환경 요소 등)</label>
      <textarea id="chapter-notes" placeholder="예: 감정가들의 섬에서 털뭉치 인형 구매가 감소 / 전체섬 코코넛 꽃게 재고 증가">${chapterData.notes || ""}</textarea>
    </div>
  `;
  main.appendChild(panel);

  const pastePanel = document.createElement("div");
  pastePanel.className = "panel";
  pastePanel.innerHTML = `
    <h3 style="margin-top:0;color:var(--accent-2)">빠른 입력: 클로드가 정리해준 값 붙여넣기</h3>
    <p class="hint">섬별 무역품 스크린샷을 클로드에게 보내면, 이 표에 붙여넣을 텍스트를 만들어줄 거예요. 그 텍스트를 아래 칸에 붙여넣고 "적용"을 누르면 표가 자동으로 채워집니다. 직접 표를 입력해도 물론 됩니다.</p>
    <div class="row" style="flex-direction:column;align-items:stretch;">
      <textarea id="paste-input" placeholder="클로드가 준 텍스트를 여기에 붙여넣으세요" style="min-height:70px;font-family:monospace;font-size:0.78rem;"></textarea>
    </div>
    <div class="row">
      <button class="btn small" id="paste-apply-btn">적용</button>
      <span class="muted" id="paste-status"></span>
    </div>
  `;
  main.appendChild(pastePanel);

  const tablePanel = document.createElement("div");
  tablePanel.className = "panel";
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  let html = '<table class="price-grid"><thead><tr><th rowspan="2" class="corner">품목</th>';
  ISLANDS.forEach((isl) => (html += `<th colspan="3" class="island-head">${isl}</th>`));
  html += '</tr><tr class="sub-head">';
  ISLANDS.forEach(() => {
    html += `<th>구매</th><th>판매</th><th>재고</th>`;
  });
  html += "</tr></thead><tbody>";

  ITEMS.forEach((it) => {
    html += `<tr><td class="item-name">${it.name}<br><span class="badge cat">${it.category}</span>${
      it.exclusive ? `<span class="badge exclusive">${it.exclusive} 전용</span>` : ""
    }</td>`;
    ISLANDS.forEach((isl) => {
      const cell = chapterData.prices[it.name][isl];
      const canBuy = !it.exclusive || it.exclusive === isl;
      html += `<td>${
        canBuy
          ? `<input type="number" data-item="${it.name}" data-island="${isl}" data-field="buy" value="${cell.buy ?? ""}">`
          : `<input type="number" disabled style="opacity:.3">`
      }</td>`;
      html += `<td><input type="number" data-item="${it.name}" data-island="${isl}" data-field="sell" value="${cell.sell ?? ""}"></td>`;
      html += `<td><input type="number" data-item="${it.name}" data-island="${isl}" data-field="stock" value="${cell.stock ?? ""}"></td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  wrap.innerHTML = html;
  tablePanel.appendChild(wrap);
  main.appendChild(tablePanel);

  // events
  document.getElementById("chapter-select").addEventListener("change", (e) => {
    state.currentChapter = Number(e.target.value);
    saveState();
    render();
  });

  document.getElementById("new-chapter-btn").addEventListener("click", () => {
    const next = Math.max(...chapterNums()) + 1;
    getChapter(next);
    state.currentChapter = next;
    saveState();
    render();
  });

  document.getElementById("copy-prev-btn").addEventListener("click", () => {
    const nums = chapterNums().filter((n) => n < cur);
    if (!nums.length) {
      alert("복사할 이전 장이 없습니다.");
      return;
    }
    const prev = Math.max(...nums);
    chapterData.prices = JSON.parse(JSON.stringify(state.chapters[prev].prices));
    saveState();
    render();
  });

  document.getElementById("chapter-notes").addEventListener("input", (e) => {
    chapterData.notes = e.target.value;
    saveState();
  });

  document.getElementById("reset-voyage-btn").addEventListener("click", resetVoyage);

  document.getElementById("paste-apply-btn").addEventListener("click", () => {
    const statusEl = document.getElementById("paste-status");
    const raw = document.getElementById("paste-input").value.trim();
    if (!raw) {
      statusEl.textContent = "붙여넣을 내용이 없습니다.";
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      statusEl.textContent = "형식을 읽을 수 없습니다. 클로드가 준 텍스트를 그대로 복사했는지 확인해주세요.";
      return;
    }
    let applied = 0;
    Object.keys(data).forEach((itemName) => {
      if (!chapterData.prices[itemName]) return;
      const islandsData = data[itemName] || {};
      Object.keys(islandsData).forEach((islandName) => {
        if (!ISLANDS.includes(islandName)) return;
        const incoming = islandsData[islandName] || {};
        const cell = chapterData.prices[itemName][islandName];
        if (incoming.buy !== undefined) cell.buy = incoming.buy;
        if (incoming.sell !== undefined) cell.sell = incoming.sell;
        if (incoming.stock !== undefined) cell.stock = incoming.stock;
        applied++;
      });
    });
    saveState();
    render();
    alert(`${applied}개 칸에 가격을 적용했습니다.`);
  });

  wrap.querySelectorAll("input[data-item]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const { item, island, field } = e.target.dataset;
      chapterData.prices[item][island][field] = parseNumOrNull(e.target.value);
      saveState();
    });
  });
}

// ---------- TAB 2: 거래 추천 (출발섬 -> 도착섬 기준) ----------

const ALL_OPTION = "__ALL__";

// ---------- 섬 배치(고리 순서) & 최적 항로 계산 ----------
// 항해 시작 시 배는 지도 한가운데서 출발해 6개 섬 중 아무 곳이나 첫 목적지로 갈 수 있고,
// 그 다음부터는 최단거리 이동만 하므로 "고리(육각형)"로 이어진 양옆 섬으로만 움직인다고 가정한다.

function ringOrderComplete() {
  const order = state.ringOrder;
  if (!order || order.length !== ISLANDS.length) return false;
  if (order.some((v) => !v)) return false;
  return new Set(order).size === order.length;
}

function neighborsOf(island) {
  const order = state.ringOrder;
  const idx = order.indexOf(island);
  if (idx === -1) return [];
  const n = order.length;
  return [order[(idx - 1 + n) % n], order[(idx + 1) % n]];
}

// 첫 섬에서 시작해(고정 출발섬이 없으면 6곳 중 아무 곳이나), 그 뒤로는 근접섬으로만 이동하는
// 길이 maxLen짜리 경로를 모두 나열한다. fixedStart를 주면 그 섬에서 출발하는 경로만 나열한다
// (지난 장 마지막에 도착해 있던 섬에서 이번 장을 시작하는 경우).
function enumerateRoutes(maxLen, fixedStart) {
  const routes = [];
  function extend(path) {
    if (path.length === maxLen) {
      routes.push(path.slice());
      return;
    }
    neighborsOf(path[path.length - 1]).forEach((next) => extend(path.concat([next])));
  }
  const starts = fixedStart ? [fixedStart] : state.ringOrder;
  starts.forEach((start) => extend([start]));
  return routes;
}

// 품목 하나를 이 항로에서 어디서 파는 게 최선인지 계산한다. afterIndex 다음 정류장들의 시장 판매가 중
// 최고가와, 그 품목의 의뢰(있다면) 보상을 비교해 더 유리한 쪽을 고른다. 의뢰는 딱 1개분만 적용되므로
// (여러 개를 갖고 있다면) "의뢰 보상을 받는 1개" 묶음과 "시장가로 파는 나머지" 묶음으로 나눠 돌려준다.
// usedCommissionKeys에 이미 들어있는 의뢰는 (다른 정류장에서 이미 배정됐다는 뜻이므로) 다시 제안하지 않는다 —
// 의뢰는 항로 전체에서 딱 1번만 채울 수 있다.
function sellLotsFor(itemName, qty, chapterData, route, afterIndex, commissions, usedCommissionKeys) {
  if (!qty || qty <= 0) return [];
  let marketBest = null;
  let marketIdx = null;
  for (let j = afterIndex + 1; j < route.length; j++) {
    const sellCell = chapterData.prices[itemName][route[j]];
    if (sellCell && sellCell.sell !== null && sellCell.sell !== undefined) {
      if (marketBest === null || sellCell.sell > marketBest) {
        marketBest = sellCell.sell;
        marketIdx = j;
      }
    }
  }

  const commission = (commissions || []).find((c) => c.item === itemName);
  const commissionKey = commission ? `${commission.item}→${commission.destIsland}` : null;
  const alreadyUsed = commissionKey && usedCommissionKeys && usedCommissionKeys.has(commissionKey);
  const destIdx = commission && !alreadyUsed ? route.indexOf(commission.destIsland, afterIndex + 1) : -1;
  const hasCommission = commission && destIdx !== -1;

  const lots = [];
  if (hasCommission) {
    const commissionBeats = marketBest === null || commission.reward > marketBest;
    lots.push({
      qty: Math.min(1, qty),
      sellPrice: commissionBeats ? commission.reward : marketBest,
      sellIdx: commissionBeats ? destIdx : marketIdx,
      isCommission: commissionBeats,
      commissionKey: commissionBeats ? commissionKey : null,
    });
    if (qty > 1 && marketBest !== null) {
      lots.push({ qty: qty - 1, sellPrice: marketBest, sellIdx: marketIdx, isCommission: false, commissionKey: null });
    }
  } else if (marketBest !== null) {
    lots.push({ qty, sellPrice: marketBest, sellIdx: marketIdx, isCommission: false, commissionKey: null });
  }
  return lots.filter((l) => l.qty > 0);
}

// 어떤 항로를 따라갈 때, 한 정류장(stopIndex)에서 살 만한 품목들을 ROI(마진/구매가) 순으로 예산과 재고가
// 허락하는 만큼 담는다. 각 품목은 이 항로에서 앞으로 남은 정류장 중 판매가(의뢰 보상 포함)가 가장 높은
// 곳에서 팔 것으로 계획한다. 재고는 "구매"만 제한하고 "판매"는 무제한이라고 가정한다.
function planStopPurchases(chapterData, remainingStock, island, route, stopIndex, cash, commissions, usedCommissionKeys) {
  const candidates = [];
  ITEMS.forEach((it) => {
    if (it.exclusive && it.exclusive !== island) return;
    const buyCell = chapterData.prices[it.name][island];
    if (buyCell.buy === null || buyCell.buy === undefined) return;
    const stockLeft = remainingStock[it.name][island];
    if (stockLeft !== null && stockLeft !== undefined && stockLeft <= 0) return;

    const stockLeftNum = stockLeft === null || stockLeft === undefined ? Infinity : stockLeft;
    const lots = sellLotsFor(it.name, stockLeftNum, chapterData, route, stopIndex, commissions, usedCommissionKeys);
    lots.forEach((lot) => {
      const margin = lot.sellPrice - buyCell.buy;
      if (margin <= 0) return;
      candidates.push({
        item: it,
        buyPrice: buyCell.buy,
        stockLeft: lot.qty,
        sellPrice: lot.sellPrice,
        sellIdx: lot.sellIdx,
        margin,
        isCommission: lot.isCommission,
        commissionKey: lot.commissionKey,
      });
    });
  });

  candidates.sort((a, b) => b.margin / b.buyPrice - a.margin / a.buyPrice);

  let remaining = cash;
  const picks = [];
  candidates.forEach((c) => {
    if (remaining < c.buyPrice) return;
    const maxByStock = c.stockLeft === null || c.stockLeft === undefined ? Infinity : c.stockLeft;
    const maxByBudget = Math.floor(remaining / c.buyPrice);
    const qty = Math.min(maxByStock, maxByBudget);
    if (qty <= 0) return;
    const cost = qty * c.buyPrice;
    picks.push({ ...c, qty, cost });
    remaining -= cost;
  });
  return { picks, remaining };
}

// 정해진 항로를 순서대로 따라가며: (1) 이 정류장에서 팔기로 예정된 것들을 먼저 팔아 현금화하고,
// (2) 그 현금으로 다시 그리디하게 사들이는 과정을 시뮬레이션한다. 같은 섬을 다시 들르면(예: 3→4→3→2)
// 첫 방문 때 산 만큼 재고가 줄어든 상태로 반영된다. initialCargo는 항로를 시작하기 전에 이미 들고 있는
// 짐(계획과 다르게 사버렸거나 의뢰용으로 챙긴 것 등)으로, 항로 어딘가에서 팔릴 곳을 새로 찾아 반영한다.
function simulateRoute(chapterData, route, startBudget, initialCargo) {
  const commissions = chapterData.commissions || [];
  const remainingStock = {};
  ITEMS.forEach((it) => {
    remainingStock[it.name] = {};
    ISLANDS.forEach((isl) => {
      remainingStock[it.name][isl] = chapterData.prices[it.name][isl].stock;
    });
  });

  let cash = startBudget;
  let holdings = [];
  const usedCommissionKeys = new Set();
  (initialCargo || []).forEach((entry) => {
    const lots = sellLotsFor(entry.item.name, entry.qty, chapterData, route, -1, commissions, usedCommissionKeys);
    lots.forEach((lot) => {
      if (lot.isCommission && lot.commissionKey) usedCommissionKeys.add(lot.commissionKey);
      holdings.push({
        item: entry.item,
        qty: lot.qty,
        buyPrice: null,
        buyIsland: "보유 중이던 짐",
        sellIdx: lot.sellIdx,
        sellPrice: lot.sellPrice,
        isCommission: lot.isCommission,
      });
    });
  });

  const steps = [];

  route.forEach((island, idx) => {
    const sellsHere = holdings.filter((h) => h.sellIdx === idx);
    holdings = holdings.filter((h) => h.sellIdx !== idx);
    const sellRecords = sellsHere.map((h) => {
      const revenue = h.qty * h.sellPrice;
      cash += revenue;
      return {
        item: h.item.name,
        qty: h.qty,
        buyIsland: h.buyIsland,
        buyPrice: h.buyPrice,
        sellPrice: h.sellPrice,
        revenue,
        profit: h.buyPrice === null ? null : revenue - h.qty * h.buyPrice,
        isCommission: h.isCommission,
      };
    });

    const { picks, remaining } = planStopPurchases(chapterData, remainingStock, island, route, idx, cash, commissions, usedCommissionKeys);
    picks.forEach((p) => {
      if (p.isCommission && p.commissionKey) usedCommissionKeys.add(p.commissionKey);
      remainingStock[p.item.name][island] -= p.qty;
      holdings.push({
        item: p.item,
        qty: p.qty,
        buyPrice: p.buyPrice,
        buyIsland: island,
        sellIdx: p.sellIdx,
        sellPrice: p.sellPrice,
        isCommission: p.isCommission,
      });
    });
    cash = remaining;

    steps.push({
      island,
      sells: sellRecords,
      buys: picks.map((p) => ({
        item: p.item.name,
        qty: p.qty,
        buyPrice: p.buyPrice,
        cost: p.cost,
        sellIsland: route[p.sellIdx],
        sellPrice: p.sellPrice,
        isCommission: p.isCommission,
      })),
      cashAfter: cash,
    });
  });

  return { route, steps, finalCash: cash, profit: cash - startBudget };
}

function findBestRoutes(chapterData, budget, maxLen, fixedStart, initialCargo) {
  const routes = enumerateRoutes(maxLen, fixedStart);
  return routes.map((route) => simulateRoute(chapterData, route, budget, initialCargo)).sort((a, b) => b.finalCash - a.finalCash);
}

function bestTradeForItem(chapterData, item, originFilter, destFilter) {
  const grid = chapterData.prices[item.name];
  const origins = originFilter === ALL_OPTION ? ISLANDS : [originFilter];
  const dests = destFilter === ALL_OPTION ? ISLANDS : [destFilter];

  let best = null;
  origins.forEach((o) => {
    const buyCell = grid[o];
    if (buyCell.buy === null || buyCell.buy === undefined) return;
    dests.forEach((d) => {
      if (d === o) return;
      const sellCell = grid[d];
      if (sellCell.sell === null || sellCell.sell === undefined) return;
      const margin = sellCell.sell - buyCell.buy;
      if (!best || margin > best.margin) {
        best = {
          origin: o,
          dest: d,
          buyPrice: buyCell.buy,
          sellPrice: sellCell.sell,
          buyStock: buyCell.stock,
          sellStock: sellCell.stock,
          margin,
        };
      }
    });
  });
  return best;
}

// 가진 돈(budget) 안에서 이익을 최대화하는 구매 조합을 그리디로 계산한다.
// 골드당 이익(margin/buyPrice, ROI)이 높은 품목부터 예산과 재고가 허락하는 만큼 채운다.
function computeBudgetPlan(trades, budget) {
  const candidates = trades
    .filter(({ best }) => best.margin > 0 && best.buyPrice > 0)
    .slice()
    .sort((a, b) => b.best.margin / b.best.buyPrice - a.best.margin / a.best.buyPrice);

  let remaining = budget;
  const picks = [];
  candidates.forEach(({ item, best }) => {
    if (remaining < best.buyPrice) return;
    const maxByStock = Math.min(best.buyStock ?? Infinity, best.sellStock ?? Infinity);
    const maxByBudget = Math.floor(remaining / best.buyPrice);
    const qty = Math.min(maxByStock, maxByBudget);
    if (qty <= 0) return;
    const cost = qty * best.buyPrice;
    const revenue = qty * best.sellPrice;
    picks.push({ item, best, qty, cost, revenue, profit: revenue - cost });
    remaining -= cost;
  });

  const totalCost = picks.reduce((s, p) => s + p.cost, 0);
  const totalRevenue = picks.reduce((s, p) => s + p.revenue, 0);
  return { picks, totalCost, totalRevenue, totalProfit: totalRevenue - totalCost, remaining };
}

function budgetPlanHTML(trades) {
  const budget = state.budget || 0;
  const plan = computeBudgetPlan(trades, budget);
  if (!budget) {
    return `<p class="muted">가진 돈을 입력하면, 그 예산 안에서 이익이 최대가 되도록 무엇을 얼마나 살지 계산해줍니다.</p>`;
  }
  if (!plan.picks.length) {
    return `<p class="muted">이 예산과 조합으로는 이득이 남는 거래가 없습니다.</p>`;
  }
  return `
    <div class="summary-cards">
      <div class="card"><div class="label">투입 금액</div><div class="value">${fmt(plan.totalCost)}</div></div>
      <div class="card"><div class="label">예상 판매 금액</div><div class="value">${fmt(plan.totalRevenue)}</div></div>
      <div class="card"><div class="label">예상 순이익</div><div class="value profit-pos">+${fmt(plan.totalProfit)}</div></div>
      <div class="card"><div class="label">남는 돈</div><div class="value">${fmt(plan.remaining)}</div></div>
    </div>
    <div class="table-wrap" style="max-height:none">
      <table>
        <thead><tr><th>품목</th><th>구매처</th><th>판매처</th><th>개당가</th><th>수량</th><th>투입금액</th><th>예상이익</th></tr></thead>
        <tbody>
          ${plan.picks
            .map(
              (p) => `<tr>
            <td class="item-name" style="position:static">${p.item.name}${p.item.exclusive ? `<span class="badge exclusive">${p.item.exclusive} 전용</span>` : ""}</td>
            <td>${p.best.origin}</td>
            <td>${p.best.dest}</td>
            <td>${fmt(p.best.buyPrice)}</td>
            <td>${p.qty}</td>
            <td>${fmt(p.cost)}</td>
            <td class="profit-pos">+${fmt(p.profit)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ---------- 섬 배치 입력 + 최적 항로 추천 UI ----------

function ringOrderPanelHTML() {
  const order = state.ringOrder;
  const counts = {};
  order.forEach((v) => {
    if (v) counts[v] = (counts[v] || 0) + 1;
  });
  const hasDup = Object.values(counts).some((c) => c > 1);

  return `
    <h3 style="margin-top:0;color:var(--accent-2)">🗺️ 이번 항해 섬 배치</h3>
    <p class="hint">배는 항해 시작 시 지도 한가운데서 출발해 6개 섬 중 아무 곳이나 먼저 갈 수 있고, 그 다음부터는 고리(육각형)로 이어진 양옆 근접섬으로만 최단거리 이동을 합니다. 1번째 섬부터 6번째 섬까지, 실제로 어느 섬인지 순서대로 골라서 알려주세요 (예: 1번=농부들의 섬, 2번=목동들의 섬이면 두 섬은 서로 근접섬). 새 항해를 시작하면 지도가 바뀌므로 다시 설정해야 합니다.</p>
    <div class="row" style="flex-wrap:wrap;gap:10px">
      ${order
        .map(
          (v, i) => `
        <div style="display:flex;flex-direction:column;gap:2px">
          <label style="font-size:0.75rem">${i + 1}번째 섬</label>
          <select data-ring-idx="${i}">
            <option value="">선택</option>
            ${ISLANDS.map((isl) => `<option value="${isl}" ${v === isl ? "selected" : ""}>${isl}</option>`).join("")}
          </select>
        </div>
      `
        )
        .join("")}
    </div>
    ${hasDup ? `<p class="hint" style="color:var(--bad)">⚠️ 같은 섬이 두 번 이상 선택됐습니다. 서로 다른 섬 6개를 선택하세요.</p>` : ""}
  `;
}

function routeStepsHTML(result, startBudget) {
  return `
    <div class="table-wrap" style="max-height:none">
      <table>
        <thead><tr><th>순서</th><th>섬</th><th>여기서 팔기</th><th>여기서 사기</th><th>떠날 때 보유 현금</th></tr></thead>
        <tbody>
          ${result.steps
            .map(
              (s, i) => `<tr>
            <td>${i + 1}</td>
            <td><strong>${s.island}</strong></td>
            <td style="text-align:left">${
              s.sells.length
                ? s.sells
                    .map((se) => {
                      const tag = se.isCommission ? `🎁 의뢰 ` : "";
                      const buyPart = se.buyPrice === null ? se.buyIsland : `${se.buyIsland} ${fmt(se.buyPrice)} →`;
                      const profitPart =
                        se.profit === null
                          ? ""
                          : ` <span class="profit-pos">+${fmt(se.profit)}</span>`;
                      return `${tag}${se.item} ${se.qty}개 (${buyPart} 여기 ${fmt(se.sellPrice)})${profitPart}`;
                    })
                    .join("<br>")
                : "-"
            }</td>
            <td style="text-align:left">${
              s.buys.length
                ? s.buys
                    .map(
                      (b) =>
                        `${b.isCommission ? "🎁 의뢰 " : ""}${b.item} ${b.qty}개 (개당 ${fmt(b.buyPrice)}) → ${b.sellIsland}에서 판매 예정`
                    )
                    .join("<br>")
                : "-"
            }</td>
            <td>${fmt(s.cashAfter)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="summary-cards" style="margin-top:10px">
      <div class="card"><div class="label">시작 자금</div><div class="value">${fmt(startBudget)}</div></div>
      <div class="card"><div class="label">최종 현금</div><div class="value">${fmt(result.finalCash)}</div></div>
      <div class="card"><div class="label">순이익</div><div class="value ${result.profit >= 0 ? "profit-pos" : "profit-neg"}">${
    result.profit >= 0 ? "+" : ""
  }${fmt(result.profit)}</div></div>
    </div>
  `;
}

function routeKey(route) {
  return route.join("|");
}

// 항로의 첫 정류장에서 뭘 사야 하는지 짧게 미리 보여준다 (표 안에서 바로 확인용).
function firstStopBuyPreviewHTML(route) {
  const buys = route.steps[0].buys;
  if (!buys.length) return `<span class="muted">-</span>`;
  return buys.map((b) => `${b.isCommission ? "🎁 " : ""}${b.item} ${b.qty}개`).join("<br>");
}

function commissionPanelHTML(chapterData) {
  const list = chapterData.commissions || [];
  return `
    <div class="row" style="flex-direction:column;align-items:stretch">
      <label>🎁 의뢰 (선택 사항) — 품목 1개를 지정한 섬에 갖다주면 받는 보상</label>
      ${
        list.length
          ? list
              .map(
                (c, i) =>
                  `<div class="row" style="margin:2px 0"><span class="tag">${c.item} → ${c.destIsland} : 보상 ${fmt(c.reward)}</span><button class="btn small secondary" data-remove-commission="${i}">삭제</button></div>`
              )
              .join("")
          : `<p class="muted">등록된 의뢰가 없습니다.</p>`
      }
      <div class="row">
        <select id="commission-item">${ITEMS.map((it) => `<option value="${it.name}">${it.name}</option>`).join("")}</select>
        <select id="commission-dest">${ISLANDS.map((isl) => `<option value="${isl}">${isl}</option>`).join("")}</select>
        <input type="number" id="commission-reward" placeholder="보상(골드)" style="width:100px">
        <button class="btn small" id="commission-add-btn">의뢰 추가</button>
      </div>
      <p class="hint">등록하면, 그 품목 1개는 시장가 대신(시장가가 더 높으면 시장가로) 이 보상으로 파는 걸로 계산해서 항로를 추천합니다. 나머지 수량은 평소처럼 시장가로 계산됩니다.</p>
    </div>
  `;
}

function recalcPanelHTML(chapterData) {
  if (!window.__recalcFormOpen) {
    return `
      <div class="row">
        <button class="btn small secondary" id="recalc-toggle-btn" style="border-color:var(--accent);color:var(--accent)">📋 계획이 틀어졌어요 (여기서 다시 계산)</button>
        <span class="muted">의뢰나 돌발 이벤트 때문에 추천과 다르게 사버렸다면, 여기를 눌러 지금 상태를 입력하고 나머지 항로를 다시 계산하세요.</span>
      </div>
    `;
  }

  const staging = window.__recalcStaging;
  const cargo = staging.cargo || [];
  return `
    <div class="panel" style="background:#0d2038;border-color:var(--accent)">
      <h3 style="margin-top:0;color:var(--accent)">📋 지금 상태로 다시 계산하기</h3>
      <div class="row">
        <label>지금 있는 섬</label>
        <select id="recalc-start-island">
          <option value="" ${!staging.startIsland ? "selected" : ""}>처음 시작 (한가운데)</option>
          ${ISLANDS.map((isl) => `<option value="${isl}" ${staging.startIsland === isl ? "selected" : ""}>${isl}</option>`).join("")}
        </select>
        <label>지금 가진 돈</label>
        <input type="number" id="recalc-budget" value="${staging.budget || ""}" style="width:110px">
      </div>
      <div class="row" style="flex-direction:column;align-items:stretch">
        <label>지금 들고 있는 짐 (아직 안 판 것)</label>
        ${
          cargo.length
            ? cargo
                .map(
                  (c, i) =>
                    `<div class="row" style="margin:2px 0"><span class="tag">${c.itemName} ${c.qty}개</span><button class="btn small secondary" data-remove-cargo="${i}">삭제</button></div>`
                )
                .join("")
            : `<p class="muted">없음</p>`
        }
        <div class="row">
          <select id="recalc-cargo-item">${ITEMS.map((it) => `<option value="${it.name}">${it.name}</option>`).join("")}</select>
          <input type="number" id="recalc-cargo-qty" placeholder="수량" style="width:70px" value="1">
          <button class="btn small" id="recalc-cargo-add-btn">짐 추가</button>
        </div>
      </div>
      <p class="hint">가격이 바뀐 섬이 있다면 "시세 입력" 탭에서 먼저 고쳐주세요. 그다음 여기서 지금 있는 섬 / 가진 돈 / 들고 있는 짐을 입력하고 "다시 계산하기"를 누르면, 그 상태를 기준으로 남은 항로를 새로 추천합니다.</p>
      <div class="row">
        <button class="btn small" id="recalc-apply-btn">다시 계산하기</button>
        <button class="btn small secondary" id="recalc-cancel-btn">취소</button>
      </div>
    </div>
  `;
}

function routeRecommendationBodyHTML(chapterData) {
  if (!ringOrderComplete()) {
    return `<p class="muted">위에서 6개 섬 배치를 서로 다르게 모두 선택하면, 최적 시작섬과 연속 거래 항로를 계산해줍니다.</p>`;
  }
  const budget = state.budget || 0;
  if (!budget) {
    return `<p class="muted">아래 "가진 돈"을 입력하면, 이 예산 기준으로 최적 항로를 계산해줍니다.</p>`;
  }

  const visitCount = state.routeVisitCount || MAX_ROUTE_LEN;
  const fixedStart = chapterData.startIsland || null;
  const initialCargo = (chapterData.currentCargo || [])
    .map((c) => ({ item: ITEMS.find((it) => it.name === c.itemName), qty: c.qty }))
    .filter((c) => c.item && c.qty > 0);
  const allRoutes = findBestRoutes(chapterData, budget, visitCount, fixedStart, initialCargo);
  if (!allRoutes.length) return `<p class="muted">계산할 항로가 없습니다.</p>`;

  const cargoNoteHTML = initialCargo.length
    ? `<p class="hint">🎒 지금 들고 있는 짐(${initialCargo.map((c) => `${c.item.name} ${c.qty}개`).join(", ")})을 항로 어딘가에서 파는 것까지 포함해서 계산했습니다.</p>`
    : "";
  const commissionNoteHTML = (chapterData.commissions || []).length
    ? `<p class="hint">🎁 등록된 의뢰(${(chapterData.commissions || [])
        .map((c) => `${c.item}→${c.destIsland} ${fmt(c.reward)}`)
        .join(", ")})가 유리할 때 자동으로 반영됩니다.</p>`
    : "";

  const topRoutes = allRoutes.slice(0, 5);
  const selectedKey = window.__selectedRouteKey || routeKey(allRoutes[0].route);
  const selected = allRoutes.find((r) => routeKey(r.route) === selectedKey) || allRoutes[0];

  let byStartSectionHTML = "";
  if (!fixedStart) {
    const byStartMap = {};
    allRoutes.forEach((r) => {
      const start = r.route[0];
      if (!byStartMap[start] || r.finalCash > byStartMap[start].finalCash) byStartMap[start] = r;
    });
    const byStart = Object.values(byStartMap).sort((a, b) => b.finalCash - a.finalCash);
    byStartSectionHTML = `
      <h4 style="color:var(--accent);margin-bottom:6px">시작섬별 최고 효율 비교 (${visitCount}개 섬 기준, 같은 예산)</h4>
      <p class="hint">배가 한가운데서 출발할 때 어느 섬으로 먼저 가는 것이 가장 유리한지, 그 섬에서 뭘 사야 하는지까지 함께 비교합니다. 행을 누르면 아래 상세에서 전체 항로를 볼 수 있어요.</p>
      <div class="table-wrap" style="max-height:none">
        <table>
          <thead><tr><th>순위</th><th>시작섬</th><th>이어지는 최적 항로</th><th>이 섬에서 살 것</th><th>순이익</th></tr></thead>
          <tbody>
            ${byStart
              .map(
                (r, i) => `<tr data-route-key="${routeKey(r.route)}" class="route-row${routeKey(r.route) === selectedKey ? " selected" : ""}" style="cursor:pointer">
              <td>${i + 1}</td>
              <td><strong>${r.route[0]}</strong></td>
              <td>${r.route.join(" → ")}</td>
              <td style="text-align:left">${firstStopBuyPreviewHTML(r)}</td>
              <td class="${r.profit >= 0 ? "profit-pos" : "profit-neg"}">${r.profit >= 0 ? "+" : ""}${fmt(r.profit)}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="summary-cards">
      <div class="card"><div class="label">${fixedStart ? "출발섬 (고정)" : "추천 시작섬"}</div><div class="value" style="font-size:1.3rem">${allRoutes[0].route[0]}</div></div>
      <div class="card"><div class="label">추천 항로 (${visitCount}개 섬)</div><div class="value" style="font-size:1rem">${allRoutes[0].route.join(" → ")}</div></div>
      <div class="card"><div class="label">예상 순이익 (${fmt(budget)} 기준)</div><div class="value profit-pos">+${fmt(allRoutes[0].profit)}</div></div>
    </div>
    <p class="hint">👉 ${allRoutes[0].route[0]}에 도착하면 살 것: ${firstStopBuyPreviewHTML(allRoutes[0]).replace(/<br>/g, ", ")}</p>
    ${cargoNoteHTML}
    ${commissionNoteHTML}

    ${byStartSectionHTML}

    <h4 style="color:var(--accent);margin-top:16px;margin-bottom:6px">${
      fixedStart ? `${fixedStart}에서 출발하는 상위 항로 후보 (눌러서 상세 보기)` : "상위 항로 후보 (눌러서 상세 보기)"
    }</h4>
    <div class="table-wrap" style="max-height:none">
      <table>
        <thead><tr><th>순위</th><th>항로</th><th>첫 섬에서 살 것</th><th>순이익</th></tr></thead>
        <tbody>
          ${topRoutes
            .map(
              (r, i) => `<tr data-route-key="${routeKey(r.route)}" class="route-row${routeKey(r.route) === selectedKey ? " selected" : ""}" style="cursor:pointer">
            <td>${i + 1}</td>
            <td>${r.route.join(" → ")}</td>
            <td style="text-align:left">${firstStopBuyPreviewHTML(r)}</td>
            <td class="${r.profit >= 0 ? "profit-pos" : "profit-neg"}">${r.profit >= 0 ? "+" : ""}${fmt(r.profit)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <h4 style="color:var(--accent-2);margin-top:16px">선택한 항로 상세: ${selected.route.join(" → ")}</h4>
    ${routeStepsHTML(selected, budget)}
    <p class="hint">※ 같은 섬을 다시 들르는 경로(예: 3번째→4번째→3번째→2번째)는 첫 방문 때 산 만큼 재고가 줄어든 상태로 계산에 반영됩니다. 판매는 재고와 무관하게 언제든 가능하다고 가정합니다.</p>
  `;
}

function renderTradeTab(main) {
  const cur = state.currentChapter;
  const chapterData = getChapter(cur);

  const originSel = window.__tradeOrigin || ALL_OPTION;
  const destSel = window.__tradeDest || ALL_OPTION;

  const trades = [];
  ITEMS.forEach((it) => {
    const best = bestTradeForItem(chapterData, it, originSel, destSel);
    if (!best || best.margin <= -999999) return;
    trades.push({ item: it, best });
  });
  trades.sort((a, b) => b.best.margin - a.best.margin);

  const budgetPanel = document.createElement("div");
  budgetPanel.className = "panel";
  budgetPanel.innerHTML = `
    <div class="row">
      <label>가진 돈</label>
      <input type="number" id="budget-input" value="${state.budget || ""}" placeholder="예: 15000" style="width:110px">
      <span class="muted">아래 항로 추천과 예산 기반 구매 추천 모두 이 금액을 기준으로 계산합니다.</span>
    </div>
  `;
  main.appendChild(budgetPanel);

  const routePanel = document.createElement("div");
  routePanel.className = "panel";
  routePanel.innerHTML = `
    ${ringOrderPanelHTML()}
    <hr class="sep">
    <div class="row">
      <label>${cur}장 · 지금 배가 있는 섬 (이번 장 시작 위치)</label>
      <select id="route-start-island">
        <option value="" ${!chapterData.startIsland ? "selected" : ""}>처음 시작 (한가운데, 아무 섬이나 가능)</option>
        ${ISLANDS.map((isl) => `<option value="${isl}" ${chapterData.startIsland === isl ? "selected" : ""}>${isl}</option>`).join("")}
      </select>
      <span class="muted">지난 장 마지막에 도착해 있던 섬을 고르면, 그 섬에서 출발하는 항로만 추천합니다. 항해 맨 처음(1장 시작)이면 "처음 시작"으로 두세요.</span>
    </div>
    <div class="row">
      <label>이번 장, 몇 개 섬을 돌 예정인가요?</label>
      <select id="route-visit-count">
        ${[2, 3, 4]
          .map((n) => `<option value="${n}" ${n === (state.routeVisitCount || MAX_ROUTE_LEN) ? "selected" : ""}>${n}개 섬</option>`)
          .join("")}
      </select>
      <span class="muted">턴이 부족해서 3개 섬만 돌 계획이면 "3개 섬"을 골라보세요. 그 기준으로 최적 항로를 다시 계산합니다.</span>
    </div>
    <hr class="sep">
    ${commissionPanelHTML(chapterData)}
    <hr class="sep">
    <div id="recalc-panel">${recalcPanelHTML(chapterData)}</div>
    <hr class="sep">
    <div id="route-panel-body">${routeRecommendationBodyHTML(chapterData)}</div>
  `;
  main.appendChild(routePanel);

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="row">
      <label>${cur}장 · 지금 있는 섬</label>
      <select id="origin-select">
        <option value="${ALL_OPTION}" ${originSel === ALL_OPTION ? "selected" : ""}>전체 (아직 안 정함)</option>
        ${ISLANDS.map((isl) => `<option value="${isl}" ${isl === originSel ? "selected" : ""}>${isl}</option>`).join("")}
      </select>
      <label>→ 다음에 갈 섬</label>
      <select id="dest-select">
        <option value="${ALL_OPTION}" ${destSel === ALL_OPTION ? "selected" : ""}>전체 (자동으로 제일 좋은 섬 찾기)</option>
        ${ISLANDS.map((isl) => `<option value="${isl}" ${isl === destSel ? "selected" : ""}>${isl}</option>`).join("")}
      </select>
    </div>
    <p class="hint">한 구간(한 섬에서 사서 바로 다음 섬에서 파는 것)만 따로 확인하고 싶을 때 쓰는 도구예요. 여러 섬을 잇는 전체 항로 추천은 위 "🗺️ 이번 항해 섬 배치" 결과를 참고하세요.</p>
  `;
  main.appendChild(panel);

  const stockpilePanel = document.createElement("div");
  stockpilePanel.className = "panel";
  if (originSel === ALL_OPTION) {
    stockpilePanel.innerHTML = `
      <h3 style="margin-top:0;color:var(--accent)">이 섬에 남아서 사둘 것 추천 (평소 대비 저렴한 순)</h3>
      <p class="muted">다음 섬으로 이동할 턴이 부족해서 지금 섬에 계속 머물러야 할 때, 여기서 뭘 사서 다음 장에 팔지 정할 때 써보세요. 위에서 "지금 있는 섬"을 구체적으로 고르면 추천이 나옵니다.</p>
    `;
  } else {
    const rows = [];
    ITEMS.forEach((it) => {
      const cell = chapterData.prices[it.name][originSel];
      if (cell.buy === null || cell.buy === undefined) return;
      const stats = computeItemStats(it.name);
      const discountPct = stats.avgLowBuy ? ((stats.avgLowBuy - cell.buy) / stats.avgLowBuy) * 100 : null;
      rows.push({ item: it, buyPrice: cell.buy, stock: cell.stock, avgLowBuy: stats.avgLowBuy, discountPct, sampleCount: stats.lowBuyCount });
    });
    rows.sort((a, b) => {
      if (a.discountPct === null && b.discountPct === null) return a.buyPrice - b.buyPrice;
      if (a.discountPct === null) return 1;
      if (b.discountPct === null) return -1;
      return b.discountPct - a.discountPct;
    });
    stockpilePanel.innerHTML = `
      <h3 style="margin-top:0;color:var(--accent)">${originSel}에 남아서 사둘 것 추천 (평소 대비 저렴한 순)</h3>
      <p class="hint">다음 섬으로 이동할 턴이 부족할 때, 지금 섬에서 사서 다음 장에 파는 용도예요. "평소 낮은 평균"은 지금까지 이 품목의 장별 최저 구매가를 평균낸 값이고, 지금 가격이 그보다 쌀수록 순위가 높습니다.</p>
      <div class="table-wrap" style="max-height:none">
        <table>
          <thead><tr><th>품목</th><th>지금 구매가</th><th>평소 낮은 평균</th><th>할인율</th><th>기록된 장 수</th><th>재고</th></tr></thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      (r) => `<tr>
                <td class="item-name" style="position:static">${r.item.name}${r.item.exclusive ? `<span class="badge exclusive">${r.item.exclusive} 전용</span>` : ""}</td>
                <td>${fmt(r.buyPrice)}</td>
                <td>${r.avgLowBuy !== null ? fmt(Math.round(r.avgLowBuy)) : "-"}</td>
                <td class="${r.discountPct === null ? "" : r.discountPct >= 0 ? "profit-pos" : "profit-neg"}">${
                        r.discountPct === null ? "기록 부족" : `${r.discountPct >= 0 ? "▼" : "▲"} ${Math.abs(r.discountPct).toFixed(1)}%`
                      }</td>
                <td>${r.sampleCount}</td>
                <td>${fmt(r.stock)}</td>
              </tr>`
                    )
                    .join("")
                : `<tr><td colspan="6" class="muted">${originSel}에서 구매 가능한 품목이 없습니다.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }
  main.appendChild(stockpilePanel);

  const singleLegBudgetPanel = document.createElement("div");
  singleLegBudgetPanel.className = "panel";
  singleLegBudgetPanel.innerHTML = `
    <h3 style="margin-top:0;color:var(--accent)">이 구간만 볼 때, 예산 안에서 뭘 살지</h3>
    <p class="muted">위에서 고른 "지금 있는 섬 → 다음에 갈 섬" 조합 기준으로, 가진 돈 안에서 최대 이익이 나도록 뭘 얼마나 살지 계산합니다.</p>
    <div id="budget-result">${budgetPlanHTML(trades)}</div>
  `;
  main.appendChild(singleLegBudgetPanel);

  const resultPanel = document.createElement("div");
  resultPanel.className = "panel";
  const headingText =
    originSel === ALL_OPTION && destSel === ALL_OPTION
      ? "전체 조합 중 효율 순위"
      : originSel !== ALL_OPTION && destSel !== ALL_OPTION
      ? `${originSel} → ${destSel} 효율 순위`
      : originSel !== ALL_OPTION
      ? `${originSel}에서 살 것 (도착섬은 자동 최적)`
      : `${destSel}에서 팔 것 (출발섬은 자동 최적)`;

  resultPanel.innerHTML = `
    <h3 style="margin-top:0;color:var(--accent)">${headingText}</h3>
    <div class="table-wrap" style="max-height:none">
      <table>
        <thead><tr>
          <th>순위</th><th>품목</th><th>분류</th><th>구매처</th><th>판매처</th>
          <th>개당 마진</th><th>마진율</th><th>재고(구매/판매)</th><th>재고 기준 예상이익</th>
        </tr></thead>
        <tbody>
          ${
            trades.length
              ? trades
                  .map(({ item, best }, idx) => {
                    const marginPct = best.buyPrice ? ((best.margin / best.buyPrice) * 100).toFixed(1) : "-";
                    const maxQty = Math.min(best.buyStock ?? Infinity, best.sellStock ?? Infinity);
                    const potential = Number.isFinite(maxQty) ? maxQty * best.margin : null;
                    return `<tr>
                <td>${idx + 1}</td>
                <td class="item-name" style="position:static">${item.name}${item.exclusive ? `<span class="badge exclusive">${item.exclusive} 전용</span>` : ""}</td>
                <td><span class="badge cat">${item.category}</span></td>
                <td>${best.origin} (${fmt(best.buyPrice)})</td>
                <td>${best.dest} (${fmt(best.sellPrice)})</td>
                <td class="${best.margin >= 0 ? "profit-pos" : "profit-neg"}">${best.margin >= 0 ? "+" : ""}${fmt(best.margin)}</td>
                <td class="${best.margin >= 0 ? "profit-pos" : "profit-neg"}">${marginPct}%</td>
                <td>${fmt(best.buyStock)} / ${fmt(best.sellStock)}</td>
                <td class="${(potential ?? 0) >= 0 ? "profit-pos" : "profit-neg"}">${potential === null ? "-" : fmt(potential)}</td>
              </tr>`;
                  })
                  .join("")
              : `<tr><td colspan="9" class="muted">이 조합으로 거래 가능한 품목이 없습니다. 가격을 입력했는지, 산지 전용 품목 방향이 맞는지 확인하세요.</td></tr>`
          }
        </tbody>
      </table>
    </div>
    <p class="hint">※ 실제 섬 간 이동 턴/내구도는 매 항해마다 지형이 달라 자동 반영하지 못합니다. 돛단배(내구도 +350)를 지나는 경로가 있다면 우선하세요.</p>
  `;
  main.appendChild(resultPanel);

  document.getElementById("origin-select").addEventListener("change", (e) => {
    window.__tradeOrigin = e.target.value;
    render();
  });
  document.getElementById("dest-select").addEventListener("change", (e) => {
    window.__tradeDest = e.target.value;
    render();
  });
  document.getElementById("budget-input").addEventListener("input", (e) => {
    state.budget = Number(e.target.value) || 0;
    saveState();
    document.getElementById("budget-result").innerHTML = budgetPlanHTML(trades);
    const routeBody = document.getElementById("route-panel-body");
    if (routeBody) routeBody.innerHTML = routeRecommendationBodyHTML(chapterData);
    wireRoutePanelEvents(chapterData);
  });

  document.querySelectorAll("select[data-ring-idx]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.ringIdx);
      state.ringOrder[idx] = e.target.value || null;
      window.__selectedRouteKey = null;
      saveState();
      render();
    });
  });

  document.getElementById("route-visit-count").addEventListener("change", (e) => {
    state.routeVisitCount = Number(e.target.value);
    window.__selectedRouteKey = null;
    saveState();
    render();
  });

  document.getElementById("route-start-island").addEventListener("change", (e) => {
    chapterData.startIsland = e.target.value || null;
    window.__selectedRouteKey = null;
    saveState();
    render();
  });

  document.getElementById("commission-add-btn").addEventListener("click", () => {
    const item = document.getElementById("commission-item").value;
    const destIsland = document.getElementById("commission-dest").value;
    const reward = Number(document.getElementById("commission-reward").value) || 0;
    if (!reward) {
      alert("보상 금액을 입력하세요.");
      return;
    }
    if (!chapterData.commissions) chapterData.commissions = [];
    chapterData.commissions.push({ item, destIsland, reward });
    window.__selectedRouteKey = null;
    saveState();
    render();
  });

  document.querySelectorAll("[data-remove-commission]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.removeCommission);
      chapterData.commissions.splice(idx, 1);
      window.__selectedRouteKey = null;
      saveState();
      render();
    });
  });

  const recalcToggleBtn = document.getElementById("recalc-toggle-btn");
  if (recalcToggleBtn) {
    recalcToggleBtn.addEventListener("click", () => {
      window.__recalcFormOpen = true;
      window.__recalcStaging = {
        startIsland: chapterData.startIsland,
        budget: state.budget,
        cargo: (chapterData.currentCargo || []).map((c) => ({ ...c })),
      };
      render();
    });
  }

  const recalcCancelBtn = document.getElementById("recalc-cancel-btn");
  if (recalcCancelBtn) {
    recalcCancelBtn.addEventListener("click", () => {
      window.__recalcFormOpen = false;
      window.__recalcStaging = null;
      render();
    });
  }

  const recalcStartIslandSel = document.getElementById("recalc-start-island");
  if (recalcStartIslandSel) {
    recalcStartIslandSel.addEventListener("change", (e) => {
      window.__recalcStaging.startIsland = e.target.value || null;
    });
  }

  const recalcBudgetInput = document.getElementById("recalc-budget");
  if (recalcBudgetInput) {
    recalcBudgetInput.addEventListener("input", (e) => {
      window.__recalcStaging.budget = Number(e.target.value) || 0;
    });
  }

  const recalcCargoAddBtn = document.getElementById("recalc-cargo-add-btn");
  if (recalcCargoAddBtn) {
    recalcCargoAddBtn.addEventListener("click", () => {
      const itemName = document.getElementById("recalc-cargo-item").value;
      const qty = Number(document.getElementById("recalc-cargo-qty").value) || 0;
      if (qty <= 0) return;
      const cargo = window.__recalcStaging.cargo;
      const existing = cargo.find((c) => c.itemName === itemName);
      if (existing) existing.qty += qty;
      else cargo.push({ itemName, qty });
      render();
    });
  }

  document.querySelectorAll("[data-remove-cargo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.removeCargo);
      window.__recalcStaging.cargo.splice(idx, 1);
      render();
    });
  });

  const recalcApplyBtn = document.getElementById("recalc-apply-btn");
  if (recalcApplyBtn) {
    recalcApplyBtn.addEventListener("click", () => {
      const staging = window.__recalcStaging;
      chapterData.startIsland = staging.startIsland || null;
      state.budget = staging.budget || 0;
      chapterData.currentCargo = (staging.cargo || []).map((c) => ({ ...c }));
      window.__recalcFormOpen = false;
      window.__recalcStaging = null;
      window.__selectedRouteKey = null;
      saveState();
      render();
    });
  }

  wireRoutePanelEvents(chapterData);
}

function wireRoutePanelEvents(chapterData) {
  document.querySelectorAll("[data-route-key]").forEach((el) => {
    el.addEventListener("click", () => {
      window.__selectedRouteKey = el.dataset.routeKey;
      const routeBody = document.getElementById("route-panel-body");
      if (routeBody) routeBody.innerHTML = routeRecommendationBodyHTML(chapterData);
      wireRoutePanelEvents(chapterData);
    });
  });
}

// ---------- TAB 3: 구매 기록 ----------

function renderLedgerTab(main) {
  const cur = state.currentChapter;
  const chapterData = getChapter(cur);

  const formPanel = document.createElement("div");
  formPanel.className = "panel";
  formPanel.innerHTML = `
    <h3 style="margin-top:0;color:var(--accent)">새 구매 기록 추가</h3>
    <div class="row">
      <select id="ledger-item">
        ${ITEMS.map((it) => `<option value="${it.name}">${it.name}</option>`).join("")}
      </select>
      <select id="ledger-island">
        ${ISLANDS.map((isl) => `<option value="${isl}">${isl}</option>`).join("")}
      </select>
      <label>수량</label>
      <input type="number" id="ledger-qty" value="1" style="width:60px">
      <label>구매가(개당)</label>
      <input type="number" id="ledger-price" style="width:80px">
      <label>장</label>
      <input type="number" id="ledger-chapter" value="${cur}" style="width:60px">
      <button class="btn small" id="ledger-add-btn">추가</button>
    </div>
    <p class="hint">다음 항해 일지 장으로 넘어가기 전에, 팔려고 사둔 품목을 여기에 기록해두면 나중에 실제 판매가와 비교해 손익을 계산해줍니다.</p>
  `;
  main.appendChild(formPanel);

  const openItems = state.ledger.filter((l) => !l.sold);
  const closedItems = state.ledger.filter((l) => l.sold);

  const totalInvested = openItems.reduce((s, l) => s + l.qty * l.buyPrice, 0);
  const totalRealized = closedItems.reduce((s, l) => s + (l.sellPrice - l.buyPrice) * l.qty, 0);

  const summary = document.createElement("div");
  summary.className = "panel";
  summary.innerHTML = `
    <div class="summary-cards">
      <div class="card"><div class="label">보유 중 투자금</div><div class="value">${fmt(totalInvested)}</div></div>
      <div class="card"><div class="label">누적 실현 손익</div><div class="value ${totalRealized >= 0 ? "profit-pos" : "profit-neg"}">${fmt(totalRealized)}</div></div>
      <div class="card"><div class="label">보유 중 품목 수</div><div class="value">${openItems.length}</div></div>
    </div>
  `;
  main.appendChild(summary);

  const openPanel = document.createElement("div");
  openPanel.className = "panel";
  openPanel.innerHTML = `<h3 style="margin-top:0;color:var(--accent-2)">보유 중 (아직 안 판 것)</h3>`;
  if (!openItems.length) {
    openPanel.innerHTML += `<p class="muted">보유 중인 재고가 없습니다.</p>`;
  } else {
    openItems.forEach((l) => {
      const row = document.createElement("div");
      row.className = "ledger-item";
      row.innerHTML = `
        <div>
          <strong>${l.item}</strong>
          <span class="tag">${l.buyIsland}에서 ${l.qty}개</span>
          <span class="tag">개당 ${fmt(l.buyPrice)} (${l.chapterBought}장 구매)</span>
        </div>
        <div class="row" style="margin:0;gap:6px">
          <select data-role="sell-island">${ISLANDS.map((isl) => `<option value="${isl}">${isl}</option>`).join("")}</select>
          <input data-role="sell-price" type="number" placeholder="판매가" style="width:80px">
          <button class="btn small" data-role="sell-confirm" data-id="${l.id}">판매 처리</button>
          <button class="btn small secondary" data-role="delete" data-id="${l.id}">삭제</button>
        </div>
      `;
      openPanel.appendChild(row);
    });
  }
  main.appendChild(openPanel);

  const closedPanel = document.createElement("div");
  closedPanel.className = "panel";
  closedPanel.innerHTML = `<h3 style="margin-top:0;color:var(--accent-2)">판매 완료 내역</h3>`;
  if (!closedItems.length) {
    closedPanel.innerHTML += `<p class="muted">아직 판매 완료된 기록이 없습니다.</p>`;
  } else {
    closedItems
      .slice()
      .reverse()
      .forEach((l) => {
        const profit = (l.sellPrice - l.buyPrice) * l.qty;
        const row = document.createElement("div");
        row.className = "ledger-item";
        row.innerHTML = `
          <div>
            <strong>${l.item}</strong>
            <span class="tag">${l.buyIsland}(${fmt(l.buyPrice)}) → ${l.sellIsland}(${fmt(l.sellPrice)}) x ${l.qty}</span>
          </div>
          <div class="${profit >= 0 ? "profit-pos" : "profit-neg"}">${profit >= 0 ? "+" : ""}${fmt(profit)}</div>
        `;
        closedPanel.appendChild(row);
      });
  }
  main.appendChild(closedPanel);

  // events
  document.getElementById("ledger-add-btn").addEventListener("click", () => {
    const item = document.getElementById("ledger-item").value;
    const island = document.getElementById("ledger-island").value;
    const qty = Number(document.getElementById("ledger-qty").value) || 0;
    const price = Number(document.getElementById("ledger-price").value) || 0;
    const chapterBought = Number(document.getElementById("ledger-chapter").value) || cur;
    if (qty <= 0 || price <= 0) {
      alert("수량과 구매가를 입력하세요.");
      return;
    }
    state.ledger.push({
      id: Date.now() + Math.random(),
      item,
      buyIsland: island,
      qty,
      buyPrice: price,
      chapterBought,
      sold: false,
      sellIsland: null,
      sellPrice: null,
      chapterSold: null,
    });
    saveState();
    render();
  });

  openPanel.querySelectorAll('[data-role="sell-confirm"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const row = btn.closest(".ledger-item");
      const sellIsland = row.querySelector('[data-role="sell-island"]').value;
      const sellPrice = Number(row.querySelector('[data-role="sell-price"]').value);
      if (!sellPrice) {
        alert("판매가를 입력하세요.");
        return;
      }
      const entry = state.ledger.find((l) => l.id === id);
      entry.sold = true;
      entry.sellIsland = sellIsland;
      entry.sellPrice = sellPrice;
      entry.chapterSold = state.currentChapter;
      saveState();
      render();
    });
  });

  openPanel.querySelectorAll('[data-role="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      state.ledger = state.ledger.filter((l) => l.id !== id);
      saveState();
      render();
    });
  });

  document.getElementById("ledger-item").addEventListener("change", autofillLedgerPrice);
  document.getElementById("ledger-island").addEventListener("change", autofillLedgerPrice);

  function autofillLedgerPrice() {
    const item = document.getElementById("ledger-item").value;
    const island = document.getElementById("ledger-island").value;
    const cell = chapterData.prices[item] && chapterData.prices[item][island];
    if (cell && cell.buy !== null && cell.buy !== undefined) {
      document.getElementById("ledger-price").value = cell.buy;
    }
  }
  autofillLedgerPrice();
}

// ---------- TAB 4: 가격 히스토리 ----------

function renderHistoryTab(main) {
  const summaryPanel = document.createElement("div");
  summaryPanel.className = "panel";
  const statRows = ITEMS.map((it) => ({ item: it, stats: computeItemStats(it.name) }));
  summaryPanel.innerHTML = `
    <h3 style="margin-top:0;color:var(--accent)">품목별 평균 가격 (리셋해도 유지됨)</h3>
    <p class="hint">평소 낮은 구매가 평균 / 평소 높은 판매가 평균이에요. 지금 어떤 섬의 가격이 이 평균보다 유리하면 그때가 사거나 팔 타이밍입니다. 항해가 끝나서 리셋해도 이 평균은 계속 쌓입니다.</p>
    <div class="table-wrap" style="max-height:none">
      <table>
        <thead><tr><th>품목</th><th>평소 낮은 구매가 평균</th><th>평소 높은 판매가 평균</th><th>기록된 장 수</th></tr></thead>
        <tbody>
          ${statRows
            .map(
              ({ item, stats }) => `<tr>
            <td class="item-name" style="position:static">${item.name}${item.exclusive ? `<span class="badge exclusive">${item.exclusive} 전용</span>` : ""}</td>
            <td>${stats.avgLowBuy !== null ? fmt(Math.round(stats.avgLowBuy)) : "-"}</td>
            <td>${stats.avgHighSell !== null ? fmt(Math.round(stats.avgHighSell)) : "-"}</td>
            <td>${stats.lowBuyCount}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
  main.appendChild(summaryPanel);

  const panel = document.createElement("div");
  panel.className = "panel";
  const nums = chapterNums();
  const selectedItem = window.__historyItem || ITEMS[0].name;

  panel.innerHTML = `
    <div class="row">
      <label>품목 선택</label>
      <select id="history-item">
        ${ITEMS.map((it) => `<option value="${it.name}" ${it.name === selectedItem ? "selected" : ""}>${it.name}</option>`).join("")}
      </select>
      <span class="muted">장이 넘어갈 때마다 가격이 어떻게 변했는지 비교합니다.</span>
    </div>
  `;
  main.appendChild(panel);

  const tablePanel = document.createElement("div");
  tablePanel.className = "panel";
  let html = `<div class="table-wrap" style="max-height:none"><table><thead><tr><th>장</th>`;
  ISLANDS.forEach((isl) => (html += `<th>${isl}</th>`));
  html += `</tr></thead><tbody>`;
  nums.forEach((n) => {
    const grid = state.chapters[n].prices[selectedItem];
    html += `<tr><td class="item-name" style="position:static">${n}장</td>`;
    ISLANDS.forEach((isl) => {
      const cell = grid ? grid[isl] : null;
      html += `<td>${cell ? `구매 ${fmt(cell.buy)}<br>판매 ${fmt(cell.sell)}<br><span class="muted">재고 ${fmt(cell.stock)}</span>` : "-"}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table></div>";
  tablePanel.innerHTML = html;
  main.appendChild(tablePanel);

  if (nums.some((n) => state.chapters[n].notes)) {
    const notesPanel = document.createElement("div");
    notesPanel.className = "panel";
    notesPanel.innerHTML =
      `<h3 style="margin-top:0;color:var(--accent-2)">장별 특이사항 메모</h3>` +
      nums
        .filter((n) => state.chapters[n].notes)
        .map((n) => `<p class="hint"><strong>${n}장:</strong> ${state.chapters[n].notes}</p>`)
        .join("");
    main.appendChild(notesPanel);
  }

  document.getElementById("history-item").addEventListener("change", (e) => {
    window.__historyItem = e.target.value;
    render();
  });
}

// ---------- INIT ----------

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("nav.tabs button").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  render();
});
