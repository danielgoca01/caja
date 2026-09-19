/* Caja Casa: durable operation journal. No credentials or endpoint live here.
 * GAS_API must be supplied by the host before this script loads.
 * Every operation is persisted before it appears in the UI. A successful POST
 * becomes a durable acknowledgement; only a persisted, sufficiently recent
 * server snapshot can retire it. Web Locks serialize tabs where supported.
 */
'use strict';

var LS = {
  data: 'cajaData', outbox: 'cajaOutbox', clientId: 'cajaClientId', privacy: 'cajaPrivacy',
  opPrefix: 'cajaOp:v3:', snapshotPrefix: 'cajaSnapshot:v3:', migration: 'cajaOutboxMigration:v3', lease: 'cajaSyncLease:v3'
};
var S = {
  server: { transactions: [], config: { initialBalance: 0, name1: 'Daniel', name2: 'Thalía' }, v: null },
  outbox: [], names: { d: 'Daniel', t: 'Thalía' }, hideBalance: false, sync: {}
};
var _draining = false, _drainPromise = null, _drainTimer = null, _fetchingAll = null;
var _checkingVersion = null, _inflightOp = null, _networkHealthy = false;
var _storageError = '', _journalError = '', _migrationError = '', _readError = '', _lastNetworkError = '', _lastSuccessAt = null;
var _booted = false, _lastOpTimestamp = 0, _tabId = uniqueId('tab');

function uniqueId(prefix) {
  return prefix + ':' + (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : Date.now().toString(36) + ':' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
}
function copy(value) { return JSON.parse(JSON.stringify(value)); }
function storageFailure(error) {
  _storageError = 'No se pudo guardar en este dispositivo. Libera espacio y vuelve a intentar.';
  var failure = new Error(_storageError);
  failure.code = 'LOCAL_STORAGE'; failure.cause = error;
  setSync();
  return failure;
}
function lsGet(key, fallback) {
  try { var value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); }
  catch (error) { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); _storageError = ''; }
  catch (error) { throw storageFailure(error); }
}
function clientId() {
  var id;
  try {
    id = localStorage.getItem(LS.clientId);
    if (!id) { id = uniqueId('client'); localStorage.setItem(LS.clientId, id); }
  } catch (error) { throw storageFailure(error); }
  return id;
}
function refreshJournal() {
  var operations = [], records = [], keys = [];
  _journalError = '';
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf(LS.opPrefix) === 0) keys.push(key);
    }
    keys.forEach(function(key) {
      var raw = localStorage.getItem(key);
      if (raw === null) return;
      try {
        var op = JSON.parse(raw);
        if (!op || !op.id || !op.payload || ['add', 'del', 'setConfig'].indexOf(op.op) < 0) throw new Error('invalid journal');
        records.push(op);
      } catch (error) { _journalError = 'Hay un registro local dañado. Descarga una copia de seguridad.'; }
    });
  } catch (error) { throw storageFailure(error); }
  // The archived parent records its dependent deletes before any child changes.
  // On a crash between those writes this recovery runs before any network send.
  var discardedDeletes = new Set();
  records.forEach(function(op) {
    if (op.status === 'resolved' && op.resolution === 'discarded-local')
      (op.dependentDeleteIds || []).forEach(function(id) { discardedDeletes.add(id); });
  });
  records.forEach(function(op) {
    if (discardedDeletes.has(op.id) && op.op === 'del' && op.status === 'pending' && !op.tries) {
      op = Object.assign({}, op, { status: 'resolved', resolution: 'discarded-dependent-delete' });
      persistOperation(op);
    }
    // Resolved rejects remain in the journal/backup as an audit trail.
    if (op.status !== 'resolved') operations.push(op);
  });
  operations.sort(function(a, b) { return a.ts - b.ts || a.id.localeCompare(b.id); });
  S.outbox = operations;
  return operations;
}
function readOperation(id) {
  var raw;
  try { raw = localStorage.getItem(LS.opPrefix + id); }
  catch (error) { throw storageFailure(error); }
  return raw === null ? null : JSON.parse(raw);
}
function persistOperation(op) { lsSet(LS.opPrefix + op.id, op); }
function paint() { if (typeof render === 'function') render(); setSync(); }

/* Validation errors are synchronous: the form must remain open with its data. */
function cleanLocalText(value) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim(); }
function validTransactionDate(value) {
  if (typeof value !== 'string') return false;
  var match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))?)?$/.exec(value);
  if (!match) return false;
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return false;
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return false;
  if (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59)) return false;
  if (match[8] !== undefined && (Number(match[8]) > 14 || Number(match[9]) > 59 || (Number(match[8]) === 14 && Number(match[9]) !== 0))) return false;
  return true;
}
function validateTransaction(tx) {
  if (!tx || typeof tx !== 'object' || Array.isArray(tx) || typeof tx.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(tx.id)) throw new Error('El movimiento necesita un identificador válido.');
  if (tx.type !== 'ingreso' && tx.type !== 'egreso') throw new Error('Selecciona ingreso o gasto.');
  if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0 || tx.amount > 1e12) throw new Error('Ingresa un valor positivo, en pesos completos.');
  if (tx.person !== 'd' && tx.person !== 't') throw new Error('Selecciona quién hizo el movimiento.');
  if (!validTransactionDate(tx.date)) throw new Error('Selecciona una fecha válida entre 1900 y 2200.');
  if (tx.description !== undefined && (typeof tx.description !== 'string' || tx.description.length > 500) ||
      tx.category !== undefined && (typeof tx.category !== 'string' || tx.category.length > 64)) throw new Error('La descripción o categoría no es válida.');
}
function normalizedTransaction(tx) {
  return { id: tx.id, date: tx.date, type: tx.type, category: cleanLocalText(tx.category || ''),
    description: cleanLocalText(tx.description || ''), amount: tx.amount, person: tx.person };
}
function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('La configuración no es válida.');
  if (!Object.keys(settings).length || Object.keys(settings).some(function(key) { return ['initialBalance', 'name1', 'name2'].indexOf(key) < 0; })) throw new Error('La configuración contiene campos desconocidos o está vacía.');
  if (settings.initialBalance !== undefined && (!Number.isSafeInteger(settings.initialBalance) || Math.abs(settings.initialBalance) > 1e12)) throw new Error('El saldo inicial debe ser un valor en pesos completos.');
  ['name1', 'name2'].forEach(function(key) {
    if (settings[key] !== undefined && (typeof settings[key] !== 'string' || !cleanLocalText(settings[key]) || settings[key].length > 60)) throw new Error('Los nombres deben tener entre 1 y 60 caracteres.');
  });
}
function enqueue(op, payload) {
  refreshJournal();
  _lastOpTimestamp = Math.max(Date.now(), _lastOpTimestamp + 1,
    S.outbox.reduce(function(max, item) { return Math.max(max, item.ts + 1); }, 0));
  var record = { id: uniqueId('op'), op: op, payload: copy(payload), ts: _lastOpTimestamp,
    status: 'pending', tries: 0, nextAttemptAt: 0 };
  persistOperation(record); // Intentionally before changing S or calling render.
  refreshJournal();
  paint();
  drainOutbox();
  return record;
}
function opAddTx(tx) {
  validateTransaction(tx);
  tx = normalizedTransaction(tx);
  refreshJournal();
  var existing = S.outbox.find(function(op) { return op.op === 'add' && op.payload.tx.id === tx.id; });
  if (existing) {
    if (JSON.stringify(normalizedTransaction(existing.payload.tx)) !== JSON.stringify(tx)) throw new Error('Ese identificador ya pertenece a otro movimiento.');
    return existing;
  }
  return enqueue('add', { tx: tx });
}
function opDelTx(id) {
  if (typeof id !== 'string' || !id) throw new Error('No se encontró el movimiento.');
  // Always journal deletes. An earlier timed-out add may already be on the server.
  return enqueue('del', { id: id });
}
function opSetConfig(settings) {
  validateSettings(settings);
  var cleaned = {};
  Object.keys(settings).forEach(function(key) { cleaned[key] = key === 'initialBalance' ? settings[key] : cleanLocalText(settings[key]); });
  return enqueue('setConfig', { settings: cleaned });
}
function discardFailedOperation(id) {
  refreshJournal();
  var op = readOperation(id);
  if (!op || op.status !== 'failed') throw new Error('Solo se pueden descartar intentos rechazados. Los pendientes deben terminar de sincronizar.');
  var dependentIds = op.op === 'add' ? S.outbox.filter(function(item) {
    return item.op === 'del' && item.payload.id === op.payload.tx.id && item.ts > op.ts &&
      item.status === 'pending' && !item.tries && (!_inflightOp || _inflightOp.id !== item.id);
  }).map(function(item) { return item.id; }) : [];
  persistOperation(Object.assign({}, op, { status: 'resolved', resolution: 'discarded-local',
    resolvedAt: Date.now(), dependentDeleteIds: dependentIds }));
  refreshJournal(); paint();
  return true;
}

function effectiveTxs() {
  var byId = new Map();
  S.server.transactions.forEach(function(tx) { byId.set(tx.id, tx); });
  S.outbox.forEach(function(op) {
    if (op.op === 'add') byId.set(op.payload.tx.id, op.payload.tx);
    if (op.op === 'del') byId.delete(op.payload.id);
  });
  return Array.from(byId.values());
}
function effectiveConfig() {
  var config = Object.assign({}, S.server.config);
  S.outbox.forEach(function(op) {
    if (op.op === 'setConfig' && op.status !== 'failed') Object.keys(op.payload.settings).forEach(function(key) {
      config[key] = key === 'initialBalance' ? op.payload.settings[key] : cleanLocalText(op.payload.settings[key]);
    });
  });
  return config;
}
function isPending(id) { return S.outbox.some(function(op) { return op.op === 'add' && op.payload.tx.id === id; }); }

function requestError(message, code, retryable) {
  var error = new Error(message); error.code = code; error.retryable = retryable; return error;
}
function api(action, payload, operationId) {
  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer;
  var request = Promise.resolve().then(function() {
    if (typeof GAS_API !== 'string' || !GAS_API) throw requestError('Falta la conexión de Caja Casa.', 'CONFIGURATION', false);
    return fetch(GAS_API, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, payload: payload || {}, clientId: clientId(), operationId: operationId }),
      signal: controller ? controller.signal : undefined
    });
  }).then(function(response) {
    if (response.ok === false) throw requestError('El servidor respondió ' + response.status + '.', 'HTTP_' + response.status,
      response.status === 408 || response.status === 429 || response.status >= 500);
    return response.text();
  }).then(function(text) {
    var data;
    try { data = JSON.parse(text); } catch (error) { throw requestError('El servidor no entregó una respuesta válida.', 'INVALID_RESPONSE', true); }
    if (!data || data.ok !== true) {
      var message = data && data.error || 'No se pudo completar la solicitud.';
      var retryable = data && typeof data.retryable === 'boolean' ? data.retryable : !/debe ser|requerido|unknown action|inválid|invalid/i.test(message);
      throw requestError(message, data && data.code || 'SERVER_ERROR', retryable);
    }
    return data;
  });
  var timeout = new Promise(function(resolve, reject) {
    timer = setTimeout(function() {
      if (controller) controller.abort();
      reject(requestError('El servidor está tardando. Tus cambios siguen guardados aquí.', 'TIMEOUT', true));
    }, 20000);
  });
  return Promise.race([request, timeout]).finally(function() { clearTimeout(timer); });
}
function networkSucceeded() { _networkHealthy = true; _lastNetworkError = ''; _readError = ''; _lastSuccessAt = Date.now(); }
function networkFailed(error) {
  _networkHealthy = false; _lastNetworkError = error && error.message || 'No se pudo conectar con el servidor.';
  _readError = error && error.retryable === false ? error.message : '';
}

/* Immutable snapshots by version prevent two tabs from replacing a newer cache
 * with an older response between separate localStorage reads and writes. */
function latestSnapshot() {
  var latest = lsGet(LS.data, null);
  if (!latest || !Array.isArray(latest.transactions)) latest = null;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || key.indexOf(LS.snapshotPrefix) !== 0) continue;
      var candidate = lsGet(key, null);
      if (candidate && Array.isArray(candidate.transactions) && Number.isFinite(candidate.v) &&
          (!latest || !Number.isFinite(latest.v) || candidate.v > latest.v)) latest = candidate;
    }
  } catch (error) { throw storageFailure(error); }
  return latest;
}
function trimSnapshots() {
  var versions = [];
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key && key.indexOf(LS.snapshotPrefix) === 0) versions.push({ key: key, v: Number(key.slice(LS.snapshotPrefix.length)) });
  }
  versions.sort(function(a, b) { return b.v - a.v; });
  versions.slice(2).forEach(function(item) { localStorage.removeItem(item.key); });
}

function snapshotReflects(op, snapshot) {
  if (op.op === 'add') return snapshot.transactions.some(function(tx) { return tx.id === op.payload.tx.id; });
  if (op.op === 'del') return !snapshot.transactions.some(function(tx) { return tx.id === op.payload.id; });
  return Object.keys(op.payload.settings).every(function(key) {
    var expected = key === 'initialBalance' ? op.payload.settings[key] : cleanLocalText(op.payload.settings[key]);
    return snapshot.config[key] === expected;
  });
}
function retireAcknowledged() {
  refreshJournal();
  S.outbox.forEach(function(op) {
    if (op.status !== 'acknowledged') return;
    var currentEnough = typeof op.ackVersion === 'number' && S.server.v >= op.ackVersion;
    // A later version can legitimately contain another person's subsequent edit.
    if (currentEnough && (S.server.v > op.ackVersion || snapshotReflects(op, S.server))) {
      if (op.op === 'setConfig') {
        S.outbox.forEach(function(earlier) {
          if (earlier.op !== 'setConfig' || earlier.status !== 'failed' || earlier.ts >= op.ts) return;
          var superseded = Array.from(new Set((earlier.supersededKeys || []).concat(
            Object.keys(earlier.payload.settings).filter(function(key) { return Object.prototype.hasOwnProperty.call(op.payload.settings, key); }))));
          if (!superseded.length) return;
          var resolved = Object.keys(earlier.payload.settings).every(function(key) { return superseded.indexOf(key) >= 0; });
          persistOperation(Object.assign({}, earlier, { supersededKeys: superseded, resolvedBy: op.id,
            status: resolved ? 'resolved' : 'failed' }));
        });
      }
      try { localStorage.removeItem(LS.opPrefix + op.id); }
      catch (error) { throw storageFailure(error); }
    }
  });
  refreshJournal();
}
function applyServer(data) {
  if (!data || !Array.isArray(data.transactions) || !data.config || !Number.isFinite(data.v)) {
    throw requestError('Los datos del servidor están incompletos. Conservamos tu copia local.', 'INVALID_SNAPSHOT', true);
  }
  var persisted = latestSnapshot();
  if (persisted && typeof persisted.v === 'number' && (S.server.v === null || persisted.v > S.server.v)) S.server = persisted;
  if (S.server.v !== null && data.v < S.server.v) return false;
  var snapshot = { transactions: copy(data.transactions), config: copy(data.config), v: data.v,
    duplicateRows: Number.isInteger(data.duplicateRows) ? data.duplicateRows : 0 };
  lsSet(LS.snapshotPrefix + data.v, snapshot);
  lsSet(LS.data, snapshot); // Keep the old cache key for backwards compatibility.
  S.server = snapshot;
  retireAcknowledged();
  trimSnapshots();
  paint();
  return true;
}
function fetchAll() {
  if (_fetchingAll) return _fetchingAll;
  _fetchingAll = api('getAll', {}).then(function(response) {
    var data = response.data || response;
    if (data.v === undefined) data = Object.assign({}, data, { v: response.v });
    applyServer(data); networkSucceeded();
    return S.server;
  }).catch(function(error) { networkFailed(error); throw error; }).finally(function() {
    _fetchingAll = null; setSync();
  });
  setSync();
  return _fetchingAll;
}
function maybeRefresh(version) {
  refreshJournal();
  if (S.server.v === null || version > S.server.v || S.outbox.some(function(op) { return op.status === 'acknowledged'; })) return fetchAll();
  return Promise.resolve(S.server);
}
function checkVersion() {
  if (_checkingVersion) return _checkingVersion;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { setSync(); return Promise.resolve(false); }
  _checkingVersion = api('getVersion', {}).then(function(response) {
    if (!Number.isFinite(response.v)) throw requestError('La versión del servidor no es válida.', 'INVALID_RESPONSE', true);
    return maybeRefresh(response.v).then(function() { networkSucceeded(); return true; });
  }).catch(function(error) { networkFailed(error); return false; }).finally(function() {
    _checkingVersion = null; setSync();
  });
  setSync();
  return _checkingVersion;
}

/* Web Locks protect config ordering and prevent one tab replaying a stale add
 * after another tab deletes it. The lease is a compatibility fallback; servers
 * additionally receive a stable operationId for idempotent mutation receipts. */
function withSyncLock(work) {
  if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
    return navigator.locks.request('caja-casa-sync-v3', { ifAvailable: true }, function(lock) {
      return lock ? work() : false;
    });
  }
  var lease = lsGet(LS.lease, null);
  if (lease && lease.until > Date.now() && lease.owner !== _tabId) return Promise.resolve(false);
  lsSet(LS.lease, { owner: _tabId, until: Date.now() + 30000 });
  return new Promise(function(resolve) { setTimeout(resolve, 40 + Math.floor(Math.random() * 60)); }).then(function() {
    var current = lsGet(LS.lease, null);
    if (!current || current.owner !== _tabId) return false;
    return work();
  }).finally(function() {
    var current = lsGet(LS.lease, null);
    if (current && current.owner === _tabId) localStorage.removeItem(LS.lease);
  });
}
function scheduleDrain(delay) {
  clearTimeout(_drainTimer);
  _drainTimer = setTimeout(function() { _drainTimer = null; drainOutbox(); }, Math.max(250, delay || 1000));
}
function nextOperation() {
  refreshJournal();
  var pending = S.outbox.filter(function(op) { return op.status !== 'failed' && op.status !== 'acknowledged'; });
  return pending.find(function(op) {
    if ((op.nextAttemptAt || 0) > Date.now()) return false;
    // Never send a delete before a preceding add, or reorder configuration.
    return !S.outbox.some(function(earlier) {
      if (earlier.id === op.id || earlier.ts >= op.ts || earlier.status === 'acknowledged') return false;
      return op.op === 'del' && earlier.op === 'add' && earlier.payload.tx.id === op.payload.id ||
        op.op === 'setConfig' && earlier.op === 'setConfig' && earlier.status !== 'failed';
    });
  });
}
function drainOutbox() {
  if (_drainPromise) return _drainPromise;
  try { refreshJournal(); } catch (error) { setSync(); return Promise.resolve(false); }
  if (typeof navigator !== 'undefined' && navigator.onLine === false || !S.outbox.length) { setSync(); return Promise.resolve(false); }
  _draining = true;
  _drainPromise = Promise.resolve().then(function() {
    return withSyncLock(async function() {
      // One operation per lease/lock keeps fallback lease shorter than its TTL.
      var op = nextOperation();
      if (!op) return false;
      op = readOperation(op.id);
      if (!op || op.status === 'acknowledged' || op.status === 'failed') return false;
      _inflightOp = op;
      try {
        var response = await api(op.op, op.payload, op.id);
        networkSucceeded();
        var appliedVersion = response.data && Number.isFinite(response.data.appliedVersion) ? response.data.appliedVersion : response.v;
        var acknowledged = Object.assign({}, op, { status: 'acknowledged', ackVersion: appliedVersion,
          acknowledgedAt: Date.now(), error: '', code: '', nextAttemptAt: 0 });
        if (!Number.isFinite(response.v)) throw requestError('Falta confirmar la versión guardada.', 'INVALID_RESPONSE', true);
        persistOperation(acknowledged); // Do not retire or forget a successful POST in RAM.
      } catch (error) {
        if (error.code === 'LOCAL_STORAGE') throw error;
        if (error.retryable !== false) networkFailed(error);
        var failure = Object.assign({}, op, { tries: (op.tries || 0) + 1, error: error.message,
          code: error.code || 'NETWORK', retryable: error.retryable !== false,
          status: error.retryable === false ? 'failed' : 'pending' });
        failure.nextAttemptAt = failure.status === 'failed' ? 0 : Date.now() + Math.min(30000, 1000 * Math.pow(2, Math.min(failure.tries, 5)));
        persistOperation(failure);
      } finally { _inflightOp = null; }
      return true;
    });
  }).catch(function(error) { if (error.code !== 'LOCAL_STORAGE') networkFailed(error); return false; }).finally(function() {
    _draining = false; _drainPromise = null;
    try { refreshJournal(); } catch (error) { setSync(); return; }
    paint();
    if (_storageError) return;
    if (S.outbox.some(function(op) { return op.status === 'acknowledged'; })) {
      fetchAll().catch(function() {}).finally(function() { if (S.outbox.some(function(op) { return op.status === 'acknowledged'; })) scheduleDrain(5000); });
    }
    var next = nextOperation();
    if (next) scheduleDrain(250);
    else {
      var waiting = S.outbox.filter(function(op) { return op.status === 'pending' && op.nextAttemptAt > Date.now(); });
      if (waiting.length) scheduleDrain(Math.min.apply(null, waiting.map(function(op) { return op.nextAttemptAt - Date.now(); })));
    }
    setSync();
  });
  setSync();
  return _drainPromise;
}

function setSync() {
  var failed = S.outbox.filter(function(op) { return op.status === 'failed'; });
  var pending = S.outbox.filter(function(op) { return op.status !== 'failed'; }).length;
  var state = 'idle', label = 'Sincronizado';
  if (_storageError || _journalError || _migrationError) { state = 'error'; label = 'Revisa el guardado local'; }
  else if (_readError) { state = 'error'; label = 'Los datos requieren revisión'; }
  else if (failed.length) { state = 'error'; label = failed.length + (failed.length === 1 ? ' requiere revisión' : ' requieren revisión'); }
  else if (typeof navigator !== 'undefined' && navigator.onLine === false) { state = 'offline'; label = pending ? 'Sin conexión · guardado aquí' : 'Sin conexión'; }
  else if (_draining || _fetchingAll || _checkingVersion) { state = 'syncing'; label = 'Sincronizando…'; }
  else if (!_networkHealthy) { state = 'offline'; label = _lastNetworkError ? 'Sin conexión al servidor' : 'Comprobando conexión'; }
  else if (pending) { state = 'pending'; label = 'Guardado aquí · pendiente'; }
  S.sync = { state: state, pendingCount: pending, failedCount: failed.length, lastSuccessAt: _lastSuccessAt,
    storageError: _storageError || _journalError || _migrationError,
    lastError: _storageError || _journalError || _migrationError || _readError || (failed[0] && failed[0].error) || _lastNetworkError };
  if (typeof document === 'undefined') return state;
  var dot = document.getElementById('syncDot'), count = document.getElementById('syncCount'), text = document.getElementById('syncText');
  if (dot) dot.className = 'sync-dot' + (state === 'idle' ? '' : ' ' + state);
  if (text) { text.textContent = label; text.title = S.sync.lastError || ''; }
  if (count) {
    count.textContent = S.outbox.length + (S.outbox.length === 1 ? ' pendiente' : ' pendientes');
    if (count.classList) count.classList.toggle('show', S.outbox.length > 0);
  }
  return state;
}

function migrationHash(value) {
  var hash = 2166136261;
  for (var i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}
function migrateLegacyOutbox() {
  var raw = localStorage.getItem(LS.outbox);
  if (!raw || localStorage.getItem(LS.migration) === raw) return;
  var legacy = JSON.parse(raw);
  if (!Array.isArray(legacy)) throw new Error('La cola anterior no tiene un formato válido.');
  legacy.forEach(function(old, index) {
    if (!old || ['add', 'del', 'setConfig'].indexOf(old.op) < 0 || !old.payload) throw new Error('Hay un movimiento anterior que necesita revisión.');
    var id = 'legacy:' + migrationHash(JSON.stringify(old)) + ':' + index;
    if (!readOperation(id)) persistOperation({ id: id, op: old.op, payload: old.payload,
      ts: Number(old.ts) || Date.now() + index, status: 'pending', tries: Number(old.tries) || 0, nextAttemptAt: 0 });
  });
  // Keep the original legacy value as a recovery copy; record exactly what migrated.
  try { localStorage.setItem(LS.migration, raw); } catch (error) { throw storageFailure(error); }
}
function boot() {
  var cached;
  try { cached = latestSnapshot(); } catch (error) { cached = lsGet(LS.data, null); }
  if (cached && Array.isArray(cached.transactions)) {
    S.server = { transactions: cached.transactions, config: Object.assign({}, S.server.config, cached.config),
      v: typeof cached.v === 'number' ? cached.v : null, duplicateRows: Number(cached.duplicateRows) || 0 };
  }
  try { migrateLegacyOutbox(); }
  catch (error) { if (!_storageError) _migrationError = error.message; }
  try { refreshJournal(); retireAcknowledged(); }
  catch (error) { if (!_storageError) _journalError = error.message; }
  S.hideBalance = lsGet(LS.privacy, false) === true;
  paint();
  if (typeof hideLoading === 'function') hideLoading();
  if (!_booted && typeof window !== 'undefined') {
    window.addEventListener('storage', function(event) {
      if (!event.key || event.key.indexOf(LS.opPrefix) === 0 || event.key.indexOf(LS.snapshotPrefix) === 0 || event.key === LS.data) {
        try {
          var latest = latestSnapshot();
          if (latest && Array.isArray(latest.transactions) && typeof latest.v === 'number' && (S.server.v === null || latest.v > S.server.v)) S.server = latest;
          refreshJournal(); paint(); drainOutbox();
        } catch (error) { setSync(); }
      }
    });
    window.addEventListener('offline', function() { _networkHealthy = false; setSync(); });
  }
  _booted = true;
  drainOutbox();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(false);
  return S.server.v === null ? fetchAll().catch(function() { return false; }) : checkVersion();
}
function retrySync() {
  try {
    refreshJournal();
    S.outbox.forEach(function(op) {
      if (op.status === 'acknowledged' || op.supersededKeys && op.supersededKeys.length) return;
      persistOperation(Object.assign({}, op, { status: 'pending', nextAttemptAt: 0, error: '', code: '', tries: 0 }));
    });
    refreshJournal(); paint();
  } catch (error) { setSync(); return Promise.resolve(false); }
  return drainOutbox().then(function() { return checkVersion(); });
}
function exportBackup() {
  var journal = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && (key.indexOf(LS.opPrefix) === 0 || key === LS.outbox)) journal[key] = localStorage.getItem(key);
    }
  } catch (error) { /* The in-memory copy is still useful if storage was revoked. */ }
  var backup = { app: 'Caja Casa', formatVersion: 3, exportedAt: new Date().toISOString(),
    server: copy(S.server), operations: copy(S.outbox), transactions: copy(effectiveTxs()), config: copy(effectiveConfig()), rawJournal: journal };
  var data = JSON.stringify(backup, null, 2);
  if (typeof document !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    var url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    var anchor = document.createElement('a'); anchor.href = url;
    anchor.download = 'caja-casa-respaldo-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }
  return data;
}
