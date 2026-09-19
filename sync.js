/* Caja Casa: durable operation journal. No credentials or endpoint live here.
 * GAS_API must be supplied by the host before this script loads.
 * Every operation is persisted before it appears in the UI. A successful POST
 * becomes a durable acknowledgement; only a persisted, sufficiently recent
 * server snapshot can retire it. Web Locks serialize tabs where supported.
 */
'use strict';

var LS = {
  data: 'cajaData', outbox: 'cajaOutbox', clientId: 'cajaClientId', privacy: 'cajaPrivacy',
  opPrefix: 'cajaOp:v3:', snapshotPrefix: 'cajaSnapshot:v3:', migration: 'cajaOutboxMigration:v3', lease: 'cajaSyncLease:v3',
  batchRowPrefix: 'cajaBatchRow:v3:', batchDiscardPrefix: 'cajaBatchDiscard:v3:'
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
        if (!op || !op.id || LS.opPrefix + op.id !== key || !op.payload || ['add', 'addBatch', 'edit', 'del', 'setConfig'].indexOf(op.op) < 0) throw new Error('invalid journal');
        if (op.op === 'edit') validateEditPayload(op.payload.tx, op.payload.before);
        if (op.op === 'addBatch') {
          if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(op.batchId) || !Array.isArray(op.payload.transactions) ||
              !op.payload.transactions.length || op.payload.transactions.length > 50 ||
              op.id !== 'batch:' + op.batchId + ':' + migrationHash(JSON.stringify(op.payload.transactions))) throw new Error('invalid batch');
          op.payload.transactions.forEach(validateTransaction);
        }
        records.push(op);
      } catch (error) { _journalError = 'Hay un registro local dañado. Descarga una copia de seguridad.'; }
    });
  } catch (error) { throw storageFailure(error); }
  // The archived parent records its dependent edits/deletes before child changes.
  // On a crash between those writes this recovery runs before any network send.
  var discardedDependents = new Set();
  records.forEach(function(op) {
    if (op.status === 'resolved' && op.resolution === 'discarded-local')
      (op.dependentDeleteIds || []).concat(op.dependentOperationIds || []).forEach(function(id) { discardedDependents.add(id); });
    if (op.op === 'addBatch') {
      var discarded = readBatchDiscard(op.id);
      (discarded.dependentDeleteIds || []).concat(discarded.dependentOperationIds || []).forEach(function(id) { discardedDependents.add(id); });
    }
  });
  records.forEach(function(op) {
    if (op.op === 'addBatch') {
      var conflict = records.some(function(other) { return other.op === 'addBatch' && other.batchId === op.batchId && other.id !== op.id; });
      op = hydrateBatch(op, conflict);
    }
    if (discardedDependents.has(op.id) && (op.op === 'del' || op.op === 'edit') && operationUnsent(op)) {
      op = Object.assign({}, op, { status: 'resolved', resolution: op.op === 'del' ? 'discarded-dependent-delete' : 'discarded-dependent-edit' });
      persistOperation(op);
    }
    // Resolved rejects remain in the journal/backup as an audit trail.
    if (op.status !== 'resolved') operations.push(op);
  });
  operations.sort(compareOperations);
  // A row receipt can arrive from another tab before its storage event. Adopt
  // the snapshot it was confirmed against before excluding that row's overlay.
  var persisted = latestSnapshot();
  if (persisted && Number.isFinite(persisted.v) && (S.server.v === null || persisted.v > S.server.v)) S.server = persisted;
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
function compareOperations(a, b) { return a.ts - b.ts || a.id.localeCompare(b.id); }
function operationTransactionId(op) {
  return op.op === 'add' || op.op === 'edit' ? op.payload.tx.id : op.op === 'del' ? op.payload.id : null;
}
function operationUnsent(op) {
  return op.status === 'pending' && !op.tries && !op.attemptedAt && (!_inflightOp || _inflightOp.id !== op.id);
}
function assertTransactionWritable(id) {
  var failed = S.outbox.some(function(op) {
    return op.op === 'addBatch' ? op.rows.some(function(row) { return row.transactionId === id && row.status === 'failed'; }) :
      op.status === 'failed' && operationTransactionId(op) === id;
  });
  if (failed) throw new Error('Este movimiento tiene un intento rechazado. Abre Ajustes y resuélvelo o descarta el intento local antes de editar o eliminar.');
}
function dependentOperationIds(op, transactionIds) {
  return S.outbox.filter(function(item) {
    return (item.op === 'edit' || item.op === 'del') && transactionIds.indexOf(operationTransactionId(item)) >= 0 &&
      compareOperations(item, op) > 0 && operationUnsent(item);
  }).map(function(item) { return item.id; });
}

/* The batch payload is immutable and written once. Progress uses independent
 * row keys, so a second tab confirming the same preview cannot reset an ACK.
 * Completed payloads/row receipts stay local for retry-after-reload idempotency. */
function readBatchValue(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) { throw storageFailure(error); }
}
function readBatchDiscard(id) {
  var value = readBatchValue(LS.batchDiscardPrefix + id, { indices: [], dependentDeleteIds: [] });
  if (!value || !Array.isArray(value.indices) || !Array.isArray(value.dependentDeleteIds) ||
      value.indices.some(function(index) { return !Number.isInteger(index) || index < 0 || index >= 50; }) ||
      value.dependentDeleteIds.some(function(id) { return typeof id !== 'string'; }) ||
      value.dependentOperationIds !== undefined && (!Array.isArray(value.dependentOperationIds) ||
        value.dependentOperationIds.some(function(id) { return typeof id !== 'string'; })))
    throw storageFailure(new Error('El registro de descarte del lote está dañado.'));
  return value;
}
function readBatchRow(op, index) {
  var row = readBatchValue(LS.batchRowPrefix + op.id + ':' + index, null);
  if (row && (row.index !== index || row.transactionId !== op.payload.transactions[index].id || row.operationId !== op.id + ':' + index ||
      ['pending', 'failed', 'acknowledged', 'resolved'].indexOf(row.status) < 0 || !Number.isInteger(row.tries) || row.tries < 0 ||
      !Number.isFinite(row.nextAttemptAt) || row.status === 'resolved' && row.resolution !== 'confirmed' ||
      (row.status === 'acknowledged' || row.status === 'resolved' && row.resolution === 'confirmed') && !Number.isFinite(row.ackVersion)))
    throw storageFailure(new Error('El progreso de una fila del lote está dañado.'));
  return Object.assign({ index: index, transactionId: op.payload.transactions[index].id,
    operationId: op.id + ':' + index, status: 'pending', tries: 0, nextAttemptAt: 0 }, row || {});
}
function persistBatchRow(op, row) { lsSet(LS.batchRowPrefix + op.id + ':' + row.index, row); }
function hydrateBatch(record, conflict) {
  var op = Object.assign({}, record), discarded = readBatchDiscard(op.id);
  op.rows = op.payload.transactions.map(function(tx, index) {
    var row = readBatchRow(op, index);
    if ((discarded.indices || []).indexOf(index) >= 0 && (row.status === 'failed' || row.status === 'pending' && !row.attemptedAt && !row.tries))
      row = Object.assign({}, row, { status: 'resolved', resolution: 'discarded-local' });
    else if (conflict && row.status === 'pending' && !row.attemptedAt && !row.tries)
      row = Object.assign({}, row, { status: 'failed', code: 'BATCH_ID_CONFLICT', retryable: false,
        error: 'El mismo lote tiene dos contenidos distintos. Descarta el intento incorrecto y confirma con otro identificador.' });
    return row;
  });
  op.batchConflict = !!conflict;
  op.rowErrors = op.rows.filter(function(row) { return row.status === 'failed'; });
  var pending = op.rows.filter(function(row) { return row.status === 'pending'; });
  op.status = op.rowErrors.length ? 'failed' : pending.length ? 'pending' :
    op.rows.some(function(row) { return row.status === 'acknowledged'; }) ? 'acknowledged' : 'resolved';
  op.error = op.rowErrors.map(function(row) { return 'Fila ' + (row.index + 1) + ': ' + row.error; }).join(' · ');
  op.code = op.rowErrors.length ? op.rowErrors[0].code : '';
  op.nextAttemptAt = pending.length ? Math.min.apply(null, pending.map(function(row) { return row.nextAttemptAt || 0; })) : 0;
  return op;
}
function hasAcknowledgement(op) {
  return op.op === 'addBatch' ? op.rows.some(function(row) { return row.status === 'acknowledged'; }) : op.status === 'acknowledged';
}

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
function transactionsEqual(a, b) { return JSON.stringify(normalizedTransaction(a)) === JSON.stringify(normalizedTransaction(b)); }
function validateEditPayload(tx, before) {
  validateTransaction(tx); validateTransaction(before);
  if (tx.id !== before.id) throw new Error('La edición debe conservar el identificador del movimiento.');
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
function opAddTxBatch(transactions, batchId) {
  if (typeof batchId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(batchId)) throw new Error('El lote necesita un identificador válido y estable.');
  if (!Array.isArray(transactions) || !transactions.length || transactions.length > 50) throw new Error('Confirma entre 1 y 50 movimientos por lote.');
  var ids = new Set();
  var normalized = transactions.map(function(tx) {
    validateTransaction(tx);
    if (ids.has(tx.id)) throw new Error('Hay movimientos repetidos en este lote. Revisa la vista previa.');
    ids.add(tx.id);
    return normalizedTransaction(tx);
  });
  var canonical = JSON.stringify(normalized), existing = null;
  refreshJournal();
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (!key || key.indexOf(LS.opPrefix) !== 0) continue;
    var candidate = lsGet(key, null);
    if (!candidate || candidate.op !== 'addBatch' || candidate.batchId !== batchId) continue;
    if (JSON.stringify(candidate.payload.transactions) !== canonical) throw new Error('Este lote ya fue confirmado con otro contenido. Crea una nueva vista previa.');
    existing = candidate;
  }
  if (existing) return hydrateBatch(existing, false);
  _lastOpTimestamp = Math.max(Date.now(), _lastOpTimestamp + 1,
    S.outbox.reduce(function(max, item) { return Math.max(max, item.ts + 1); }, 0));
  var record = { id: 'batch:' + batchId + ':' + migrationHash(canonical), batchId: batchId,
    op: 'addBatch', payload: { transactions: normalized }, ts: _lastOpTimestamp,
    status: 'pending', tries: 0, nextAttemptAt: 0 };
  // The only enqueue write contains ALL rows. Quota/crash cannot save a prefix.
  // A content-derived suffix preserves both intentions in a concurrent conflict.
  persistOperation(record);
  refreshJournal();
  var saved = S.outbox.find(function(op) { return op.id === record.id; }) || hydrateBatch(record, false);
  paint();
  if (saved.batchConflict) throw new Error('Otra pestaña confirmó este lote con otro contenido. Los intentos quedaron guardados para revisión.');
  drainOutbox();
  return saved;
}
function opDelTx(id) {
  if (typeof id !== 'string' || !id) throw new Error('No se encontró el movimiento.');
  refreshJournal(); assertTransactionWritable(id);
  // Always journal deletes. An earlier timed-out add may already be on the server.
  return enqueue('del', { id: id });
}
function opEditTx(tx, before) {
  validateEditPayload(tx, before);
  tx = normalizedTransaction(tx); before = normalizedTransaction(before);
  refreshJournal(); assertTransactionWritable(tx.id);
  var current = effectiveTxs().find(function(item) { return item.id === tx.id; });
  if (!current) throw new Error('Este movimiento ya no está disponible. Cierra la edición y revisa la lista actualizada.');
  if (!transactionsEqual(current, before)) throw new Error('Este movimiento cambió mientras lo editabas. Cierra la edición y vuelve a abrirlo para revisar la versión actual.');
  if (transactionsEqual(tx, before)) return null;
  return enqueue('edit', { tx: tx, before: before });
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
  if (op && op.op === 'addBatch') {
    op = S.outbox.find(function(item) { return item.id === id; }) || hydrateBatch(op, false);
    if (op.status !== 'failed') throw new Error('Solo se pueden descartar intentos rechazados. Los pendientes deben terminar de sincronizar.');
    var previous = readBatchDiscard(id);
    var indices = op.rows.filter(function(row) {
      return row.status === 'failed' || row.status === 'pending' && !row.attemptedAt && !row.tries;
    }).map(function(row) { return row.index; });
    var discardedTxIds = indices.map(function(index) { return op.payload.transactions[index].id; });
    var dependentBatchOperations = dependentOperationIds(op, discardedTxIds);
    lsSet(LS.batchDiscardPrefix + id, { resolution: 'discarded-local', resolvedAt: Date.now(),
      indices: Array.from(new Set((previous.indices || []).concat(indices))),
      dependentDeleteIds: previous.dependentDeleteIds || [],
      dependentOperationIds: Array.from(new Set((previous.dependentOperationIds || []).concat(dependentBatchOperations))) });
    refreshJournal(); paint();
    return true;
  }
  if (!op || op.status !== 'failed') throw new Error('Solo se pueden descartar intentos rechazados. Los pendientes deben terminar de sincronizar.');
  var txId = operationTransactionId(op);
  var dependentIds = txId ? dependentOperationIds(op, [txId]) : [];
  persistOperation(Object.assign({}, op, { status: 'resolved', resolution: 'discarded-local',
    resolvedAt: Date.now(), dependentOperationIds: dependentIds }));
  refreshJournal(); paint();
  return true;
}

function effectiveTxs() {
  var byId = new Map();
  S.server.transactions.forEach(function(tx) { byId.set(tx.id, tx); });
  S.outbox.forEach(function(op) {
    if (op.op === 'add' || op.op === 'edit') byId.set(op.payload.tx.id, op.payload.tx);
    if (op.op === 'addBatch') op.rows.forEach(function(row) {
      if (row.status !== 'resolved') {
        var tx = op.payload.transactions[row.index]; byId.set(tx.id, tx);
      }
    });
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
function isPending(id) {
  return S.outbox.some(function(op) {
    return (op.op === 'add' || op.op === 'edit') && op.payload.tx.id === id || op.op === 'addBatch' &&
      op.rows.some(function(row) { return row.transactionId === id && row.status !== 'resolved'; });
  });
}

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
  if (op.op === 'edit') return snapshot.transactions.some(function(tx) { return tx.id === op.payload.tx.id && transactionsEqual(tx, op.payload.tx); });
  if (op.op === 'del') return !snapshot.transactions.some(function(tx) { return tx.id === op.payload.id; });
  return Object.keys(op.payload.settings).every(function(key) {
    var expected = key === 'initialBalance' ? op.payload.settings[key] : cleanLocalText(op.payload.settings[key]);
    return snapshot.config[key] === expected;
  });
}
function retireAcknowledged() {
  refreshJournal();
  S.outbox.forEach(function(op) {
    if (op.op === 'addBatch') {
      op.rows.forEach(function(row) {
        if (row.status !== 'acknowledged' || !Number.isFinite(row.ackVersion) || S.server.v < row.ackVersion) return;
        var reflected = S.server.transactions.some(function(tx) { return tx.id === row.transactionId; });
        if (S.server.v > row.ackVersion || reflected)
          persistBatchRow(op, Object.assign({}, row, { status: 'resolved', resolution: 'confirmed', confirmedAt: Date.now() }));
      });
      return;
    }
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
  if (S.server.v === null || version > S.server.v || S.outbox.some(hasAcknowledgement)) return fetchAll();
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
function transactionBlocked(op, id) {
  return S.outbox.some(function(earlier) {
    if (compareOperations(earlier, op) >= 0 || earlier.status === 'acknowledged') return false;
    if (earlier.op === 'addBatch') return earlier.rows.some(function(row) {
      return row.transactionId === id && row.status !== 'acknowledged' && row.status !== 'resolved';
    });
    return operationTransactionId(earlier) === id;
  });
}
function nextBatchRow(op) {
  return op.rows.find(function(row) {
    return row.status === 'pending' && (row.nextAttemptAt || 0) <= Date.now() && !transactionBlocked(op, row.transactionId);
  });
}
function nextOperation() {
  refreshJournal();
  return S.outbox.find(function(op) {
    if (op.op === 'addBatch') return !!nextBatchRow(op);
    if (op.status !== 'pending' || (op.nextAttemptAt || 0) > Date.now()) return false;
    var id = operationTransactionId(op);
    // Mutations for one ID stay ordered, including failed ancestors. A failed
    // batch row blocks its own descendants but never blocks unrelated siblings.
    if (id) return !transactionBlocked(op, id);
    return !S.outbox.some(function(earlier) {
      return compareOperations(earlier, op) < 0 && earlier.status !== 'acknowledged' &&
        op.op === 'setConfig' && earlier.op === 'setConfig' && earlier.status !== 'failed';
    });
  });
}
async function drainBatchRow(op) {
  var current = hydrateBatch(readOperation(op.id), op.batchConflict);
  var row = nextBatchRow(current);
  if (!row) return false;
  // Persist attempted-before-send: an ambiguous timeout must be reconciled with
  // the same receipt, not treated as an unsent row when discarding other failures.
  row = Object.assign({}, row, { attemptedAt: Date.now(), tries: (row.tries || 0) + 1 });
  persistBatchRow(current, row);
  _inflightOp = { id: current.id, rowIndex: row.index };
  try {
    var response = await api('add', { tx: current.payload.transactions[row.index] }, row.operationId);
    networkSucceeded();
    if (!Number.isFinite(response.v)) throw requestError('Falta confirmar la versión guardada.', 'INVALID_RESPONSE', true);
    var appliedVersion = response.data && Number.isFinite(response.data.appliedVersion) ? response.data.appliedVersion : response.v;
    persistBatchRow(current, Object.assign({}, row, { status: 'acknowledged', ackVersion: appliedVersion,
      acknowledgedAt: Date.now(), error: '', code: '', nextAttemptAt: 0 }));
  } catch (error) {
    if (error.code === 'LOCAL_STORAGE') throw error;
    if (error.retryable !== false) networkFailed(error);
    var failure = Object.assign({}, row, { error: error.message, code: error.code || 'NETWORK',
      retryable: error.retryable !== false, status: error.retryable === false ? 'failed' : 'pending' });
    failure.nextAttemptAt = failure.status === 'failed' ? 0 : Date.now() + Math.min(30000, 1000 * Math.pow(2, Math.min(failure.tries, 5)));
    persistBatchRow(current, failure);
  } finally { _inflightOp = null; }
  return true;
}
function drainOutbox() {
  if (_drainPromise) return _drainPromise;
  try { refreshJournal(); } catch (error) { setSync(); return Promise.resolve(false); }
  if (typeof navigator !== 'undefined' && navigator.onLine === false || !S.outbox.length) { setSync(); return Promise.resolve(false); }
  _draining = true;
  var refreshAfterConflict = false;
  _drainPromise = Promise.resolve().then(function() {
    return withSyncLock(async function() {
      // One operation per lease/lock keeps fallback lease shorter than its TTL.
      var op = nextOperation();
      if (!op) return false;
      if (op.op === 'addBatch') return drainBatchRow(op);
      op = readOperation(op.id);
      if (!op || op.status !== 'pending') return false;
      // Durable before send so another tab cannot discard an ambiguous request
      // as "never sent", including a crash before its ACK is written locally.
      op = Object.assign({}, op, { attemptedAt: Date.now(), tries: (op.tries || 0) + 1 });
      persistOperation(op);
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
        if (op.op === 'edit' && error.retryable === false) refreshAfterConflict = true;
        var failure = Object.assign({}, op, { error: error.message,
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
    if (refreshAfterConflict || S.outbox.some(hasAcknowledgement)) {
      fetchAll().catch(function() {}).finally(function() { if (S.outbox.some(hasAcknowledgement)) scheduleDrain(5000); });
    }
    var next = nextOperation();
    if (next) scheduleDrain(250);
    else {
      var waiting = [];
      S.outbox.forEach(function(op) {
        if (op.op === 'addBatch') op.rows.forEach(function(row) { if (row.status === 'pending' && row.nextAttemptAt > Date.now()) waiting.push(row); });
        else if (op.status === 'pending' && op.nextAttemptAt > Date.now()) waiting.push(op);
      });
      if (waiting.length) scheduleDrain(Math.min.apply(null, waiting.map(function(op) { return op.nextAttemptAt - Date.now(); })));
    }
    setSync();
  });
  setSync();
  return _drainPromise;
}

function setSync() {
  var failed = S.outbox.filter(function(op) { return op.status === 'failed'; });
  var pending = 0, failedCount = 0;
  S.outbox.forEach(function(op) {
    if (op.op === 'addBatch') op.rows.forEach(function(row) {
      if (row.status === 'failed') failedCount++;
      else if (row.status !== 'resolved') pending++;
    });
    else if (op.status === 'failed') failedCount++;
    else pending++;
  });
  var state = 'idle', label = 'Sincronizado';
  if (_storageError || _journalError || _migrationError) { state = 'error'; label = 'Revisa el guardado local'; }
  else if (_readError) { state = 'error'; label = 'Los datos requieren revisión'; }
  else if (failedCount) { state = 'error'; label = failedCount + (failedCount === 1 ? ' requiere revisión' : ' requieren revisión'); }
  else if (typeof navigator !== 'undefined' && navigator.onLine === false) { state = 'offline'; label = pending ? 'Sin conexión · guardado aquí' : 'Sin conexión'; }
  else if (_draining || _fetchingAll || _checkingVersion) { state = 'syncing'; label = 'Sincronizando…'; }
  else if (!_networkHealthy) { state = 'offline'; label = _lastNetworkError ? 'Sin conexión al servidor' : 'Comprobando conexión'; }
  else if (pending) { state = 'pending'; label = 'Guardado aquí · pendiente'; }
  S.sync = { state: state, pendingCount: pending, failedCount: failedCount, lastSuccessAt: _lastSuccessAt,
    storageError: _storageError || _journalError || _migrationError,
    lastError: _storageError || _journalError || _migrationError || _readError || (failed[0] && failed[0].error) || _lastNetworkError };
  if (typeof document === 'undefined') return state;
  var dot = document.getElementById('syncDot'), count = document.getElementById('syncCount'), text = document.getElementById('syncText');
  if (dot) dot.className = 'sync-dot' + (state === 'idle' ? '' : ' ' + state);
  if (text) { text.textContent = label; text.title = S.sync.lastError || ''; }
  if (count) {
    count.textContent = pending + failedCount + (pending + failedCount === 1 ? ' pendiente' : ' pendientes');
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
    if (!old || ['add', 'edit', 'del', 'setConfig'].indexOf(old.op) < 0 || !old.payload) throw new Error('Hay un movimiento anterior que necesita revisión.');
    if (old.op === 'edit') validateEditPayload(old.payload.tx, old.payload.before);
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
      if (!event.key || event.key.indexOf(LS.opPrefix) === 0 || event.key.indexOf(LS.snapshotPrefix) === 0 ||
          event.key.indexOf(LS.batchRowPrefix) === 0 || event.key.indexOf(LS.batchDiscardPrefix) === 0 || event.key === LS.data) {
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
      if (op.op === 'addBatch') {
        op.rows.forEach(function(row) {
          if (row.status === 'resolved' || row.status === 'acknowledged' || row.code === 'BATCH_ID_CONFLICT') return;
          persistBatchRow(op, Object.assign({}, row, { status: 'pending', nextAttemptAt: 0, error: '', code: '' }));
        });
        return;
      }
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
      if (key && (key.indexOf(LS.opPrefix) === 0 || key.indexOf(LS.batchRowPrefix) === 0 ||
          key.indexOf(LS.batchDiscardPrefix) === 0 || key === LS.outbox)) journal[key] = localStorage.getItem(key);
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
