import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  arrayUnion,
  serverTimestamp,
  runTransaction
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
  counters: [],
  activeCounter: null,
  events: [],
  unsubscribeCounters: null,
  unsubscribeActive: null,
  unsubscribeEvents: null,
  demo: false,
  register: false,
  recentCounterId: null,
  recentTimer: null
};

const $ = (id) => document.getElementById(id);
const els = {
  authView: $('auth-view'),
  appView: $('app-view'),
  authForm: $('auth-form'),
  authTitle: $('auth-title'),
  authSubtitle: $('auth-subtitle'),
  authNameField: $('name-field'),
  authName: $('auth-name'),
  authEmail: $('auth-email'),
  authPassword: $('auth-password'),
  authSubmit: $('auth-submit'),
  authToggle: $('auth-toggle'),
  demoLogin: $('demo-login'),
  counterList: $('counter-list'),
  counterSearch: $('counter-search'),
  counterDate: $('counter-date'),
  profileName: $('profile-name'),
  profileEmail: $('profile-email'),
  profileAvatar: $('profile-avatar'),
  userMenu: $('user-menu'),
  logout: $('logout'),
  newCounter: $('new-counter'),
  emptyNewCounter: $('empty-new-counter'),
  emptyState: $('empty-state'),
  counterWorkspace: $('counter-workspace'),
  counterRole: $('counter-role'),
  counterTitle: $('counter-title'),
  counterMeta: $('counter-meta'),
  shareCounter: $('share-counter'),
  deleteCounter: $('delete-counter'),
  countNumber: $('count-number'),
  countLabel: $('count-label'),
  increment: $('increment'),
  decrement: $('decrement'),
  readOnlyNotice: $('read-only-notice'),
  activityList: $('activity-list'),
  activityCount: $('activity-count'),
  activitySearch: $('activity-search'),
  activityFrom: $('activity-from'),
  activityTo: $('activity-to'),
  memberList: $('member-list'),
  inviteMember: $('invite-member'),
  counterDialog: $('counter-dialog'),
  counterForm: $('counter-form'),
  counterName: $('counter-name'),
  counterUnit: $('counter-unit'),
  closeCounterDialog: $('close-counter-dialog'),
  cancelCounterDialog: $('cancel-counter-dialog'),
  shareDialog: $('share-dialog'),
  shareForm: $('share-form'),
  memberEmail: $('member-email'),
  memberRole: $('member-role'),
  closeShareDialog: $('close-share-dialog'),
  cancelShareDialog: $('cancel-share-dialog'),
  toast: $('toast'),
  connectionLabel: $('connection-label')
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

function timeAgo(date) {
  if (!date) return 'Ahora';
  const value = date.toDate ? date.toDate() : new Date(date);
  const seconds = Math.floor((Date.now() - value.getTime()) / 1000);
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  return `Hace ${Math.floor(seconds / 3600)} h`;
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

function formatError(error) {
  const messages = {
    'auth/invalid-credential': 'El correo o la contraseña no son correctos.',
    'auth/email-already-in-use': 'Ese correo ya tiene una cuenta.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'Revisa el formato del correo.'
  };
  return messages[error.code] || 'No pudimos completar la operación. Inténtalo de nuevo.';
}

function getCounterActivityTime(counter) {
  if (!counter) return 0;
  const updated = timestampValue(counter.updatedAt);
  const lastAct = counter.activity?.length
    ? timestampValue(counter.activity[counter.activity.length - 1].at)
    : 0;
  const created = timestampValue(counter.createdAt);
  return Math.max(updated, lastAct, created);
}

function markCounterRecent(id) {
  state.recentCounterId = id;
  if (state.recentTimer) window.clearTimeout(state.recentTimer);
  state.recentTimer = window.setTimeout(() => {
    state.recentCounterId = null;
    renderCounterList();
  }, 4000);
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

function setUser(user, demo = false) {
  state.user = user;
  state.demo = demo;
  const name = user.displayName || user.name || 'Tu cuenta';
  els.profileName.textContent = name;
  els.profileEmail.textContent = user.email || 'modo demo';
  els.profileAvatar.textContent = initials(name);
  els.userMenu.textContent = initials(name);
  els.connectionLabel.textContent = demo ? 'Modo demo' : 'Conectado';
  els.authView.classList.add('hidden');
  els.appView.classList.remove('hidden');
}

function resetApp() {
  state.activeCounter = null;
  els.counterWorkspace.classList.add('hidden');
  els.emptyState.classList.remove('hidden');
  els.counterTitle.textContent = 'Selecciona un contador';
  els.counterMeta.textContent = 'Crea uno para comenzar.';
  if (els.counterRole) {
    els.counterRole.textContent = 'Propietario';
    els.counterRole.className = 'role-badge owner';
  }
  els.shareCounter.disabled = true;
  els.deleteCounter.disabled = true;
  els.increment.disabled = false;
  els.decrement.disabled = false;
  if (els.readOnlyNotice) els.readOnlyNotice.classList.add('hidden');
}

function demoData() {
  try {
    return JSON.parse(localStorage.getItem('cuenta-juntos-demo') || 'null') || {
      counters: [
        {
          id: 'demo-1',
          name: 'Cajas recibidas',
          unit: 'cajas',
          count: 24,
          ownerId: 'demo',
          memberIds: ['demo'],
          deleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          members: [{ email: 'tú', name: 'Tú', role: 'Propietario' }],
          activity: [{ delta: 1, by: 'Tú', at: Date.now() }]
        }
      ]
    };
  } catch {
    return { counters: [] };
  }
}

function saveDemo(data) {
  localStorage.setItem('cuenta-juntos-demo', JSON.stringify(data));
}

function demoCounters() {
  state.counters = demoData().counters || [];
  renderCounterList();
  const available = state.counters.filter((c) => !c.deleted);
  if (!state.activeCounter && available.length) {
    selectCounter(available[0].id);
  }
}

function renderCounterList() {
  els.counterList.innerHTML = '';
  const search = els.counterSearch.value.trim().toLowerCase();
  const selectedDate = els.counterDate.value;

  const counters = state.counters
    .filter((counter) => {
      if (counter.deleted) return false;
      const matchesSearch = `${counter.name} ${counter.unit || ''}`.toLowerCase().includes(search);
      const createdTime = timestampValue(counter.createdAt);
      const matchesDate = !selectedDate || (createdTime && new Date(createdTime).toISOString().slice(0, 10) === selectedDate);
      return matchesSearch && matchesDate;
    })
    .sort((first, second) => getCounterActivityTime(second) - getCounterActivityTime(first));

  if (!counters.length) {
    const activeCount = state.counters.filter((c) => !c.deleted).length;
    els.counterList.innerHTML = `<p class="muted">${activeCount ? 'No hay coincidencias.' : 'Aún no tienes contadores activos.'}</p>`;
    if (!activeCount) resetApp();
    return;
  }

  counters.forEach((counter) => {
    const isActive = state.activeCounter?.id === counter.id;
    const isRecent = state.recentCounterId === counter.id;
    const button = document.createElement('button');
    button.className = `counter-item${isActive ? ' active' : ''}${isRecent ? ' just-updated' : ''}`;
    button.type = 'button';

    let badge = '';
    if (isRecent) {
      badge = `<span class="recent-badge"><span class="recent-dot"></span>Reciente</span>`;
    } else if (isActive) {
      badge = `<span class="active-badge">Activo</span>`;
    }

    const lastActive = getCounterActivityTime(counter);
    button.innerHTML = `
      <span class="counter-icon">#</span>
      <span class="counter-item-content">
        <strong>${escapeHtml(counter.name)}</strong>
        <small class="counter-item-meta">${counter.count || 0} ${escapeHtml(counter.unit || 'objetos')}</small>
        <small class="counter-item-date">${lastActive ? `Actividad: ${timeAgo(lastActive)}` : `Creado: ${formatDate(counter.createdAt)}`}</small>
      </span>
      ${badge}
    `;
    button.addEventListener('click', () => selectCounter(counter.id));
    els.counterList.appendChild(button);
  });

  if (state.recentCounterId) {
    els.counterList.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }
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

async function loadCounters() {
  if (state.demo) {
    demoCounters();
    return;
  }
  if (state.unsubscribeCounters) state.unsubscribeCounters();

  const countersQuery = query(collection(db, 'counters'), where('memberIds', 'array-contains', state.user.uid));
  state.unsubscribeCounters = onSnapshot(
    countersQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          markCounterRecent(change.doc.id);
        }
      });
      state.counters = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderCounterList();

      const activeList = state.counters.filter((item) => !item.deleted);
      if (!state.activeCounter && activeList.length) {
        selectCounter(
          activeList.slice().sort((a, b) => getCounterActivityTime(b) - getCounterActivityTime(a))[0].id
        );
      }
      if (state.activeCounter && !activeList.some((item) => item.id === state.activeCounter.id)) {
        resetApp();
      }
    },
    () => showToast('No pudimos cargar tus contadores.', true)
  );
}

function selectCounter(id) {
  const counter = state.counters.find((item) => item.id === id);
  if (!counter || counter.deleted) return;

  state.activeCounter = counter;
  state.events = [];
  renderCounterList();
  renderActiveCounter(counter);

  const activeEl = els.counterList.querySelector('.counter-item.active');
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  if (state.demo) {
    state.events = (counter.activity || []).slice().reverse();
    renderActivity();
  } else {
    subscribeActiveCounter(id);
    subscribeEvents(id);
  }
}

function subscribeActiveCounter(id) {
  if (state.unsubscribeActive) state.unsubscribeActive();
  state.unsubscribeActive = onSnapshot(doc(db, 'counters', id), (snapshot) => {
    if (snapshot.exists()) {
      const data = { id: snapshot.id, ...snapshot.data() };
      if (data.deleted) {
        resetApp();
        renderCounterList();
        return;
      }
      state.activeCounter = data;
      renderActiveCounter(state.activeCounter);
    }
  });
}

function renderActiveCounter(counter) {
  els.emptyState.classList.add('hidden');
  els.counterWorkspace.classList.remove('hidden');
  els.counterTitle.textContent = counter.name;
  els.counterMeta.textContent = `Actualizado ${timeAgo(counter.updatedAt || counter.activity?.[counter.activity.length - 1]?.at)}`;

  const role = getUserRole(counter);
  const isOwner = role === 'Propietario';
  const isAdmin = role === 'Administrador' || isOwner;
  const isViewer = role === 'Visualizador';

  if (els.counterRole) {
    els.counterRole.textContent = role;
    const badgeClass =
      role === 'Propietario' ? 'owner' :
      role === 'Administrador' ? 'admin' :
      role === 'Operador' ? 'editor' : 'viewer';
    els.counterRole.className = `role-badge ${badgeClass}`;
  }

  els.shareCounter.disabled = !isAdmin;
  els.deleteCounter.disabled = !isAdmin;
  els.deleteCounter.title = isAdmin ? 'Mover a papelera' : 'Solo Administradores o Propietarios pueden mover a papelera';

  if (els.inviteMember) {
    els.inviteMember.style.display = isAdmin ? '' : 'none';
  }

  els.increment.disabled = isViewer;
  els.decrement.disabled = isViewer;
  if (els.readOnlyNotice) {
    els.readOnlyNotice.classList.toggle('hidden', !isViewer);
  }

  els.countNumber.textContent = counter.count || 0;
  els.countNumber.classList.remove('bump');
  void els.countNumber.offsetWidth;
  els.countNumber.classList.add('bump');
  els.countLabel.textContent = counter.unit || 'objetos';

  renderActivity();
  renderMembers(counter);
}

function eventDate(item) {
  if (item.createdAt?.toDate) return item.createdAt.toDate();
  if (item.at) return new Date(item.at);
  return null;
}

function formatDateTime(item) {
  const date = eventDate(item);
  return date
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
    : 'Registrando...';
}

function renderActivity() {
  const search = els.activitySearch.value.trim().toLowerCase();
  const from = els.activityFrom.value ? new Date(`${els.activityFrom.value}T00:00:00`) : null;
  const to = els.activityTo.value ? new Date(`${els.activityTo.value}T23:59:59`) : null;

  const events = state.events.filter((item) => {
    const date = eventDate(item);
    const text = `${item.by || ''} ${item.delta > 0 ? 'sumó' : item.delta < 0 ? 'restó' : item.detail || ''}`.toLowerCase();
    return (!search || text.includes(search)) && (!from || (date && date >= from)) && (!to || (date && date <= to));
  });

  els.activityCount.textContent = events.length;
  els.activityList.innerHTML = '';

  events.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'activity-row';
    const positive = item.delta > 0;
    const isNeutral = item.delta === 0;

    let symbol = positive ? '+' : '−';
    let symbolClass = positive ? '' : ' minus';
    let actionDesc = `${positive ? 'sumó' : 'restó'} ${Math.abs(item.delta)}`;

    if (isNeutral) {
      symbol = 'ℹ';
      symbolClass = ' neutral';
      actionDesc = item.detail || 'Actualización de configuración';
    }

    row.innerHTML = `
      <span class="activity-symbol${symbolClass}">${symbol}</span>
      <span class="activity-text">
        <strong>${escapeHtml(item.by || 'Alguien')}</strong> ${actionDesc}
        <small>${formatDateTime(item)}</small>
      </span>
      <span class="activity-time">${timeAgo(eventDate(item))}</span>
    `;
    els.activityList.appendChild(row);
  });

  if (!events.length) els.activityList.innerHTML = '<p class="muted">No hay movimientos para este filtro.</p>';
}

function subscribeEvents(id) {
  if (state.unsubscribeEvents) state.unsubscribeEvents();
  state.unsubscribeEvents = onSnapshot(
    query(collection(db, 'counters', id, 'events'), orderBy('createdAt', 'desc')),
    (snapshot) => {
      state.events = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (!state.events.length) state.events = (state.activeCounter?.activity || []).slice().reverse();
      renderActivity();
    },
    () => showToast('No pudimos cargar el historial.', true)
  );
}

function renderMembers(counter) {
  els.memberList.innerHTML = '';
  const members = counter.members || [{ name: 'Tú', email: state.user?.email || 'modo demo', role: 'Propietario' }];
  members.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'member-row';
    const memberRole = member.role || 'Operador';
    const badgeClass =
      memberRole === 'Propietario' ? 'owner' :
      memberRole === 'Administrador' ? 'admin' :
      memberRole === 'Operador' ? 'editor' : 'viewer';

    row.innerHTML = `
      <span class="member-avatar">${initials(member.name || member.email)}</span>
      <span class="member-info">
        <strong>${escapeHtml(member.name || member.email)}</strong>
        <span>
          <span class="role-badge ${badgeClass}" style="font-size: 0.68rem; padding: 2px 6px;">${escapeHtml(memberRole)}</span>
          · ${escapeHtml(member.email || '')}
        </span>
      </span>
    `;
    els.memberList.appendChild(row);
  });
}

async function changeCount(delta) {
  const counter = state.activeCounter;
  if (!counter) return;

  const role = getUserRole(counter);
  if (role === 'Visualizador') {
    showToast('Modo solo lectura: No tienes permisos para modificar este contador.', true);
    return;
  }

  const actor = state.user?.displayName || state.user?.name || 'Tú';
  const now = Date.now();
  const activity = { delta, by: actor, actorId: state.user?.uid || 'demo', at: now };

  markCounterRecent(counter.id);

  if (state.demo) {
    const data = demoData();
    const target = data.counters.find((item) => item.id === counter.id);
    if (!target) return;
    target.count = Math.max(0, (target.count || 0) + delta);
    target.activity = [...(target.activity || []), activity];
    target.updatedAt = now;
    saveDemo(data);

    state.counters = data.counters;
    state.activeCounter = target;
    state.events = target.activity.slice().reverse();
    renderCounterList();
    renderActiveCounter(target);
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const ref = doc(db, 'counters', counter.id);
      const snapshot = await transaction.get(ref);
      const current = snapshot.data()?.count || 0;
      transaction.update(ref, {
        count: Math.max(0, current + delta),
        activity: arrayUnion(activity),
        updatedAt: serverTimestamp()
      });
    });
    await addDoc(collection(db, 'counters', counter.id, 'events'), {
      ...activity,
      createdAt: serverTimestamp()
    });
  } catch {
    showToast('No se pudo actualizar el conteo.', true);
  }
}

async function createCounter(event) {
  event.preventDefault();
  const name = els.counterName.value.trim();
  const unit = els.counterUnit.value.trim() || 'objetos';
  if (!name) return;

  if (state.demo) {
    const data = demoData();
    const now = Date.now();
    const counter = {
      id: `demo-${now}`,
      name,
      unit,
      count: 0,
      ownerId: 'demo',
      memberIds: ['demo'],
      deleted: false,
      createdAt: now,
      updatedAt: now,
      members: [{ email: 'tú', name: 'Tú', role: 'Propietario' }],
      activity: []
    };
    data.counters.push(counter);
    saveDemo(data);
    els.counterDialog.close();
    els.counterForm.reset();
    state.counters = data.counters;
    markCounterRecent(counter.id);
    selectCounter(counter.id);
    renderCounterList();
    showToast('Contador creado');
    return;
  }

  try {
    const newCounter = await addDoc(collection(db, 'counters'), {
      name,
      unit,
      count: 0,
      ownerId: state.user.uid,
      memberIds: [state.user.uid],
      deleted: false,
      members: [
        {
          email: state.user.email,
          name: state.user.displayName || 'Propietario',
          role: 'Propietario',
          userId: state.user.uid
        }
      ],
      activity: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    els.counterDialog.close();
    els.counterForm.reset();
    showToast('Contador creado');
    markCounterRecent(newCounter.id);
    selectCounter(newCounter.id);
  } catch {
    showToast('No se pudo crear el contador.', true);
  }
}

async function deleteCounter() {
  const counter = state.activeCounter;
  if (!counter) return;

  const role = getUserRole(counter);
  if (role !== 'Propietario' && role !== 'Administrador') {
    return showToast('Solo el Propietario o un Administrador pueden mover este contador a la papelera.', true);
  }

  const confirmMove = window.confirm(
    `¿Mover “${counter.name}” a la papelera de reciclaje?\n\nSe conservará durante 30 días con opción a restaurarlo antes de su borrado definitivo.`
  );
  if (!confirmMove) return;

  const actorName = state.user?.displayName || state.user?.name || (state.demo ? 'Tú' : 'Administrador');
  const now = Date.now();

  if (state.demo) {
    const data = demoData();
    const target = data.counters.find((item) => item.id === counter.id);
    if (target) {
      target.deleted = true;
      target.deletedAt = now;
      target.deletedBy = actorName;
      target.activity = [
        ...(target.activity || []),
        { delta: 0, by: actorName, detail: 'Movido a la papelera', at: now }
      ];
      saveDemo(data);
      state.counters = data.counters;
    }
    state.activeCounter = null;
    resetApp();
    renderCounterList();
    showToast('Contador movido a la papelera (retención de 30 días)');
    return;
  }

  try {
    await updateDoc(doc(db, 'counters', counter.id), {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: actorName
    });
    await addDoc(collection(db, 'counters', counter.id, 'events'), {
      delta: 0,
      by: actorName,
      actorId: state.user.uid,
      detail: 'Movido a la papelera de reciclaje',
      createdAt: serverTimestamp()
    });
    state.activeCounter = null;
    resetApp();
    showToast('Contador movido a la papelera (retención de 30 días)');
  } catch {
    showToast('No se pudo mover el contador a la papelera.', true);
  }
}

async function inviteMember(event) {
  event.preventDefault();
  const email = els.memberEmail.value.trim().toLowerCase();
  const role = els.memberRole.value || 'Operador';
  if (!email || !state.activeCounter) return;

  const currentRole = getUserRole(state.activeCounter);
  if (currentRole !== 'Propietario' && currentRole !== 'Administrador') {
    return showToast('Solo el Propietario o un Administrador pueden invitar personas.', true);
  }

  if (state.demo) {
    const data = demoData();
    const target = data.counters.find((item) => item.id === state.activeCounter.id);
    target.members = [...(target.members || []), { email, name: email.split('@')[0], role }];
    saveDemo(data);
    state.counters = data.counters;
    state.activeCounter = target;
    els.shareDialog.close();
    els.shareForm.reset();
    renderActiveCounter(target);
    showToast(`Acceso simulado concedido como ${role}`);
    return;
  }

  try {
    const users = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
    if (users.empty) return showToast('Esa persona debe registrarse primero en la app.', true);

    const invited = users.docs[0];
    const invitedData = invited.data();

    await updateDoc(doc(db, 'counters', state.activeCounter.id), {
      memberIds: arrayUnion(invited.id),
      members: arrayUnion({
        email,
        name: invitedData.name || email.split('@')[0],
        role,
        userId: invited.id
      })
    });

    await addDoc(collection(db, 'counters', state.activeCounter.id, 'events'), {
      delta: 0,
      by: state.user.displayName || state.user.email || 'Administrador',
      actorId: state.user.uid,
      detail: `Invitó a ${email} como ${role}`,
      createdAt: serverTimestamp()
    });

    els.shareDialog.close();
    els.shareForm.reset();
    showToast(`Acceso concedido como ${role}`);
  } catch {
    showToast('No se pudo invitar a esa persona.', true);
  }
}

async function handleAuth(event) {
  event.preventDefault();
  if (!firebaseReady) return showToast('Configura Firebase para usar el acceso real.', true);
  const email = els.authEmail.value.trim().toLowerCase();
  const password = els.authPassword.value;
  try {
    if (!state.register) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      const name = els.authName.value.trim() || email.split('@')[0];
      await updateProfile(credentials.user, { displayName: name });
      await setDoc(doc(db, 'users', credentials.user.uid), { email, name });
    }
  } catch (error) {
    showToast(formatError(error), true);
  }
}

function toggleAuth() {
  state.register = !state.register;
  els.authNameField.classList.toggle('hidden', !state.register);
  els.authTitle.textContent = state.register ? 'Crea tu cuenta' : 'Bienvenido';
  els.authSubtitle.textContent = state.register
    ? 'Empieza a compartir tus conteos.'
    : 'Inicia sesión para ver tus contadores.';
  els.authSubmit.textContent = state.register ? 'Crear cuenta' : 'Entrar';
  els.authToggle.textContent = state.register
    ? '¿Ya tienes cuenta? Inicia sesión'
    : '¿No tienes cuenta? Regístrate';
}

function logout() {
  if (state.demo) {
    state.demo = false;
    state.user = null;
    els.appView.classList.add('hidden');
    els.authView.classList.remove('hidden');
    return;
  }
  signOut(auth);
}

function startDemo() {
  setUser({ name: 'Modo demo', email: 'Tus datos quedan en este navegador' }, true);
  loadCounters();
}

els.counterList.addEventListener('wheel', (e) => {
  if (els.counterList.scrollWidth > els.counterList.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    els.counterList.scrollLeft += e.deltaY;
  }
}, { passive: true });

els.authForm.addEventListener('submit', handleAuth);
els.authToggle.addEventListener('click', toggleAuth);
els.demoLogin.addEventListener('click', startDemo);
els.counterSearch.addEventListener('input', renderCounterList);
els.counterDate.addEventListener('change', renderCounterList);
els.activitySearch.addEventListener('input', renderActivity);
els.activityFrom.addEventListener('change', renderActivity);
els.activityTo.addEventListener('change', renderActivity);

els.newCounter.addEventListener('click', () => els.counterDialog.showModal());
els.emptyNewCounter.addEventListener('click', () => els.counterDialog.showModal());
els.counterForm.addEventListener('submit', createCounter);
els.closeCounterDialog.addEventListener('click', () => els.counterDialog.close());
els.cancelCounterDialog.addEventListener('click', () => els.counterDialog.close());

els.shareCounter.addEventListener('click', () => els.shareDialog.showModal());
if (els.inviteMember) {
  els.inviteMember.addEventListener('click', () => els.shareDialog.showModal());
}
els.shareForm.addEventListener('submit', inviteMember);
els.closeShareDialog.addEventListener('click', () => els.shareDialog.close());
els.cancelShareDialog.addEventListener('click', () => els.shareDialog.close());

els.increment.addEventListener('click', () => changeCount(1));
els.decrement.addEventListener('click', () => changeCount(-1));
els.deleteCounter.addEventListener('click', deleteCounter);
els.logout.addEventListener('click', logout);
els.userMenu.addEventListener('click', logout);

document.addEventListener('keydown', (event) => {
  if (event.target.matches('input, textarea, select')) return;
  if (!state.activeCounter) return;
  if (getUserRole(state.activeCounter) === 'Visualizador') return;
  if (event.key === '+' || event.key === '=') changeCount(1);
  if (event.key === '-' || event.key === '_') changeCount(-1);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

if (firebaseReady) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      setUser(user);
      loadCounters();
    }
  });
} else {
  els.connectionLabel.textContent = 'Sin configurar';
}
