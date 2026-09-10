import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAhWhaYQhd701jRf5IbS772Tw8qC3PDrrI",
  authDomain: "contador-compartido.firebaseapp.com",
  projectId: "contador-compartido",
  storageBucket: "contador-compartido.firebasestorage.app",
  messagingSenderId: "596927392199",
  appId: "1:596927392199:web:c11bfc5287aa29bf5391e2"
};

const firebaseReady = !firebaseConfig.apiKey.startsWith('TU_') && !firebaseConfig.projectId.startsWith('TU_');
const app = firebaseReady ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

const state = {
  user: null,
  demo: false,
  counters: [],
  allEvents: [],
  currentTab: 'audit',
  unsubscribeCounters: null,
  eventUnsubscribes: new Map()
};

const $ = (id) => document.getElementById(id);
const els = {
  userMenu: $('user-menu'),
  topbarLogout: $('topbar-logout'),
  connectionLabel: $('connection-label'),
  panelUserName: $('panel-user-name'),
  globalUserRole: $('global-user-role'),
  tabAudit: $('tab-audit'),
  tabTrash: $('tab-trash'),
  tabUsers: $('tab-users'),
  trashBadge: $('trash-badge'),
  usersBadge: $('users-badge'),
  auditSection: $('audit-section'),
  trashSection: $('trash-section'),
  usersSection: $('users-section'),
  usersOwnerBanner: $('users-owner-banner'),
  usersNonownerBanner: $('users-nonowner-banner'),
  usersSearch: $('users-search'),
  filterUserCounter: $('filter-user-counter'),
  usersRecordsCount: $('users-records-count'),
  auditRecordsCount: $('audit-records-count'),
  metricTotalEvents: $('metric-total-events'),
  metricTotalPlus: $('metric-total-plus'),
  metricTotalMinus: $('metric-total-minus'),
  metricActiveCounters: $('metric-active-counters'),
  auditSearch: $('audit-search'),
  filterCounter: $('filter-counter'),
  filterAction: $('filter-action'),
  filterDateFrom: $('filter-date-from'),
  filterDateTo: $('filter-date-to'),
  exportCsv: $('export-csv'),
  clearFilters: $('clear-filters'),
  auditTbody: $('audit-tbody'),
  usersTbody: $('users-tbody'),
  trashGrid: $('trash-grid'),
  trashEmptyState: $('trash-empty-state'),
  emptyTrashBtn: $('empty-trash-btn'),
  toast: $('toast')
};

function showToast(message, error = false) {
  els.toast.textContent = message;
  els.toast.className = `toast visible${error ? ' error' : ''}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.className = 'toast';
  }, 3200);
}

function initials(name = 'Tu cuenta') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function timestampValue(value) {
  if (!value) return 0;
  const date = value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const time = timestampValue(value);
  return time
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time))
    : 'Fecha pendiente';
}

function formatDateTime(value) {
  const time = timestampValue(value);
  return time
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(time))
    : 'Registrando...';
}

function timeAgo(date) {
  if (!date) return 'Ahora';
  const value = date.toDate ? date.toDate() : new Date(date);
  const seconds = Math.floor((Date.now() - value.getTime()) / 1000);
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return `Hace ${Math.floor(seconds / 86400)} d`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[char]));
}

function getUserRole(counter) {
  if (!counter) return 'Visualizador';
  if (state.demo) {
    if (counter.ownerId === 'demo' || !counter.ownerId) return 'Propietario';
    const found = counter.members?.find((m) => m.name === 'Tú' || m.email === 'tú');
    return found?.role || 'Propietario';
  }
  if (state.user && counter.ownerId === state.user.uid) {
    return 'Propietario';
  }
  const userEmail = state.user?.email?.toLowerCase();
  const userId = state.user?.uid;
  const member = counter.members?.find((m) =>
    (m.email && m.email.toLowerCase() === userEmail) ||
    (m.userId && m.userId === userId)
  );
  return member?.role || 'Operador';
}

function updateGlobalRole() {
  let highest = 'Visualizador';
  const roles = state.counters.map(getUserRole);
  if (roles.includes('Propietario') || state.demo) highest = 'Propietario';
  else if (roles.includes('Administrador')) highest = 'Administrador';
  else if (roles.includes('Operador')) highest = 'Operador';

  els.globalUserRole.textContent = highest;
  els.globalUserRole.className = `role-badge ${
    highest === 'Propietario' ? 'owner' :
    highest === 'Administrador' ? 'admin' :
    highest === 'Operador' ? 'editor' : 'viewer'
  }`;

  const isAnyOwner = highest === 'Propietario';
  els.emptyTrashBtn.disabled = !isAnyOwner;
  els.emptyTrashBtn.title = isAnyOwner
    ? 'Vaciar permanentemente los contadores de los cuales eres Propietario'
    : 'Solo el Propietario puede vaciar la papelera de la base de datos';
}

function getDaysRemaining(counter) {
  const deletedTime = timestampValue(counter.deletedAt) || timestampValue(counter.updatedAt) || Date.now();
  const elapsed = Date.now() - deletedTime;
  const retentionMs = 30 * 24 * 60 * 60 * 1000;
  const remainingMs = retentionMs - elapsed;
  const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

function demoData() {
  try {
    return JSON.parse(localStorage.getItem('cuenta-juntos-demo') || 'null') || { counters: [] };
  } catch {
    return { counters: [] };
  }
}

function saveDemo(data) {
  localStorage.setItem('cuenta-juntos-demo', JSON.stringify(data));
}

function switchTab(tab) {
  state.currentTab = tab;
  els.tabAudit.classList.toggle('active', tab === 'audit');
  els.tabTrash.classList.toggle('active', tab === 'trash');
  if (els.tabUsers) els.tabUsers.classList.toggle('active', tab === 'users');

  els.auditSection.classList.toggle('hidden', tab !== 'audit');
  els.trashSection.classList.toggle('hidden', tab !== 'trash');
  if (els.usersSection) els.usersSection.classList.toggle('hidden', tab !== 'users');

  if (tab === 'trash') {
    renderTrash();
  } else if (tab === 'users') {
    renderUsers();
  } else {
    renderAudit();
  }
}

function getAvailableCountersForFilters() {
  const from = els.filterDateFrom.value ? new Date(`${els.filterDateFrom.value}T00:00:00`) : null;
  const to = els.filterDateTo.value ? new Date(`${els.filterDateTo.value}T23:59:59`) : null;

  const counterMap = new Map();

  state.allEvents.forEach((ev) => {
    const evTime = timestampValue(ev.createdAt || ev.at);
    const evDate = evTime ? new Date(evTime) : null;
    const matchesFrom = !from || (evDate && evDate >= from);
    const matchesTo = !to || (evDate && evDate <= to);

    if (matchesFrom && matchesTo && ev.counterId) {
      const current = counterMap.get(ev.counterId) || 0;
      counterMap.set(ev.counterId, current + 1);
    }
  });

  if (!from && !to) {
    return state.counters.map((c) => ({
      ...c,
      eventCount: counterMap.get(c.id) || 0
    }));
  }

  // Check if counter was created in that date range even without movements
  state.counters.forEach((c) => {
    const createdTime = timestampValue(c.createdAt);
    const createdDate = createdTime ? new Date(createdTime) : null;
    const matchesFrom = !from || (createdDate && createdDate >= from);
    const matchesTo = !to || (createdDate && createdDate <= to);
    if (matchesFrom && matchesTo && !counterMap.has(c.id)) {
      counterMap.set(c.id, 0);
    }
  });

  return state.counters
    .filter((c) => counterMap.has(c.id))
    .map((c) => ({
      ...c,
      eventCount: counterMap.get(c.id) || 0
    }));
}

function updateClearFiltersButton() {
  if (!els.clearFilters) return;
  const hasFilter = Boolean(
    els.auditSearch.value.trim() ||
    els.filterCounter.value !== 'all' ||
    els.filterAction.value !== 'all' ||
    els.filterDateFrom.value ||
    els.filterDateTo.value
  );
  els.clearFilters.classList.toggle('hidden', !hasFilter);
}

function clearAllFilters() {
  els.auditSearch.value = '';
  els.filterDateFrom.value = '';
  els.filterDateTo.value = '';
  els.filterAction.value = 'all';
  populateCounterFilter();
  els.filterCounter.value = 'all';
  renderAudit();
  showToast('Filtros restablecidos');
}

function populateCounterFilter() {
  const currentVal = els.filterCounter.value;
  const hasDateFilter = Boolean(els.filterDateFrom.value || els.filterDateTo.value);
  const available = getAvailableCountersForFilters();

  els.filterCounter.innerHTML = '';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = 'all';
  defaultOpt.textContent = hasDateFilter
    ? `Todos los contadores en este rango (${available.length})`
    : `Todos los contadores (${state.counters.length})`;
  els.filterCounter.appendChild(defaultOpt);

  if (hasDateFilter && !available.length) {
    const noneOpt = document.createElement('option');
    noneOpt.value = 'none';
    noneOpt.disabled = true;
    noneOpt.textContent = 'Ningún contador activo en estas fechas';
    els.filterCounter.appendChild(noneOpt);
  }

  available.forEach((counter) => {
    const opt = document.createElement('option');
    opt.value = counter.id;
    const extra = counter.eventCount > 0 ? ` (${counter.eventCount} mov.)` : ' (0 mov.)';
    const inTrash = counter.deleted ? ' [Papelera]' : '';
    opt.textContent = `${counter.name}${inTrash}${extra}`;
    els.filterCounter.appendChild(opt);
  });

  if (available.some((c) => c.id === currentVal)) {
    els.filterCounter.value = currentVal;
  } else {
    els.filterCounter.value = 'all';
  }
}

function renderMetrics(filteredEvents) {
  const totalEvents = filteredEvents.length;
  let totalPlus = 0;
  let totalMinus = 0;

  filteredEvents.forEach((ev) => {
    if (ev.delta > 0) totalPlus += ev.delta;
    if (ev.delta < 0) totalMinus += Math.abs(ev.delta);
  });

  const hasDateFilter = Boolean(els.filterDateFrom.value || els.filterDateTo.value);
  const activeCountersCount = hasDateFilter
    ? getAvailableCountersForFilters().filter((c) => !c.deleted).length
    : state.counters.filter((c) => !c.deleted).length;

  els.metricTotalEvents.textContent = totalEvents.toLocaleString('es-ES');
  els.metricTotalPlus.textContent = `+${totalPlus.toLocaleString('es-ES')}`;
  els.metricTotalMinus.textContent = `−${totalMinus.toLocaleString('es-ES')}`;
  els.metricActiveCounters.textContent = activeCountersCount;
}

function getFilteredEvents() {
  const search = els.auditSearch.value.trim().toLowerCase();
  const selectedCounterId = els.filterCounter.value;
  const selectedAction = els.filterAction.value;
  const from = els.filterDateFrom.value ? new Date(`${els.filterDateFrom.value}T00:00:00`) : null;
  const to = els.filterDateTo.value ? new Date(`${els.filterDateTo.value}T23:59:59`) : null;

  return state.allEvents.filter((ev) => {
    // Search match
    const textToMatch = `${ev.counterName || ''} ${ev.by || ''} ${ev.detail || ''}`.toLowerCase();
    const matchesSearch = !search || textToMatch.includes(search);

    // Counter match
    const matchesCounter = selectedCounterId === 'all' || ev.counterId === selectedCounterId;

    // Action match
    let matchesAction = true;
    if (selectedAction === 'plus') matchesAction = ev.delta > 0;
    else if (selectedAction === 'minus') matchesAction = ev.delta < 0;
    else if (selectedAction === 'other') matchesAction = ev.delta === 0;

    // Date range
    const evTime = timestampValue(ev.createdAt || ev.at);
    const evDate = evTime ? new Date(evTime) : null;
    const matchesFrom = !from || (evDate && evDate >= from);
    const matchesTo = !to || (evDate && evDate <= to);

    return matchesSearch && matchesCounter && matchesAction && matchesFrom && matchesTo;
  }).sort((a, b) => timestampValue(b.createdAt || b.at) - timestampValue(a.createdAt || a.at));
}

function renderAudit() {
  updateClearFiltersButton();
  const filtered = getFilteredEvents();
  renderMetrics(filtered);

  if (els.auditRecordsCount) {
    els.auditRecordsCount.textContent = `Mostrando ${filtered.length} movimiento${filtered.length === 1 ? '' : 's'}`;
  }

  els.auditTbody.innerHTML = '';
  if (!filtered.length) {
    const hasDateFilter = Boolean(els.filterDateFrom.value || els.filterDateTo.value);
    const dateHelp = hasDateFilter ? ' Intenta ampliar o borrar las fechas seleccionadas.' : '';
    els.auditTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--muted);">
          No se encontraron movimientos con los filtros seleccionados.${dateHelp}
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((ev) => {
    const tr = document.createElement('tr');
    const positive = ev.delta > 0;
    const neutral = ev.delta === 0;

    let badgeIcon = positive ? '+' : '−';
    let badgeClass = positive ? 'plus' : 'minus';
    let qtyText = positive ? `+${ev.delta}` : `−${Math.abs(ev.delta)}`;
    let detailText = ev.detail || (positive ? 'Conteo incrementado' : 'Conteo decrementado');

    if (neutral) {
      badgeIcon = 'ℹ';
      badgeClass = 'info';
      qtyText = '—';
    }

    const eventDateVal = ev.createdAt || ev.at;

    tr.innerHTML = `
      <td><strong>${formatDateTime(eventDateVal)}</strong></td>
      <td>
        <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700;">
          <span style="color: var(--coral);">#</span>
          ${escapeHtml(ev.counterName || 'Contador')}
        </span>
      </td>
      <td>
        <div class="user-cell">
          <span class="user-cell-avatar">${initials(ev.by || 'TU')}</span>
          <span>${escapeHtml(ev.by || 'Usuario')}</span>
        </div>
      </td>
      <td style="text-align: center;">
        <span class="audit-badge ${badgeClass}">${badgeIcon}</span>
      </td>
      <td><strong>${qtyText}</strong> ${escapeHtml(ev.counterUnit || '')}</td>
      <td><span style="color: var(--ink);">${escapeHtml(detailText)}</span></td>
      <td><span style="color: var(--muted); font-size: 12px;">${timeAgo(eventDateVal)}</span></td>
    `;
    els.auditTbody.appendChild(tr);
  });
}

function exportCsvFile() {
  const filtered = getFilteredEvents();
  if (!filtered.length) {
    showToast('No hay datos para exportar con el filtro actual.', true);
    return;
  }

  const headers = ['Fecha y Hora', 'Contador', 'Unidad', 'Usuario', 'Accion', 'Cantidad', 'Detalle', 'Timestamp'];
  const rows = filtered.map((ev) => {
    const timeStr = formatDateTime(ev.createdAt || ev.at);
    const counterName = ev.counterName || '';
    const unit = ev.counterUnit || '';
    const user = ev.by || '';
    const action = ev.delta > 0 ? 'SUMA' : ev.delta < 0 ? 'RESTA' : 'SISTEMA/AJUSTE';
    const qty = ev.delta !== 0 ? ev.delta : 0;
    const detail = ev.detail || (ev.delta > 0 ? `Sumó ${ev.delta}` : ev.delta < 0 ? `Restó ${Math.abs(ev.delta)}` : 'Ajuste');
    const ts = timestampValue(ev.createdAt || ev.at);

    return [timeStr, counterName, unit, user, action, qty, detail, ts]
      .map((val) => `"${String(val).replace(/"/g, '""')}"`)
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const fromStr = els.filterDateFrom.value;
  const toStr = els.filterDateTo.value;
  let rangeTag = '';
  if (fromStr && toStr) rangeTag = `_${fromStr}_al_${toStr}`;
  else if (fromStr) rangeTag = `_desde_${fromStr}`;
  else if (toStr) rangeTag = `_hasta_${toStr}`;
  else rangeTag = `_completo`;

  link.setAttribute('href', url);
  link.setAttribute('download', `reporte-auditoria-cuenta-juntos${rangeTag}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Exportados ${filtered.length} registro(s) a Excel (CSV) con éxito.`);
}

function renderTrash() {
  const deletedCounters = state.counters.filter((c) => c.deleted);
  els.trashBadge.textContent = deletedCounters.length;

  if (!deletedCounters.length) {
    els.trashGrid.innerHTML = '';
    els.trashEmptyState.classList.remove('hidden');
    return;
  }

  els.trashEmptyState.classList.add('hidden');
  els.trashGrid.innerHTML = '';

  deletedCounters.forEach((counter) => {
    const daysLeft = getDaysRemaining(counter);
    const role = getUserRole(counter);
    const isOwner = role === 'Propietario';
    const isAdmin = role === 'Administrador' || isOwner;

    let countdownBadgeClass = 'normal';
    let countdownText = `⏳ Quedan ${daysLeft} días`;
    if (daysLeft <= 3 && daysLeft > 0) {
      countdownBadgeClass = 'urgent';
      countdownText = `🚨 Quedan ${daysLeft} días (Crítico)`;
    } else if (daysLeft <= 10 && daysLeft > 3) {
      countdownBadgeClass = 'warning';
      countdownText = `⚠️ Quedan ${daysLeft} días`;
    } else if (daysLeft === 0) {
      countdownBadgeClass = 'urgent';
      countdownText = '⚠️ Expira hoy / En cola de borrado';
    }

    const card = document.createElement('article');
    card.className = 'trash-card';
    card.innerHTML = `
      <div>
        <div class="trash-card-header">
          <h3 class="trash-card-title">${escapeHtml(counter.name)}</h3>
          <span class="countdown-badge ${countdownBadgeClass}">${countdownText}</span>
        </div>
        <div class="trash-card-meta">
          <p><strong>Último conteo:</strong> ${counter.count || 0} ${escapeHtml(counter.unit || 'objetos')}</p>
          <p><strong>Eliminado por:</strong> ${escapeHtml(counter.deletedBy || 'Administrador')}</p>
          <p><strong>Fecha de eliminación:</strong> ${formatDate(counter.deletedAt || counter.updatedAt)}</p>
          <p><strong>Tu rol en este contador:</strong> <span class="role-badge ${isOwner ? 'owner' : isAdmin ? 'admin' : 'viewer'}" style="font-size: 10px; padding: 2px 6px;">${role}</span></p>
        </div>
      </div>
      <div class="trash-card-actions">
        <button class="button button-secondary restore-btn" data-id="${counter.id}" ${!isAdmin ? 'disabled title="Solo Administradores o Propietario pueden restaurar"' : ''}>
          🔄 Restaurar
        </button>
        <button class="button-danger delete-perm-btn" data-id="${counter.id}" ${!isOwner ? 'disabled title="Solo el Propietario puede borrar definitivamente de la base de datos"' : ''}>
          ❌ Borrado Definitivo
        </button>
      </div>
    `;

    // Bind action events
    const restoreBtn = card.querySelector('.restore-btn');
    if (restoreBtn && isAdmin) {
      restoreBtn.addEventListener('click', () => restoreCounter(counter));
    }

    const deletePermBtn = card.querySelector('.delete-perm-btn');
    if (deletePermBtn && isOwner) {
      deletePermBtn.addEventListener('click', () => permanentlyDeleteCounter(counter));
    }

    els.trashGrid.appendChild(card);
  });
}

async function restoreCounter(counter) {
  const role = getUserRole(counter);
  if (role !== 'Propietario' && role !== 'Administrador') {
    return showToast('Solo Administradores o el Propietario pueden restaurar.', true);
  }

  const confirmRestore = window.confirm(
    `¿Restaurar el contador “${counter.name}”?\n\nVolverá a aparecer activo en la lista principal.`
  );
  if (!confirmRestore) return;

  const actorName = state.user?.displayName || state.user?.name || (state.demo ? 'Tú' : 'Administrador');
  const now = Date.now();

  if (state.demo) {
    const data = demoData();
    const target = data.counters.find((c) => c.id === counter.id);
    if (target) {
      target.deleted = false;
      delete target.deletedAt;
      delete target.deletedBy;
      target.activity = [
        ...(target.activity || []),
        { delta: 0, by: actorName, detail: 'Restaurado de la papelera de reciclaje', at: now }
      ];
      saveDemo(data);
      state.counters = data.counters;
      collectAllDemoEvents();
    }
    renderTrash();
    renderAudit();
    populateCounterFilter();
    updateGlobalRole();
    showToast(`“${counter.name}” ha sido restaurado con éxito.`);
    return;
  }

  try {
    await updateDoc(doc(db, 'counters', counter.id), {
      deleted: false,
      deletedAt: null,
      deletedBy: null
    });
    await addDoc(collection(db, 'counters', counter.id, 'events'), {
      delta: 0,
      by: actorName,
      actorId: state.user.uid,
      detail: 'Restaurado de la papelera de reciclaje',
      createdAt: serverTimestamp()
    });
    showToast(`“${counter.name}” ha sido restaurado con éxito.`);
  } catch {
    showToast('No se pudo restaurar el contador.', true);
  }
}

async function permanentlyDeleteCounter(counter) {
  const role = getUserRole(counter);
  if (role !== 'Propietario') {
    return showToast('Solo el Propietario tiene permisos para borrar definitivamente un contador.', true);
  }

  const confirmPermanent = window.confirm(
    `⚠️ ¿ELIMINAR DEFINITIVAMENTE “${counter.name}”?\n\nEsta acción es irreversible y eliminará todos los registros y movimientos asociados a este contador de la base de datos.`
  );
  if (!confirmPermanent) return;

  if (state.demo) {
    const data = demoData();
    data.counters = data.counters.filter((c) => c.id !== counter.id);
    saveDemo(data);
    state.counters = data.counters;
    collectAllDemoEvents();
    renderTrash();
    renderAudit();
    populateCounterFilter();
    updateGlobalRole();
    showToast(`“${counter.name}” ha sido borrado definitivamente.`);
    return;
  }

  try {
    await deleteDoc(doc(db, 'counters', counter.id));
    showToast(`“${counter.name}” ha sido borrado definitivamente de la base de datos.`);
  } catch {
    showToast('No se pudo borrar el contador de la base de datos.', true);
  }
}

async function emptyTrash() {
  const ownedDeleted = state.counters.filter((c) => c.deleted && getUserRole(c) === 'Propietario');
  if (!ownedDeleted.length) {
    return showToast('No tienes contadores en la papelera donde seas Propietario.', true);
  }

  const confirmEmpty = window.confirm(
    `⚠️ ¿VACIAR PAPELERA DEFINITIVAMENTE?\n\nSe borrarán de forma irreversible ${ownedDeleted.length} contador(es) de los cuales eres Propietario.`
  );
  if (!confirmEmpty) return;

  if (state.demo) {
    const data = demoData();
    const ownedIds = new Set(ownedDeleted.map((c) => c.id));
    data.counters = data.counters.filter((c) => !ownedIds.has(c.id));
    saveDemo(data);
    state.counters = data.counters;
    collectAllDemoEvents();
    renderTrash();
    renderAudit();
    populateCounterFilter();
    updateGlobalRole();
    showToast('Papelera vaciada correctamente.');
    return;
  }

  try {
    for (const counter of ownedDeleted) {
      await deleteDoc(doc(db, 'counters', counter.id));
    }
    showToast('Papelera vaciada correctamente.');
  } catch {
    showToast('Error al vaciar la papelera.', true);
  }
}

function collectAllDemoEvents() {
  const events = [];
  state.counters.forEach((counter) => {
    (counter.activity || []).forEach((act) => {
      events.push({
        ...act,
        counterId: counter.id,
        counterName: counter.name,
        counterUnit: counter.unit
      });
    });
  });
  state.allEvents = events;
}

function loadDemo() {
  state.demo = true;
  state.user = { displayName: 'Tú (Demo)', email: 'demo' };
  els.panelUserName.textContent = 'Modo Demo';
  els.connectionLabel.textContent = 'Modo Demo';
  els.userMenu.textContent = 'TU';

  const data = demoData();
  state.counters = data.counters || [];
  collectAllDemoEvents();

  populateCounterFilter();
  updateGlobalRole();
  renderAudit();
  renderTrash();
  renderUsers();
}

function subscribeAllEvents(counters) {
  // Unsubscribe old subcollections
  state.eventUnsubscribes.forEach((unsub) => unsub());
  state.eventUnsubscribes.clear();

  const eventsMap = new Map();

  counters.forEach((counter) => {
    const q = query(collection(db, 'counters', counter.id, 'events'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const counterEvents = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        counterId: counter.id,
        counterName: counter.name,
        counterUnit: counter.unit,
        ...docSnap.data()
      }));

      // Fallback to counter.activity if subcollection is empty
      if (!counterEvents.length && counter.activity?.length) {
        counter.activity.forEach((act, idx) => {
          counterEvents.push({
            id: `${counter.id}-act-${idx}`,
            counterId: counter.id,
            counterName: counter.name,
            counterUnit: counter.unit,
            ...act
          });
        });
      }

      eventsMap.set(counter.id, counterEvents);

      // Flatten and update state
      const combined = [];
      eventsMap.forEach((list) => combined.push(...list));
      state.allEvents = combined;

      renderAudit();
    });

    state.eventUnsubscribes.set(counter.id, unsub);
  });
}

function getMemberPresence(member) {
  const isSelf =
    (member.userId && member.userId === state.user?.uid) ||
    (member.email && member.email.toLowerCase() === state.user?.email?.toLowerCase()) ||
    (state.demo && (member.name === 'Tú' || member.email === 'tú'));

  if (isSelf) {
    return { isOnline: true, text: 'En línea ahora' };
  }

  if (state.demo) {
    if (member.isOnline) return { isOnline: true, text: 'En línea ahora' };
    const lastTime = member.lastSeen || Date.now() - 1800000;
    return { isOnline: false, text: `Desconectado ${timeAgo(lastTime).toLowerCase()}` };
  }

  const lastTime = timestampValue(member.lastSeen);
  if (!lastTime) return { isOnline: false, text: 'Desconectado' };
  const diff = Date.now() - lastTime;
  if (member.isOnline && diff < 90000) {
    return { isOnline: true, text: 'En línea ahora' };
  }
  return { isOnline: false, text: `Desconectado ${timeAgo(lastTime).toLowerCase()}` };
}

function getOwnedCounters() {
  return state.counters.filter((c) => !c.deleted && getUserRole(c) === 'Propietario');
}

function populateUserCounterFilter() {
  if (!els.filterUserCounter) return;
  const currentVal = els.filterUserCounter.value;
  const owned = getOwnedCounters();

  els.filterUserCounter.innerHTML = `<option value="all">Todos mis contadores (${owned.length})</option>`;
  owned.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    els.filterUserCounter.appendChild(opt);
  });

  if (owned.some((c) => c.id === currentVal)) {
    els.filterUserCounter.value = currentVal;
  } else {
    els.filterUserCounter.value = 'all';
  }
}

function renderUsers() {
  if (!els.usersTbody) return;
  populateUserCounterFilter();

  const ownedCounters = getOwnedCounters();
  const isAnyOwner = ownedCounters.length > 0 || state.demo;

  if (els.usersOwnerBanner) els.usersOwnerBanner.classList.toggle('hidden', !isAnyOwner);
  if (els.usersNonownerBanner) els.usersNonownerBanner.classList.toggle('hidden', isAnyOwner);

  const search = els.usersSearch?.value.trim().toLowerCase() || '';
  const selectedCounterId = els.filterUserCounter?.value || 'all';

  const userEntries = [];

  ownedCounters.forEach((counter) => {
    if (selectedCounterId !== 'all' && counter.id !== selectedCounterId) return;

    (counter.members || []).forEach((member) => {
      const isSelf =
        (member.userId && member.userId === state.user?.uid) ||
        (member.email && member.email.toLowerCase() === state.user?.email?.toLowerCase()) ||
        (state.demo && (member.name === 'Tú' || member.email === 'tú'));

      if (isSelf) return;

      const textToMatch = `${member.name || ''} ${member.email || ''} ${counter.name || ''} ${member.role || ''}`.toLowerCase();
      if (search && !textToMatch.includes(search)) return;

      userEntries.push({
        counterId: counter.id,
        counterName: counter.name,
        member
      });
    });
  });

  if (els.usersBadge) {
    const uniqueEmails = new Set(
      ownedCounters.flatMap((c) => c.members || [])
        .filter((m) => {
          const isSelf = (m.userId && m.userId === state.user?.uid) || (m.email && m.email === state.user?.email) || (state.demo && m.name === 'Tú');
          return !isSelf;
        })
        .map((m) => m.email || m.name)
    );
    els.usersBadge.textContent = uniqueEmails.size;
  }

  if (els.usersRecordsCount) {
    els.usersRecordsCount.textContent = `${userEntries.length} acceso(s) encontrado(s)`;
  }

  els.usersTbody.innerHTML = '';

  if (!isAnyOwner) {
    els.usersTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--coral-dark);">
          🔒 Solo el Propietario tiene permisos para gestionar y eliminar usuarios de los contadores.
        </td>
      </tr>
    `;
    return;
  }

  if (!userEntries.length) {
    els.usersTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--muted);">
          No se encontraron colaboradores en tus contadores con los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  userEntries.forEach(({ counterId, counterName, member }) => {
    const tr = document.createElement('tr');
    const memberRole = member.role || 'Operador';
    const badgeClass =
      memberRole === 'Propietario' ? 'owner' :
      memberRole === 'Administrador' ? 'admin' :
      memberRole === 'Operador' ? 'editor' : 'viewer';

    const presence = getMemberPresence(member);

    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <span class="user-cell-avatar">${initials(member.name || member.email)}</span>
          <strong>${escapeHtml(member.name || member.email)}</strong>
        </div>
      </td>
      <td>${escapeHtml(member.email || '—')}</td>
      <td>
        <span style="font-weight: 700; color: var(--navy);">
          <span style="color: var(--coral);">#</span> ${escapeHtml(counterName)}
        </span>
      </td>
      <td>
        <span class="role-badge ${badgeClass}" style="font-size: 11px; padding: 3px 8px;">${escapeHtml(memberRole)}</span>
      </td>
      <td>
        <span class="presence-label ${presence.isOnline ? 'online' : 'offline'}">${presence.isOnline ? '🟢 En línea' : `⚪ ${presence.text}`}</span>
      </td>
      <td style="text-align: right;">
        <button class="button-danger remove-panel-user-btn" type="button" title="Eliminar usuario de este contador (exclusivo Propietario)">
          ✕ Quitar Acceso
        </button>
      </td>
    `;

    const removeBtn = tr.querySelector('.remove-panel-user-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeUserFromCounter(counterId, counterName, member));
    }

    els.usersTbody.appendChild(tr);
  });
}

async function removeUserFromCounter(counterId, counterName, member) {
  const memberName = member.name || member.email || 'este usuario';
  const confirmed = window.confirm(
    `⚠️ ¿ELIMINAR ACCESO DE USUARIO?\n\n¿Estás seguro de expulsar a "${memberName}" del contador "${counterName}"?\n\nPerderá el acceso de inmediato a este contador.`
  );
  if (!confirmed) return;

  const actorName = state.user?.displayName || state.user?.name || (state.demo ? 'Tú' : 'Propietario');
  const now = Date.now();

  if (state.demo) {
    const data = demoData();
    const target = data.counters.find((c) => c.id === counterId);
    if (target) {
      target.members = (target.members || []).filter((m) => {
        if (member.userId && m.userId) return m.userId !== member.userId;
        return m.email?.toLowerCase() !== member.email?.toLowerCase();
      });
      if (member.userId) {
        target.memberIds = (target.memberIds || []).filter((id) => id !== member.userId);
      }
      target.activity = [
        ...(target.activity || []),
        { delta: 0, by: actorName, detail: `Eliminó el acceso a ${memberName}`, at: now }
      ];
      target.updatedAt = now;
      saveDemo(data);
      state.counters = data.counters;
      collectAllDemoEvents();
      renderUsers();
      renderAudit();
      showToast(`Usuario "${memberName}" eliminado de "${counterName}".`);
    }
    return;
  }

  try {
    const target = state.counters.find((c) => c.id === counterId);
    if (!target) return;

    const remainingMembers = (target.members || []).filter((m) => {
      if (member.userId && m.userId) return m.userId !== member.userId;
      return m.email?.toLowerCase() !== member.email?.toLowerCase();
    });
    const remainingIds = (target.memberIds || []).filter((id) => id !== member.userId);

    await updateDoc(doc(db, 'counters', counterId), {
      members: remainingMembers,
      memberIds: remainingIds,
      updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, 'counters', counterId, 'events'), {
      delta: 0,
      by: actorName,
      actorId: state.user.uid,
      detail: `Eliminó el acceso a ${memberName}`,
      createdAt: serverTimestamp()
    });

    showToast(`Usuario "${memberName}" eliminado de "${counterName}".`);
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    showToast('No se pudo eliminar al usuario.', true);
  }
}

function loadFirebaseData() {
  if (state.unsubscribeCounters) state.unsubscribeCounters();

  const countersQuery = query(
    collection(db, 'counters'),
    where('memberIds', 'array-contains', state.user.uid)
  );

  state.unsubscribeCounters = onSnapshot(
    countersQuery,
    (snapshot) => {
      state.counters = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      populateCounterFilter();
      updateGlobalRole();
      subscribeAllEvents(state.counters);
      renderTrash();
      renderUsers();
    },
    () => showToast('No se pudieron sincronizar los contadores.', true)
  );
}

// Event Listeners
els.tabAudit.addEventListener('click', () => switchTab('audit'));
els.tabTrash.addEventListener('click', () => switchTab('trash'));
if (els.tabUsers) {
  els.tabUsers.addEventListener('click', () => switchTab('users'));
}
if (els.usersSearch) {
  els.usersSearch.addEventListener('input', renderUsers);
}
if (els.filterUserCounter) {
  els.filterUserCounter.addEventListener('change', renderUsers);
}
els.auditSearch.addEventListener('input', renderAudit);
els.filterCounter.addEventListener('change', renderAudit);
els.filterAction.addEventListener('change', renderAudit);

function onDateChange() {
  populateCounterFilter();
  renderAudit();
}

els.filterDateFrom.addEventListener('change', onDateChange);
els.filterDateFrom.addEventListener('input', onDateChange);
els.filterDateTo.addEventListener('change', onDateChange);
els.filterDateTo.addEventListener('input', onDateChange);

els.exportCsv.addEventListener('click', exportCsvFile);
if (els.clearFilters) {
  els.clearFilters.addEventListener('click', clearAllFilters);
}
els.emptyTrashBtn.addEventListener('click', emptyTrash);

function handleLogout() {
  if (state.demo) {
    window.location.href = 'index.html';
    return;
  }
  signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
}

els.userMenu.addEventListener('click', handleLogout);
if (els.topbarLogout) {
  els.topbarLogout.addEventListener('click', handleLogout);
}

// Initialization
if (firebaseReady) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      state.user = user;
      els.panelUserName.textContent = user.displayName || user.email?.split('@')[0] || 'Usuario';
      els.userMenu.textContent = initials(user.displayName || user.email || 'TU');
      els.connectionLabel.textContent = 'Conectado';
      loadFirebaseData();
    } else {
      // Fallback: check if demo mode was active in index.html
      const demoCheck = localStorage.getItem('cuenta-juntos-demo');
      if (demoCheck) {
        loadDemo();
      } else {
        window.location.href = 'index.html';
      }
    }
  });
} else {
  // If firebase is not configured, run demo mode
  loadDemo();
}
