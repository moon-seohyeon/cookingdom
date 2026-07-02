// 영광의 항로 무역 도우미 - 메인 로직

const STORAGE_KEY = "glory_route_trade_tracker_v1";

function emptyGrid() {
  const grid = {};
  ITEMS.forEach((it) => {
    grid[it.name] = {};
    ISLANDS.forEach((isl) => {
      const canBuy = !it.exclusive || it.exclusive === isl;
      grid[it.name][isl] = { buy: canBuy ? null : null, sell: null, stock: null };
    });
  });
  return grid;
}

function defaultState() {
  return {
    currentChapter: 1,
    chapters: {
      1: { prices: JSON.parse(JSON.stringify(SEED_CHAPTER_1)), notes: "" },
    },
    cargoCapacity: 50,
    ledger: [],
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed.chapters || !parsed.chapters[1]) return defaultState();
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
    state.chapters[num] = { prices: emptyGrid(), notes: "" };
  }
  return state.chapters[num];
}

function chapterNums() {
  return Object.keys(state.chapters)
    .map(Number)
    .sort((a, b) => a - b);
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

const TABS = ["price", "trade", "ledger", "history"];
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
      <span class="muted">품목별 구매가 / 판매가 / 재고량을 입력하세요. 산지 전용 품목은 원산지 섬만 구매 가능합니다.</span>
    </div>
    <div class="row" style="flex-direction:column;align-items:stretch;">
      <label>이번 장 특이사항 (돌발 이벤트, 환경 요소 등)</label>
      <textarea id="chapter-notes" placeholder="예: 감정가들의 섬에서 털뭉치 인형 구매가 감소 / 전체섬 코코넛 꽃게 재고 증가">${chapterData.notes || ""}</textarea>
    </div>
  `;
  main.appendChild(panel);

  const tablePanel = document.createElement("div");
  tablePanel.className = "panel";
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  let html = "<table><thead><tr><th>품목</th>";
  ISLANDS.forEach((isl) => (html += `<th>${isl}</th>`));
  html += "</tr></thead><tbody>";

  ITEMS.forEach((it) => {
    html += `<tr><td class="item-name">${it.name}<br><span class="badge cat">${it.category}</span>${
      it.exclusive ? `<span class="badge exclusive">${it.exclusive} 전용</span>` : ""
    }</td>`;
    ISLANDS.forEach((isl) => {
      const cell = chapterData.prices[it.name][isl];
      const canBuy = !it.exclusive || it.exclusive === isl;
      html += `<td><div class="cell-inputs">
        ${
          canBuy
            ? `<input type="number" data-item="${it.name}" data-island="${isl}" data-field="buy" value="${cell.buy ?? ""}" placeholder="구매">`
            : `<input type="number" disabled placeholder="구매불가" style="opacity:.35">`
        }
        <input type="number" data-item="${it.name}" data-island="${isl}" data-field="sell" value="${cell.sell ?? ""}" placeholder="판매">
        <input type="number" data-item="${it.name}" data-island="${isl}" data-field="stock" value="${cell.stock ?? ""}" placeholder="재고">
      </div></td>`;
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

  wrap.querySelectorAll("input[data-item]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const { item, island, field } = e.target.dataset;
      chapterData.prices[item][island][field] = parseNumOrNull(e.target.value);
      saveState();
    });
  });
}

// ---------- TAB 2: 거래 추천 ----------

function computeBestTrades(chapterData) {
  const results = [];
  ITEMS.forEach((it) => {
    const grid = chapterData.prices[it.name];
    let bestBuy = null;
    let bestSell = null;
    ISLANDS.forEach((isl) => {
      const cell = grid[isl];
      if (cell.buy !== null && cell.buy !== undefined) {
        if (!bestBuy || cell.buy < bestBuy.price) bestBuy = { island: isl, price: cell.buy, stock: cell.stock };
      }
      if (cell.sell !== null && cell.sell !== undefined) {
        if (!bestSell || cell.sell > bestSell.price) bestSell = { island: isl, price: cell.sell, stock: cell.stock };
      }
    });
    if (!bestBuy || !bestSell) return;
    // 같은 섬에서 사고 파는 조합은 제외하고 다음으로 좋은 판매처를 찾는다
    if (bestBuy.island === bestSell.island) {
      let alt = null;
      ISLANDS.forEach((isl) => {
        if (isl === bestBuy.island) return;
        const cell = grid[isl];
        if (cell.sell !== null && cell.sell !== undefined) {
          if (!alt || cell.sell > alt.price) alt = { island: isl, price: cell.sell, stock: cell.stock };
        }
      });
      bestSell = alt || bestSell;
    }
    const margin = bestSell.price - bestBuy.price;
    const maxQty = Math.min(
      state.cargoCapacity,
      bestBuy.stock ?? Infinity,
      bestSell.stock ?? Infinity
    );
    results.push({
      item: it.name,
      category: it.category,
      exclusive: it.exclusive,
      bestBuy,
      bestSell,
      margin,
      maxQty: Math.max(0, maxQty),
      totalProfit: margin * Math.max(0, maxQty),
    });
  });
  results.sort((a, b) => b.margin - a.margin);
  return results;
}

function renderTradeTab(main) {
  const cur = state.currentChapter;
  const chapterData = getChapter(cur);
  const trades = computeBestTrades(chapterData);

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `
    <div class="row">
      <label>${cur}장 기준 추천</label>
      <label>선적량(적재 가능 개수)</label>
      <input type="number" id="cargo-cap" value="${state.cargoCapacity}" style="width:80px">
      <span class="muted">무역품 화면에서 확인한 적재 한도를 입력하면 추천 수량이 그에 맞춰 계산됩니다.</span>
    </div>
  `;
  main.appendChild(panel);

  // 추천 조합 (greedy knapsack)
  let remaining = state.cargoCapacity;
  const picks = [];
  for (const t of trades) {
    if (remaining <= 0) break;
    if (t.margin <= 0) continue;
    const qty = Math.min(t.maxQty, remaining);
    if (qty <= 0) continue;
    picks.push({ ...t, qty, profit: qty * t.margin });
    remaining -= qty;
  }
  const totalProfit = picks.reduce((s, p) => s + p.profit, 0);
  const usedCapacity = state.cargoCapacity - remaining;

  const summary = document.createElement("div");
  summary.className = "panel";
  summary.innerHTML = `
    <h3 style="margin-top:0;color:var(--accent)">이번 장 추천 조합 (마진 높은 순으로 선적량까지 채움)</h3>
    <div class="summary-cards">
      <div class="card"><div class="label">예상 총 이익</div><div class="value">${fmt(totalProfit)}</div></div>
      <div class="card"><div class="label">사용 선적량</div><div class="value">${usedCapacity} / ${state.cargoCapacity}</div></div>
      <div class="card"><div class="label">추천 품목 수</div><div class="value">${picks.length}</div></div>
    </div>
    <div class="table-wrap" style="max-height:none">
      <table>
        <thead><tr><th>품목</th><th>구매처</th><th>판매처</th><th>개당 마진</th><th>수량</th><th>예상 이익</th></tr></thead>
        <tbody>
          ${
            picks.length
              ? picks
                  .map(
                    (p) => `<tr>
              <td class="item-name" style="position:static">${p.item}${p.exclusive ? `<span class="badge exclusive">전용</span>` : ""}</td>
              <td>${p.bestBuy.island} (${fmt(p.bestBuy.price)})</td>
              <td>${p.bestSell.island} (${fmt(p.bestSell.price)})</td>
              <td class="profit-pos">+${fmt(p.margin)}</td>
              <td>${p.qty}</td>
              <td class="profit-pos">+${fmt(p.profit)}</td>
            </tr>`
                  )
                  .join("")
              : `<tr><td colspan="6" class="muted">추천할 수 있는 거래가 없습니다. 가격을 입력했는지 확인하세요.</td></tr>`
          }
        </tbody>
      </table>
    </div>
    <p class="hint">※ 실제 섬 간 이동 턴/내구도는 매 항해마다 지형이 달라 자동 반영하지 못합니다. 위 추천은 "무엇을 어디서 사서 어디서 팔면 이득인지"만 계산한 것이니, 실제 경로는 지도를 보며 이 목록을 참고해 직접 정하세요. 돛단배(내구도 +350)를 지나는 경로가 있다면 우선하세요.</p>
  `;
  main.appendChild(summary);

  const allPanel = document.createElement("div");
  allPanel.className = "panel";
  allPanel.innerHTML = `
    <h3 style="margin-top:0;color:var(--accent-2)">전체 품목 마진 순위</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>품목</th><th>분류</th><th>최저 구매처</th><th>최고 판매처</th><th>개당 마진</th><th>최대 구매가능</th><th>총 잠재이익</th></tr></thead>
        <tbody>
          ${trades
            .map(
              (t) => `<tr>
            <td class="item-name" style="position:static">${t.item}${t.exclusive ? `<span class="badge exclusive">${t.exclusive} 전용</span>` : ""}</td>
            <td><span class="badge cat">${t.category}</span></td>
            <td>${t.bestBuy.island} (${fmt(t.bestBuy.price)})</td>
            <td>${t.bestSell.island} (${fmt(t.bestSell.price)})</td>
            <td class="${t.margin >= 0 ? "profit-pos" : "profit-neg"}">${t.margin >= 0 ? "+" : ""}${fmt(t.margin)}</td>
            <td>${t.maxQty}</td>
            <td class="${t.totalProfit >= 0 ? "profit-pos" : "profit-neg"}">${fmt(t.totalProfit)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
  main.appendChild(allPanel);

  document.getElementById("cargo-cap").addEventListener("input", (e) => {
    state.cargoCapacity = Number(e.target.value) || 0;
    saveState();
    render();
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
          <select data-role="sell-island">${ISLANDS.map((isl) => `<option ${isl === l.buyIsland ? "" : ""} value="${isl}">${isl}</option>`).join("")}</select>
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

  document.getElementById("ledger-item").addEventListener("change", (e) => {
    autofillLedgerPrice();
  });
  document.getElementById("ledger-island").addEventListener("change", (e) => {
    autofillLedgerPrice();
  });

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

  if (state.chapters[state.currentChapter]?.notes || Object.values(state.chapters).some((c) => c.notes)) {
    const notesPanel = document.createElement("div");
    notesPanel.className = "panel";
    notesPanel.innerHTML = `<h3 style="margin-top:0;color:var(--accent-2)">장별 특이사항 메모</h3>` +
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
