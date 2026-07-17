import { firebaseConfig, ADMIN_PIN } from "./firebase-config.js";
import { MATERIAL_CATEGORIES, MEMBERS_SEED, LEVELS } from "./data.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
// 설정 확인
// ---------------------------------------------------------------------------
const isConfigured = Object.values(firebaseConfig).every(
  (v) => v && !String(v).includes("REPLACE_ME")
);

if (!isConfigured) {
  document.getElementById("app").innerHTML = `
    <div class="setup-notice">
      <strong>⚠️ 아직 설정이 끝나지 않았어요.</strong><br><br>
      <code>dontstarve/firebase-config.js</code> 파일에 Firebase 프로젝트 설정값과 관리자 PIN을
      입력해야 앱이 동작합니다.
    </div>`;
  throw new Error("firebase-config.js not configured yet");
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const escapeHtml = (str) =>
  String(str ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const genId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------------------
// 관리자 모드
// ---------------------------------------------------------------------------
let isAdmin = localStorage.getItem("ds_admin") === "true";

const adminStatusEl = document.getElementById("admin-status");
const adminToggleBtn = document.getElementById("admin-toggle-btn");

function updateAdminBar() {
  if (isAdmin) {
    adminStatusEl.textContent = "🔓 관리자 모드";
    adminStatusEl.classList.add("is-admin");
    adminToggleBtn.textContent = "로그아웃";
  } else {
    adminStatusEl.textContent = "👀 뷰어 모드";
    adminStatusEl.classList.remove("is-admin");
    adminToggleBtn.textContent = "🔑 관리자 로그인";
  }
}

adminToggleBtn.addEventListener("click", () => {
  if (isAdmin) {
    if (confirm("관리자 모드를 종료할까요?")) {
      isAdmin = false;
      localStorage.removeItem("ds_admin");
      updateAdminBar();
      renderAll();
    }
    return;
  }
  const input = prompt("관리자 PIN을 입력하세요");
  if (input === null) return;
  if (input === ADMIN_PIN) {
    isAdmin = true;
    localStorage.setItem("ds_admin", "true");
    updateAdminBar();
    renderAll();
  } else {
    alert("PIN이 올바르지 않아요.");
  }
});

updateAdminBar();

// ---------------------------------------------------------------------------
// 탭 전환
// ---------------------------------------------------------------------------
document.getElementById("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
  const tab = btn.dataset.tab;
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${tab}`).classList.add("active");
});

function renderAll() {
  renderGoal();
  renderMaterials();
  renderMembers();
  renderNotes();
}

// ---------------------------------------------------------------------------
// 1. 재료 현황
// ---------------------------------------------------------------------------
let materialsState = {};

async function ensureSeedMaterials() {
  const snap = await getDocs(collection(db, "materials"));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  MATERIAL_CATEGORIES.forEach((cat) => {
    cat.items.forEach((item) => {
      batch.set(doc(db, "materials", item.id), {
        name: item.name,
        category: cat.id,
        status: "보통",
        updatedAt: serverTimestamp(),
      });
    });
  });
  await batch.commit();
}

function renderMaterials() {
  const el = document.getElementById("view-materials");
  if (Object.keys(materialsState).length === 0) {
    el.innerHTML = `<div class="empty-state">불러오는 중...</div>`;
    return;
  }
  el.innerHTML = MATERIAL_CATEGORIES.map((cat) => {
    const cards = cat.items
      .map((item) => {
        const data = materialsState[item.id];
        const status = data ? data.status : "보통";
        const buttons = ["많음", "보통", "적음"]
          .map(
            (s) =>
              `<button class="status-btn${s === status ? " active" : ""}" data-status="${s}" data-id="${item.id}">${s}</button>`
          )
          .join("");
        return `<div class="material-card">
          <div class="material-name">${escapeHtml(item.name)}</div>
          <div class="status-toggle">${buttons}</div>
        </div>`;
      })
      .join("");
    return `<div class="material-category">
      <h3>${cat.label}</h3>
      <div class="material-grid">${cards}</div>
    </div>`;
  }).join("");
}

document.getElementById("view-materials").addEventListener("click", async (e) => {
  const btn = e.target.closest(".status-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  const status = btn.dataset.status;
  try {
    await updateDoc(doc(db, "materials", id), { status, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error(err);
    alert("저장에 실패했어요. 네트워크를 확인해주세요.");
  }
});

// ---------------------------------------------------------------------------
// 2. 팀원 미션
// ---------------------------------------------------------------------------
let membersState = {};

async function ensureSeedMembers() {
  const snap = await getDocs(collection(db, "members"));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  MEMBERS_SEED.forEach((m) => {
    batch.set(doc(db, "members", m.id), {
      name: m.name,
      character: m.character,
      pinned: !!m.pinned,
      missions: [],
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

function getLevel(score) {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (score >= l.min) idx = i;
  });
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1];
  const pct = next
    ? Math.min(100, Math.round(((score - cur.min) / (next.min - cur.min)) * 100))
    : 100;
  return { level: idx + 1, title: cur.title, emoji: cur.emoji, next, pct };
}

function sortedMemberIds() {
  const ids = Object.keys(membersState);
  return ids.sort((a, b) => {
    const ma = membersState[a];
    const mb = membersState[b];
    if (ma.pinned && !mb.pinned) return -1;
    if (!ma.pinned && mb.pinned) return 1;
    return ma.name.localeCompare(mb.name, "ko");
  });
}

function scoreOf(member) {
  return (member.missions || [])
    .filter((m) => m.status === "success")
    .reduce((sum, m) => sum + (m.points || 0), 0);
}

function rankMap() {
  const entries = Object.entries(membersState).map(([id, m]) => [id, scoreOf(m)]);
  entries.sort((a, b) => b[1] - a[1]);
  const map = {};
  entries.forEach(([id], i) => (map[id] = i + 1));
  return map;
}

const RANK_BADGE = { 1: "🥇", 2: "🥈", 3: "🥉" };

function renderMembers() {
  const el = document.getElementById("view-members");
  if (Object.keys(membersState).length === 0) {
    el.innerHTML = `<div class="empty-state">불러오는 중...</div>`;
    return;
  }
  const ranks = rankMap();
  const order = sortedMemberIds();

  const addMemberForm = isAdmin
    ? `<form class="add-member-form" data-form="add-member">
        <input type="text" name="name" placeholder="이름" required>
        <input type="text" name="character" placeholder="캐릭터/역할">
        <button type="submit" class="btn-primary">+ 팀원 추가</button>
      </form>`
    : "";

  const cards = order
    .map((id) => {
      const m = membersState[id];
      const score = scoreOf(m);
      const lvl = getLevel(score);
      const rank = ranks[id];
      const badge = RANK_BADGE[rank] || `#${rank}`;
      const missions = m.missions || [];

      const missionRows = missions.length
        ? missions
            .map((mission) => {
              const actions =
                isAdmin && mission.status === "pending"
                  ? `<button class="btn-small" data-action="mission-success" data-member="${id}" data-mission="${mission.id}">✅ 성공</button>
                     <button class="btn-small" data-action="mission-fail" data-member="${id}" data-mission="${mission.id}">❌ 실패</button>`
                  : isAdmin
                  ? `<button class="btn-small" data-action="mission-reset" data-member="${id}" data-mission="${mission.id}">↺ 되돌리기</button>`
                  : "";
              const statusLabel =
                mission.status === "success" ? "성공" : mission.status === "fail" ? "실패" : "대기";
              return `<div class="mission-row">
                <span class="mission-text">${escapeHtml(mission.text)}</span>
                <span class="mission-points">+${mission.points}</span>
                <span class="mission-status ${mission.status}">${statusLabel}</span>
                ${actions}
              </div>`;
            })
            .join("")
        : `<div class="mission-empty">아직 등록된 미션이 없어요.</div>`;

      const missionForm = isAdmin
        ? `<form class="mission-form" data-form="add-mission" data-member="${id}">
            <input type="text" name="text" placeholder="미션 내용" required>
            <input type="number" name="points" placeholder="점수" min="1" value="10" required>
            <button type="submit" class="btn-small">+ 미션 추가</button>
          </form>`
        : "";

      return `<div class="member-card">
        <div class="member-head">
          <span class="rank-badge">${badge}</span>
          <span class="member-name">${escapeHtml(m.name)}</span>
          <span class="member-character">(${escapeHtml(m.character || "")})</span>
          <div class="member-level">
            ${lvl.emoji} Lv.${lvl.level} ${lvl.title}
            <div class="member-score">기여도 ${score}점${lvl.next ? ` · 다음 레벨까지 ${lvl.next.min - score}점` : " · 최고 레벨"}</div>
          </div>
        </div>
        <div class="level-bar-track"><div class="level-bar-fill" style="width:${lvl.pct}%"></div></div>
        <div class="mission-list">${missionRows}</div>
        ${missionForm}
      </div>`;
    })
    .join("");

  el.innerHTML = addMemberForm + cards;
}

document.getElementById("view-members").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const memberId = btn.dataset.member;
  const missionId = btn.dataset.mission;
  const member = membersState[memberId];
  if (!member) return;
  const missions = (member.missions || []).map((m) =>
    m.id === missionId
      ? { ...m, status: btn.dataset.action === "mission-success" ? "success" : btn.dataset.action === "mission-fail" ? "fail" : "pending" }
      : m
  );
  try {
    await updateDoc(doc(db, "members", memberId), { missions });
  } catch (err) {
    console.error(err);
    alert("저장에 실패했어요.");
  }
});

document.getElementById("view-members").addEventListener("submit", async (e) => {
  const form = e.target.closest("[data-form]");
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === "add-mission") {
    const memberId = form.dataset.member;
    const text = form.elements["text"].value.trim();
    const points = parseInt(form.elements["points"].value, 10);
    if (!text || !points) return;
    const member = membersState[memberId];
    const missions = [
      ...(member.missions || []),
      { id: genId("mis"), text, points, status: "pending", createdAt: Date.now() },
    ];
    try {
      await updateDoc(doc(db, "members", memberId), { missions });
      form.reset();
      form.elements["points"].value = 10;
    } catch (err) {
      console.error(err);
      alert("저장에 실패했어요.");
    }
  } else if (form.dataset.form === "add-member") {
    const name = form.elements["name"].value.trim();
    const character = form.elements["character"].value.trim();
    if (!name) return;
    try {
      await setDoc(doc(db, "members", genId("m")), {
        name,
        character,
        pinned: false,
        missions: [],
        createdAt: serverTimestamp(),
      });
      form.reset();
    } catch (err) {
      console.error(err);
      alert("저장에 실패했어요.");
    }
  }
});

// ---------------------------------------------------------------------------
// 3. 몬스터 사냥 목표 (상단 배너)
// ---------------------------------------------------------------------------
let goalState = null;
let goalEditing = false;

function renderGoal() {
  const el = document.getElementById("goal-banner");
  const text = goalState && goalState.text ? goalState.text : "";

  if (isAdmin && goalEditing) {
    el.innerHTML = `
      <div class="goal-label">🎯 이번 판 사냥 목표</div>
      <textarea class="goal-edit" id="goal-edit-input" placeholder="이번 판에서 잡을 몬스터/목표를 적어주세요">${escapeHtml(text)}</textarea>
      <button class="btn-small" data-action="goal-save">저장</button>
      <button class="btn-small" data-action="goal-cancel">취소</button>
    `;
    return;
  }

  el.innerHTML = `
    <div class="goal-label">🎯 이번 판 사냥 목표</div>
    <div class="goal-text${text ? "" : " placeholder"}">${text ? escapeHtml(text) : "아직 목표가 설정되지 않았어요."}</div>
    ${isAdmin ? `<button class="btn-small" data-action="goal-edit">✏️ 목표 수정</button>` : ""}
  `;
}

document.getElementById("goal-banner").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "goal-edit") {
    goalEditing = true;
    renderGoal();
  } else if (btn.dataset.action === "goal-cancel") {
    goalEditing = false;
    renderGoal();
  } else if (btn.dataset.action === "goal-save") {
    const text = document.getElementById("goal-edit-input").value.trim();
    try {
      await setDoc(doc(db, "meta", "goal"), { text, updatedAt: serverTimestamp() }, { merge: true });
      goalEditing = false;
      renderGoal();
    } catch (err) {
      console.error(err);
      alert("저장에 실패했어요.");
    }
  }
});

// ---------------------------------------------------------------------------
// 4. 게임 종료 메모
// ---------------------------------------------------------------------------
let notesState = [];

function renderNotes() {
  const el = document.getElementById("view-notes");
  const form = isAdmin
    ? `<form class="add-note-form" data-form="add-note">
        <textarea name="text" placeholder="이번 판 끝! 다음 판 시작 전에 뭘 해둘지 적어보세요." required></textarea>
        <button type="submit" class="btn-primary">메모 추가</button>
      </form>`
    : "";

  const list = notesState.length
    ? notesState
        .map((n) => {
          const date = n.createdAt ? n.createdAt.toDate().toLocaleString("ko-KR") : "";
          const del = isAdmin
            ? `<button class="btn-danger" data-action="note-delete" data-id="${n.id}">✕</button>`
            : "";
          return `<div class="note-card">
            <div class="note-date"><span>${escapeHtml(date)}</span>${del}</div>
            <div class="note-text">${escapeHtml(n.text)}</div>
          </div>`;
        })
        .join("")
    : `<div class="empty-state">아직 작성된 메모가 없어요.</div>`;

  el.innerHTML = form + list;
}

document.getElementById("view-notes").addEventListener("submit", async (e) => {
  const form = e.target.closest('[data-form="add-note"]');
  if (!form) return;
  e.preventDefault();
  const text = form.elements["text"].value.trim();
  if (!text) return;
  try {
    await addDoc(collection(db, "gameNotes"), { text, createdAt: serverTimestamp() });
    form.reset();
  } catch (err) {
    console.error(err);
    alert("저장에 실패했어요.");
  }
});

document.getElementById("view-notes").addEventListener("click", async (e) => {
  const btn = e.target.closest('[data-action="note-delete"]');
  if (!btn) return;
  if (!confirm("이 메모를 삭제할까요?")) return;
  try {
    await deleteDoc(doc(db, "gameNotes", btn.dataset.id));
  } catch (err) {
    console.error(err);
    alert("삭제에 실패했어요.");
  }
});

// ---------------------------------------------------------------------------
// 초기화 & 실시간 구독
// ---------------------------------------------------------------------------
async function init() {
  await Promise.all([ensureSeedMaterials(), ensureSeedMembers()]);

  onSnapshot(collection(db, "materials"), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "removed") delete materialsState[change.doc.id];
      else materialsState[change.doc.id] = change.doc.data();
    });
    renderMaterials();
  });

  onSnapshot(collection(db, "members"), (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "removed") delete membersState[change.doc.id];
      else membersState[change.doc.id] = change.doc.data();
    });
    renderMembers();
  });

  onSnapshot(doc(db, "meta", "goal"), (snap) => {
    goalState = snap.exists() ? snap.data() : null;
    renderGoal();
  });

  onSnapshot(query(collection(db, "gameNotes"), orderBy("createdAt", "desc")), (snap) => {
    notesState = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderNotes();
  });
}

init().catch((err) => {
  console.error(err);
  document.getElementById("app").innerHTML = `
    <div class="setup-notice">
      <strong>⚠️ Firebase 연결에 실패했어요.</strong><br><br>
      firebase-config.js의 설정값이 올바른지, Firestore Database가 생성되어 있는지 확인해주세요.<br>
      에러: ${escapeHtml(err.message)}
    </div>`;
});
