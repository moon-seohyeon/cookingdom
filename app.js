// 영광의 항로 무역 도우미 - 메인 로직

const STORAGE_KEY = "glory_route_trade_tracker_v2";

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
      1: { prices: JSON.parse(JSON.stringify(SEED_CHAPTER_1)), notes: "" },
    },
    ledger: [],
    budget: 0,
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
    </div>
    <p class="hint">품목별 구매가 / 판매가 / 재고량을 섬마다 입력하세요. 산지 전용 품목은 원산지 섬 외에는 구매 칸이 비활성화됩니다.</p>
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

function renderTradeTab(main) {
  const cur = state.currentChapter;
  const chapterData = getChapter(cur);

  const originSel = window.__tradeOrigin || ALL_OPTION;
  const destSel = window.__tradeDest || ALL_OPTION;

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
    <p class="hint">지금 있는 섬과 다음에 갈 섬을 고르면, 거기서 사서 저기서 팔았을 때 이득이 큰 순서대로 정렬해줘요. 아직 못 정했으면 "전체"로 두면 가능한 모든 조합 중 최선을 찾아줍니다.</p>
  `;
  main.appendChild(panel);

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
      <span class="muted">위에서 고른 섬 조합 기준으로, 이 돈으로 최대 이익이 나도록 뭘 얼마나 살지 계산합니다.</span>
    </div>
    <div id="budget-result">${budgetPlanHTML(trades)}</div>
  `;
  main.appendChild(budgetPanel);

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
