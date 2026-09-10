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
  unsubscribeChat: null,
  unsubscribeTyping: null,
  chatMessages: [],
  chatIsOpen: false,
  typingTimer: null,
  presenceInterval: null,
  deferredPrompt: null,
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
  pwaInstallBtn: $('pwa-install-btn'),
  topbarLogout: $('topbar-logout'),
  counterList: $('counter-list'),
  counterSearch: $('counter-search'),
  counterDate: $('counter-date'),
  profileName: $('profile-name'),
  profileEmail: $('profile-email'),
  profileAvatar: $('profile-avatar'),
  userMenu: $('user-menu'),
  logout: $('logout'),
  profileDialog: $('profile-dialog'),
  closeProfileDialog: $('close-profile-dialog'),
  modalProfileName: $('modal-profile-name'),
  modalProfileAvatar: $('modal-profile-avatar'),
  modalProfileDisplayName: $('modal-profile-display-name'),
  modalProfileEmail: $('modal-profile-email'),
  modalProfileStatus: $('modal-profile-status'),
  modalLogout: $('modal-logout'),
  newCounter: $('new-counter'),
  emptyNewCounter: $('empty-new-counter'),
  emptyState: $('empty-state'),
  counterWorkspace: $('counter-workspace'),
  counterRole: $('counter-role'),
  counterTitle: $('counter-title'),
  counterMeta: $('counter-meta'),
  openCounterChat: $('open-counter-chat'),
  chatUnreadCount: $('chat-unread-count'),
  chatDialog: $('chat-dialog'),
  closeChatDialog: $('close-chat-dialog'),
  chatCounterTitle: $('chat-counter-title'),
  chatCounterSubtitle: $('chat-counter-subtitle'),
  chatMessagesList: $('chat-messages-list'),
  chatWelcome: $('chat-welcome'),
  chatScrollBottom: $('chat-scroll-bottom'),
  chatScrollBadge: $('chat-scroll-badge'),
  chatTypingIndicator: $('chat-typing-indicator'),
  chatTypingText: $('chat-typing-text'),
  chatForm: $('chat-form'),
  chatInput: $('chat-input'),
  chatSend: $('chat-send'),
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
  const time = timestampValue(date);
  if (!time) return 'Ahora';
  const seconds = Math.floor((Date.now() - time) / 1000);
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return `Hace ${Math.floor(seconds / 86400)} d`;
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof value.toDate === 'function') {
    const d = value.toDate();
    return d ? d.getTime() : 0;
  }
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  if (typeof value === 'object') {
    if (value.createdAt) return timestampValue(value.createdAt);
    if (value.at) return timestampValue(value.at);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const time = timestampValue(value);
  return time
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time))
    : 'Fecha pendiente';
}

function formatDateTime(value) {
  const time = timestampValue(value) || Date.now();
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(new Date(time));
}

function formatMessageTime(value) {
  const time = timestampValue(value) || Date.now();
  const d = new Date(time);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatTimeOnly(time) {
  const val = timestampValue(time) || Date.now();
  const d = new Date(val);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

  startPresenceTracking();
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
  els.openCounterChat.disabled = true;
  els.shareCounter.disabled = true;
  els.deleteCounter.disabled = true;
  els.increment.disabled = false;
  els.decrement.disabled = false;
  if (els.readOnlyNotice) els.readOnlyNotice.classList.add('hidden');
  if (els.chatUnreadCount) els.chatUnreadCount.classList.add('hidden');

  if (state.unsubscribeChat) state.unsubscribeChat();
  if (state.unsubscribeTyping) state.unsubscribeTyping();
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
          createdAt: Date.now() - 3600000,
          updatedAt: Date.now(),
          members: [
            { email: 'tú', name: 'Tú', role: 'Propietario', isOnline: true, lastSeen: Date.now() },
            { email: 'carlos@empresa.com', name: 'Carlos', role: 'Administrador', isOnline: false, lastSeen: Date.now() - 900000 },
            { email: 'ana@empresa.com', name: 'Ana', role: 'Operador', isOnline: true, lastSeen: Date.now() }
          ],
          activity: [{ delta: 1, by: 'Tú', at: Date.now() }],
          messages: [
            {
              id: 'msg-1',
              text: '¡Bienvenidos al conteo colaborativo!',
              senderId: 'carlos',
              senderName: 'Carlos',
              at: Date.now() - 1800000,
              readBy: [{ name: 'Ana', at: Date.now() - 1200000 }]
            }
          ]
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
    subscribeDemoChat(counter);
  } else {
    subscribeActiveCounter(id);
    subscribeEvents(id);
    subscribeCounterChat(id);
    subscribeTyping(id);
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

  els.openCounterChat.disabled = false;
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
  if (!item) return null;
  const time = timestampValue(item.createdAt || item.at);
  return time ? new Date(time) : null;
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

    const itemDate = eventDate(item) || new Date();
    const formattedDate = formatDateTime(itemDate);

    row.innerHTML = `
      <span class="activity-symbol${symbolClass}">${symbol}</span>
      <span class="activity-text">
        <strong>${escapeHtml(item.by || 'Alguien')}</strong> ${actionDesc}
        <small class="activity-datetime-label">🕒 ${formattedDate}</small>
      </span>
      <span class="activity-time">${timeAgo(itemDate)}</span>
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

/* ================= PRESENCE TRACKING ================= */

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

function startPresenceTracking() {
  if (state.presenceInterval) clearInterval(state.presenceInterval);

  if (state.demo) {
    const updateDemoPresence = () => {
      const data = demoData();
      const me = data.counters.flatMap((c) => c.members || []).find((m) => m.email === 'tú' || m.name === 'Tú');
      if (me) {
        me.isOnline = true;
        me.lastSeen = Date.now();
        saveDemo(data);
      }
    };
    updateDemoPresence();
    state.presenceInterval = setInterval(updateDemoPresence, 35000);
    return;
  }

  if (!firebaseReady || !state.user) return;

  const userDocRef = doc(db, 'users', state.user.uid);
  const markOnline = (online = true) => {
    setDoc(userDocRef, { isOnline: online, lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
  };

  markOnline(true);
  state.presenceInterval = setInterval(() => markOnline(true), 40000);

  document.addEventListener('visibilitychange', () => {
    markOnline(!document.hidden);
  });

  window.addEventListener('beforeunload', () => {
    markOnline(false);
  });
}

function renderMembers(counter) {
  els.memberList.innerHTML = '';
  const members = counter.members || [{ name: 'Tú', email: state.user?.email || 'modo demo', role: 'Propietario', isOnline: true, lastSeen: Date.now() }];
  const currentRole = getUserRole(counter);
  const isOwner = currentRole === 'Propietario';

  members.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'member-row';
    const memberRole = member.role || 'Operador';
    const badgeClass =
      memberRole === 'Propietario' ? 'owner' :
      memberRole === 'Administrador' ? 'admin' :
      memberRole === 'Operador' ? 'editor' : 'viewer';

    const presence = getMemberPresence(member);

    const isSelf =
      (member.userId && member.userId === state.user?.uid) ||
      (member.email && member.email.toLowerCase() === state.user?.email?.toLowerCase()) ||
      (state.demo && (member.name === 'Tú' || member.email === 'tú'));

    let removeBtnHtml = '';
    if (isOwner && !isSelf) {
      removeBtnHtml = `
        <button class="member-remove-btn" type="button" title="Eliminar usuario de este contador (solo Propietario)" aria-label="Eliminar usuario">
          ✕ Quitar
        </button>
      `;
    }

    row.innerHTML = `
      <div class="member-avatar-wrapper">
        <span class="member-avatar">${initials(member.name || member.email)}</span>
        <span class="presence-dot ${presence.isOnline ? 'online' : 'offline'}" title="${presence.isOnline ? 'En línea' : 'Desconectado'}"></span>
      </div>
      <div class="member-info">
        <div class="member-name-row">
          <strong>${escapeHtml(member.name || member.email)}</strong>
          <span class="presence-label ${presence.isOnline ? 'online' : 'offline'}">${presence.isOnline ? '🟢 En línea' : `⚪ ${presence.text}`}</span>
        </div>
        <span>
          <span class="role-badge ${badgeClass}" style="font-size: 0.68rem; padding: 2px 6px;">${escapeHtml(memberRole)}</span>
          · ${escapeHtml(member.email || '')}
        </span>
      </div>
      ${removeBtnHtml}
    `;

    if (isOwner && !isSelf) {
      const btn = row.querySelector('.member-remove-btn');
      if (btn) {
        btn.addEventListener('click', () => removeMember(counter, member));
      }
    }

    els.memberList.appendChild(row);
  });
}

async function removeMember(counter, member) {
  const currentRole = getUserRole(counter);
  if (currentRole !== 'Propietario') {
    return showToast('Solo el Propietario tiene permisos para eliminar usuarios.', true);
  }

  const memberName = member.name || member.email || 'este usuario';
  const confirmed = window.confirm(
    `¿Deseas eliminar a "${memberName}" de este contador?\n\nPerderá el acceso y ya no podrá ver ni modificar este contador.`
  );
  if (!confirmed) return;

  const actorName = state.user?.displayName || state.user?.name || (state.demo ? 'Tú' : 'Propietario');
  const now = Date.now();

  if (state.demo) {
    const data = demoData();
    const target = data.counters.find((c) => c.id === counter.id);
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
      state.activeCounter = target;
      state.events = (target.activity || []).slice().reverse();
      renderCounterList();
      renderActiveCounter(target);
      showToast(`Usuario "${memberName}" eliminado del contador.`);
    }
    return;
  }

  try {
    const remainingMembers = (counter.members || []).filter((m) => {
      if (member.userId && m.userId) return m.userId !== member.userId;
      return m.email?.toLowerCase() !== member.email?.toLowerCase();
    });
    const remainingIds = (counter.memberIds || []).filter((id) => id !== member.userId);

    await updateDoc(doc(db, 'counters', counter.id), {
      members: remainingMembers,
      memberIds: remainingIds,
      updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, 'counters', counter.id, 'events'), {
      delta: 0,
      by: actorName,
      actorId: state.user.uid,
      detail: `Eliminó el acceso a ${memberName}`,
      createdAt: serverTimestamp()
    });

    showToast(`Usuario "${memberName}" eliminado del contador.`);
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    showToast('No se pudo eliminar al usuario.', true);
  }
}

/* ================= CHAT EN TIEMPO REAL ================= */

function getChatReadStorageKey(counterId) {
  const uid = state.user?.uid || 'demo';
  return `cj_last_read_${counterId}_${uid}`;
}

function updateUnreadBadge(counterId) {
  const lastRead = Number(localStorage.getItem(getChatReadStorageKey(counterId)) || 0);
  const myUid = state.user?.uid || 'demo';

  const unreadCount = state.chatMessages.filter((msg) => {
    const msgTime = timestampValue(msg.createdAt || msg.at);
    return msgTime > lastRead && msg.senderId !== myUid;
  }).length;

  if (unreadCount > 0 && !state.chatIsOpen) {
    els.chatUnreadCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
    els.chatUnreadCount.classList.remove('hidden');
  } else {
    els.chatUnreadCount.classList.add('hidden');
  }
}

function markMessagesAsRead(counterId) {
  localStorage.setItem(getChatReadStorageKey(counterId), Date.now().toString());
  els.chatUnreadCount.classList.add('hidden');

  if (state.demo) {
    const data = demoData();
    const target = data.counters.find((c) => c.id === counterId);
    if (target && target.messages) {
      target.messages.forEach((msg) => {
        if (msg.senderId !== 'demo') {
          msg.readBy = msg.readBy || [];
          if (!msg.readBy.some((r) => r.name === 'Tú')) {
            msg.readBy.push({ name: 'Tú', at: Date.now() });
          }
        }
      });
      saveDemo(data);
    }
    return;
  }

  if (!firebaseReady || !state.user) return;
  const myUid = state.user.uid;
  const myName = state.user.displayName || 'Usuario';

  state.chatMessages.forEach((msg) => {
    if (msg.id && msg.senderId !== myUid) {
      const alreadyRead = (msg.readBy || []).some((r) => r.userId === myUid);
      if (!alreadyRead) {
        updateDoc(doc(db, 'counters', counterId, 'messages', msg.id), {
          readBy: arrayUnion({ userId: myUid, name: myName, at: Date.now() })
        }).catch(() => {});
      }
    }
  });
}

function formatDateSeparator(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Hoy';
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}

function renderChatMessages(forceScrollBottom = false) {
  const list = els.chatMessagesList;
  if (!list) return;

  const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= 90;
  list.innerHTML = '';

  if (!state.chatMessages.length) {
    list.appendChild(els.chatWelcome);
    if (els.chatScrollBottom) els.chatScrollBottom.classList.add('hidden');
    return;
  }

  const myUid = state.user?.uid || 'demo';
  let lastDay = '';

  state.chatMessages.forEach((msg) => {
    const msgTime = timestampValue(msg.createdAt || msg.at) || Date.now();
    const dayStr = new Date(msgTime).toDateString();

    if (dayStr !== lastDay) {
      lastDay = dayStr;
      const sep = document.createElement('div');
      sep.className = 'chat-date-separator';
      sep.innerHTML = `<span>${formatDateSeparator(msgTime)}</span>`;
      list.appendChild(sep);
    }

    const isMine = msg.senderId === myUid;
    const item = document.createElement('div');
    item.className = `chat-msg ${isMine ? 'mine' : 'theirs'}`;

    const timeStr = formatMessageTime(msgTime);

    let seenHtml = '';
    if (isMine) {
      const others = (msg.readBy || []).filter((r) => r.name !== 'Tú' && r.userId !== myUid);
      if (others.length) {
        const seenNames = others.map((r) => `${r.name} (${formatTimeOnly(r.at)})`).join(', ');
        seenHtml = `<span class="chat-msg-seen" title="Visto por ${seenNames}">✓✓ Visto por ${escapeHtml(seenNames)}</span>`;
      } else {
        seenHtml = '<span class="chat-msg-sent">✓ Enviado</span>';
      }
    }

    const senderName = msg.senderName || 'Colaborador';
    const avatarHtml = isMine
      ? ''
      : `<span class="chat-msg-avatar" title="${escapeHtml(senderName)}">${initials(senderName)}</span>`;

    item.innerHTML = `
      ${avatarHtml}
      <div class="chat-msg-body">
        ${!isMine ? `<span class="chat-msg-author">${escapeHtml(senderName)}</span>` : ''}
        <div class="chat-msg-bubble">${escapeHtml(msg.text)}</div>
        <div class="chat-msg-meta">
          <span>${timeStr}</span>
          ${seenHtml}
        </div>
      </div>
    `;
    list.appendChild(item);
  });

  if (forceScrollBottom || wasNearBottom) {
    requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: forceScrollBottom ? 'auto' : 'smooth' });
    });
    if (els.chatScrollBottom) els.chatScrollBottom.classList.add('hidden');
  } else {
    if (els.chatScrollBottom) els.chatScrollBottom.classList.remove('hidden');
  }
}

function subscribeCounterChat(counterId) {
  if (state.unsubscribeChat) state.unsubscribeChat();

  const q = query(
    collection(db, 'counters', counterId, 'messages'),
    orderBy('createdAt', 'asc')
  );

  state.unsubscribeChat = onSnapshot(q, (snapshot) => {
    state.chatMessages = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    updateUnreadBadge(counterId);
    if (state.chatIsOpen) {
      renderChatMessages();
      markMessagesAsRead(counterId);
    }
  });
}

function subscribeDemoChat(counter) {
  state.chatMessages = counter.messages || [];
  updateUnreadBadge(counter.id);
  if (state.chatIsOpen) {
    renderChatMessages();
    markMessagesAsRead(counter.id);
  }
}

function subscribeTyping(counterId) {
  if (state.unsubscribeTyping) state.unsubscribeTyping();

  state.unsubscribeTyping = onSnapshot(collection(db, 'counters', counterId, 'typing'), (snapshot) => {
    const myUid = state.user?.uid;
    const now = Date.now();
    const typingUsers = [];

    snapshot.forEach((docSnap) => {
      if (docSnap.id !== myUid) {
        const data = docSnap.data();
        const time = timestampValue(data.at);
        if (data.typing && now - time < 5000) {
          typingUsers.push(data.name || 'Alguien');
        }
      }
    });

    if (typingUsers.length && state.chatIsOpen) {
      els.chatTypingText.textContent = `${typingUsers.join(', ')} está escribiendo...`;
      els.chatTypingIndicator.classList.remove('hidden');
    } else {
      els.chatTypingIndicator.classList.add('hidden');
    }
  });
}

function emitTyping(isTyping = true) {
  if (state.demo || !firebaseReady || !state.user || !state.activeCounter) return;

  const typingRef = doc(db, 'counters', state.activeCounter.id, 'typing', state.user.uid);
  setDoc(typingRef, {
    name: state.user.displayName || 'Usuario',
    typing: isTyping,
    at: serverTimestamp()
  }, { merge: true }).catch(() => {});
}

async function sendChatMessage(event) {
  event.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text || !state.activeCounter) return;

  els.chatInput.value = '';
  emitTyping(false);

  const myUid = state.user?.uid || 'demo';
  const myName = state.user?.displayName || state.user?.name || 'Tú';
  const now = Date.now();

  const message = {
    text,
    senderId: myUid,
    senderName: myName,
    senderEmail: state.user?.email || 'demo',
    at: now,
    readBy: []
  };

  if (state.demo) {
    const data = demoData();
    const target = data.counters.find((c) => c.id === state.activeCounter.id);
    if (target) {
      target.messages = [...(target.messages || []), message];
      saveDemo(data);
      state.chatMessages = target.messages;
      renderChatMessages(true);
      markMessagesAsRead(target.id);
    }
    return;
  }

  try {
    await addDoc(collection(db, 'counters', state.activeCounter.id, 'messages'), {
      ...message,
      createdAt: serverTimestamp()
    });
    renderChatMessages(true);
    markMessagesAsRead(state.activeCounter.id);
  } catch {
    showToast('No se pudo enviar el mensaje.', true);
  }
}

function openChat() {
  if (!state.activeCounter) return;
  state.chatIsOpen = true;
  els.chatCounterTitle.textContent = `Chat: ${state.activeCounter.name}`;
  const count = (state.activeCounter.members || []).length;
  els.chatCounterSubtitle.textContent = `${count} participante${count === 1 ? '' : 's'} · En tiempo real`;
  els.chatDialog.showModal();
  renderChatMessages(true);
  markMessagesAsRead(state.activeCounter.id);
  els.chatInput.focus();
}

function closeChat() {
  state.chatIsOpen = false;
  emitTyping(false);
  els.chatDialog.close();
}

/* ================= COUNTER ACTIONS ================= */

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
      members: [{ email: 'tú', name: 'Tú', role: 'Propietario', isOnline: true, lastSeen: Date.now() }],
      activity: [],
      messages: []
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
          userId: state.user.uid,
          isOnline: true,
          lastSeen: serverTimestamp()
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
    target.members = [
      ...(target.members || []),
      { email, name: email.split('@')[0], role, isOnline: false, lastSeen: Date.now() - 3600000 }
    ];
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
        userId: invited.id,
        isOnline: invitedData.isOnline || false,
        lastSeen: invitedData.lastSeen || serverTimestamp()
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
      await setDoc(doc(db, 'users', credentials.user.uid), {
        email,
        name,
        isOnline: true,
        lastSeen: serverTimestamp()
      });
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

function openProfileDialog() {
  const name = state.user?.displayName || state.user?.name || 'Tu cuenta';
  const email = state.user?.email || (state.demo ? 'Modo demo en este navegador' : '');

  els.modalProfileName.textContent = name;
  els.modalProfileDisplayName.textContent = name;
  els.modalProfileEmail.textContent = email;
  els.modalProfileAvatar.textContent = initials(name);
  els.modalProfileStatus.textContent = '🟢 En línea ahora';
  els.profileDialog.showModal();
}

function logout() {
  if (state.presenceInterval) clearInterval(state.presenceInterval);

  if (state.demo) {
    state.demo = false;
    state.user = null;
    if (els.profileDialog) els.profileDialog.close();
    els.appView.classList.add('hidden');
    els.authView.classList.remove('hidden');
    return;
  }

  if (firebaseReady && state.user) {
    const userDocRef = doc(db, 'users', state.user.uid);
    setDoc(userDocRef, { isOnline: false, lastSeen: serverTimestamp() }, { merge: true })
      .finally(() => {
        if (els.profileDialog) els.profileDialog.close();
        signOut(auth);
      });
    return;
  }

  if (els.profileDialog) els.profileDialog.close();
  signOut(auth);
}

function startDemo() {
  setUser({ name: 'Modo demo', email: 'Tus datos quedan en este navegador' }, true);
  loadCounters();
}

/* ================= EVENT LISTENERS ================= */

// PWA Install Prompt handling
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredPrompt = e;
  if (els.pwaInstallBtn) els.pwaInstallBtn.classList.remove('hidden');
});

window.addEventListener('appinstalled', () => {
  if (els.pwaInstallBtn) els.pwaInstallBtn.classList.add('hidden');
  state.deferredPrompt = null;
  showToast('¡Cuenta Juntos se ha instalado correctamente!');
});

// Check if running as installed PWA
if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
  if (els.pwaInstallBtn) els.pwaInstallBtn.classList.add('hidden');
}

if (els.pwaInstallBtn) {
  els.pwaInstallBtn.addEventListener('click', async () => {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      const { outcome } = await state.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        els.pwaInstallBtn.classList.add('hidden');
        state.deferredPrompt = null;
      }
    } else {
      showToast('Para instalar en este dispositivo, selecciona "Añadir a pantalla de inicio" en tu navegador.');
    }
  });
}

// User Profile & Logout Listeners
if (els.userMenu) {
  els.userMenu.addEventListener('click', openProfileDialog);
}
if (els.topbarLogout) {
  els.topbarLogout.addEventListener('click', logout);
}
if (els.logout) {
  els.logout.addEventListener('click', logout);
}
if (els.modalLogout) {
  els.modalLogout.addEventListener('click', logout);
}
if (els.closeProfileDialog) {
  els.closeProfileDialog.addEventListener('click', () => els.profileDialog.close());
}

// Chat Listeners
if (els.openCounterChat) {
  els.openCounterChat.addEventListener('click', openChat);
}
if (els.closeChatDialog) {
  els.closeChatDialog.addEventListener('click', closeChat);
}
if (els.chatForm) {
  els.chatForm.addEventListener('submit', sendChatMessage);
}
if (els.chatInput) {
  els.chatInput.addEventListener('input', () => {
    emitTyping(true);
    if (state.typingTimer) clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => emitTyping(false), 3000);
  });
}
if (els.chatMessagesList) {
  els.chatMessagesList.addEventListener('scroll', () => {
    const isNearBottom = els.chatMessagesList.scrollHeight - els.chatMessagesList.scrollTop - els.chatMessagesList.clientHeight <= 80;
    if (els.chatScrollBottom) {
      els.chatScrollBottom.classList.toggle('hidden', isNearBottom);
    }
  }, { passive: true });
}
if (els.chatScrollBottom) {
  els.chatScrollBottom.addEventListener('click', () => {
    els.chatMessagesList.scrollTo({ top: els.chatMessagesList.scrollHeight, behavior: 'smooth' });
    els.chatScrollBottom.classList.add('hidden');
  });
}

// Counter and App Listeners
if (els.counterList) {
  els.counterList.addEventListener('wheel', (e) => {
    if (els.counterList.scrollWidth > els.counterList.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      els.counterList.scrollLeft += e.deltaY;
    }
  }, { passive: true });
}

if (els.authForm) els.authForm.addEventListener('submit', handleAuth);
if (els.authToggle) els.authToggle.addEventListener('click', toggleAuth);
if (els.demoLogin) els.demoLogin.addEventListener('click', startDemo);
if (els.counterSearch) els.counterSearch.addEventListener('input', renderCounterList);
if (els.counterDate) els.counterDate.addEventListener('change', renderCounterList);
if (els.activitySearch) els.activitySearch.addEventListener('input', renderActivity);
if (els.activityFrom) els.activityFrom.addEventListener('change', renderActivity);
if (els.activityTo) els.activityTo.addEventListener('change', renderActivity);

if (els.newCounter) els.newCounter.addEventListener('click', () => els.counterDialog?.showModal());
if (els.emptyNewCounter) els.emptyNewCounter.addEventListener('click', () => els.counterDialog?.showModal());
if (els.counterForm) els.counterForm.addEventListener('submit', createCounter);
if (els.closeCounterDialog) els.closeCounterDialog.addEventListener('click', () => els.counterDialog?.close());
if (els.cancelCounterDialog) els.cancelCounterDialog.addEventListener('click', () => els.counterDialog?.close());

if (els.shareCounter) els.shareCounter.addEventListener('click', () => els.shareDialog?.showModal());
if (els.inviteMember) {
  els.inviteMember.addEventListener('click', () => els.shareDialog?.showModal());
}
if (els.shareForm) els.shareForm.addEventListener('submit', inviteMember);
if (els.closeShareDialog) els.closeShareDialog.addEventListener('click', () => els.shareDialog?.close());
if (els.cancelShareDialog) els.cancelShareDialog.addEventListener('click', () => els.shareDialog?.close());

if (els.increment) els.increment.addEventListener('click', () => changeCount(1));
if (els.decrement) els.decrement.addEventListener('click', () => changeCount(-1));
if (els.deleteCounter) els.deleteCounter.addEventListener('click', deleteCounter);

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
