/* Caja Casa: private AI proposes movements; only the review button writes to the
 * durable cash journal. SpeechRecognition is optional, never a PWA guarantee.
 * No provider key is stored here. cajaAiAccess is the household's private code. */
'use strict';

var VOICE_DRAFT_KEY = 'cajaVoiceDraft:v1';
var VOICE_ACCESS_KEY = 'cajaAiAccess';
var VOICE_LIMIT = 10;
var VoiceDraft = voiceEmptyDraft();
var VoiceRuntime = {
  busy: false, saving: false, error: '', storageError: '', listening: false,
  recognition: null, noSpeechTimer: null, speechTimer: null, controller: null,
  requestTimer: null, requestSequence: 0, speechBase: '', hasSpeech: false
};

function voiceToday() {
  try {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    var values = {}; parts.forEach(function(part) { values[part.type] = part.value; });
    return values.year + '-' + values.month + '-' + values.day;
  } catch (error) { return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10); }
}
function voiceId(prefix) {
  return prefix + ':' + (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID() : Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 12));
}
function voiceEmptyDraft() {
  var person = 'd';
  try { person = JSON.parse(localStorage.getItem('cajaLastPerson')) === 't' ? 't' : 'd'; } catch (error) {}
  return { version: 1, text: '', person: person, date: voiceToday(), preparedText: null,
    preparedPerson: null, preparedDate: null, rawMovements: [], rows: [], batchId: null,
    needsClarification: false, question: '', overlap: false, withdrawalChoice: null, inclusion: null };
}
function voiceClone(value) { return JSON.parse(JSON.stringify(value)); }
function voiceElement(id) { return document.getElementById(id); }
function voiceEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}
function voiceCategoryIds(type) { return (type === 'ingreso' ? CATS_I : CATS_E).map(function(category) { return category.id; }); }
function voiceValidDate(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < '1900-01-01' || day > voiceToday()) return false;
  var date = new Date(day + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}
function voiceValidateMovement(value) {
  if (!value || (value.type !== 'ingreso' && value.type !== 'egreso')) throw new Error('Revisa si cada movimiento es ingreso o gasto.');
  if (!Number.isSafeInteger(value.amount) || value.amount <= 0 || value.amount > 1e12) throw new Error('Cada monto debe ser positivo, en pesos completos.');
  if (voiceCategoryIds(value.type).indexOf(value.category) < 0) throw new Error('Selecciona una categoría válida para cada movimiento.');
  if (value.person !== 'd' && value.person !== 't') throw new Error('Selecciona Daniel o Thalía para cada movimiento.');
  if (!voiceValidDate(value.date)) throw new Error('Revisa las fechas: deben ser válidas, desde 1900 hasta hoy.');
  if (typeof value.description !== 'string' || value.description.length > 500) throw new Error('La descripción debe tener hasta 500 caracteres.');
  if (['withdrawal', 'expense', 'income'].indexOf(value.kind) < 0 || (value.kind === 'income') !== (value.type === 'ingreso')) throw new Error('La propuesta no distingue correctamente ingreso, gasto y retiro. Reformula la frase.');
  return { type: value.type, amount: value.amount, category: value.category,
    description: value.description, person: value.person, date: value.date, kind: value.kind };
}
function voiceValidateResponse(data) {
  if (!data || typeof data.needsClarification !== 'boolean' || !Array.isArray(data.movements) || data.movements.length > VOICE_LIMIT) throw new Error('La propuesta no tiene un formato válido. Vuelve a prepararla.');
  if (data.needsClarification) {
    if (typeof data.question !== 'string' || !data.question.trim() || data.question.length > 1000) throw new Error('Falta la aclaración del asistente. Vuelve a preparar la frase.');
    return { movements: [], needsClarification: true, question: data.question.trim() };
  }
  if (!data.movements.length) throw new Error('No hay movimientos en la propuesta. Describe qué entró o salió de la caja.');
  return { movements: data.movements.map(voiceValidateMovement), needsClarification: false, question: '' };
}
function voicePersistDraft() {
  try { localStorage.setItem(VOICE_DRAFT_KEY, JSON.stringify(VoiceDraft)); VoiceRuntime.storageError = ''; return true; }
  catch (error) { VoiceRuntime.storageError = 'No se pudo guardar el borrador en este iPhone. El texto sigue abierto; libera espacio y vuelve a intentar.'; return false; }
}
function voiceLoadDraft() {
  try {
    var raw = localStorage.getItem(VOICE_DRAFT_KEY);
    if (!raw) return;
    var saved = JSON.parse(raw);
    if (!saved || saved.version !== 1 || typeof saved.text !== 'string' || saved.text.length > 2000 || !['d', 't'].includes(saved.person) || typeof saved.date !== 'string') throw new Error('invalid draft');
    if (!Array.isArray(saved.rawMovements) || !Array.isArray(saved.rows) || saved.rawMovements.length > VOICE_LIMIT || saved.rows.length > VOICE_LIMIT) throw new Error('invalid rows');
    if (saved.rows.length && (typeof saved.batchId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(saved.batchId))) throw new Error('invalid batch');
    saved.rows.forEach(function(row) { if (!row || typeof row.id !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(row.id)) throw new Error('invalid row id'); });
    var restored = voiceEmptyDraft();
    Object.keys(restored).forEach(function(key) { if (Object.prototype.hasOwnProperty.call(saved, key)) restored[key] = saved[key]; });
    VoiceDraft = restored;
    if (!VoiceDraft.text.trim() && !VoiceDraft.rows.length) VoiceDraft.date = voiceToday();
  } catch (error) { VoiceRuntime.error = 'No se pudo recuperar el borrador anterior. Su copia local se conserva hasta que escribas uno nuevo.'; }
}
function voiceAccessToken() {
  try { return (localStorage.getItem(VOICE_ACCESS_KEY) || '').trim(); } catch (error) { return ''; }
}
function voiceSaveAccess() {
  var token = voiceElement('voiceAccessInput').value.trim();
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token) || /^(sk-|AIza)/.test(token)) {
    voiceElement('voiceAccessError').textContent = 'Introduce el código privado de Caja Casa, no una clave del proveedor de IA.'; return;
  }
  try {
    localStorage.setItem(VOICE_ACCESS_KEY, token);
    voiceElement('voiceAccessInput').value = '';
    voiceElement('voiceAccessError').textContent = '';
    voiceElement('voiceAccessDetails').open = false;
    VoiceRuntime.error = '';
    voiceUpdateStatus();
  } catch (error) { voiceElement('voiceAccessError').textContent = 'No se pudo guardar el código en este iPhone.'; }
}
function voiceDisconnect() {
  try {
    localStorage.removeItem(VOICE_ACCESS_KEY);
    voiceAbortRequest();
    voiceElement('voiceAccessInput').value = '';
    voiceElement('voiceAccessError').textContent = '';
    voiceUpdateStatus();
  } catch (error) { voiceElement('voiceAccessError').textContent = 'No se pudo desconectar el acceso. Vuelve a intentar.'; }
}
function voiceInvalidatePreview() {
  VoiceDraft.preparedText = null; VoiceDraft.preparedPerson = null; VoiceDraft.preparedDate = null;
  VoiceDraft.rawMovements = []; VoiceDraft.rows = []; VoiceDraft.batchId = null;
  VoiceDraft.needsClarification = false; VoiceDraft.question = ''; VoiceDraft.overlap = false;
  VoiceDraft.withdrawalChoice = null; VoiceDraft.inclusion = null;
}
function voiceUpdateText(text, fromSpeech) {
  if (!fromSpeech) voiceStopListening(false);
  voiceAbortRequest();
  var next = String(text).slice(0, 2000);
  if (next !== VoiceDraft.text) {
    VoiceDraft.text = next; voiceInvalidatePreview(); VoiceRuntime.error = ''; voicePersistDraft(); voiceRenderPreview();
  }
  voiceElement('voiceText').value = VoiceDraft.text;
  voiceUpdateStatus();
}
function voiceChangeContext() {
  voiceStopListening(false); voiceAbortRequest();
  VoiceDraft.person = voiceElement('voicePerson').value === 't' ? 't' : 'd';
  VoiceDraft.date = voiceElement('voiceDate').value;
  voiceInvalidatePreview(); VoiceRuntime.error = '';
  try { localStorage.setItem('cajaLastPerson', JSON.stringify(VoiceDraft.person)); } catch (error) {}
  voicePersistDraft(); voiceRenderPreview(); voiceUpdateStatus();
}
function voicePreparedMatches() {
  return VoiceDraft.preparedText === VoiceDraft.text && VoiceDraft.preparedPerson === VoiceDraft.person && VoiceDraft.preparedDate === VoiceDraft.date;
}
function voiceBuildPreview(movements, choice) {
  var validated = movements.map(voiceValidateMovement);
  var withdrawals = validated.filter(function(row) { return row.kind === 'withdrawal'; });
  var expenses = validated.filter(function(row) { return row.kind === 'expense'; });
  if (withdrawals.length > 1 && expenses.length) throw new Error('Hay varios retiros y gastos. Prepara una frase por retiro y aclara cuáles gastos salieron de él.');
  var result = { rows: validated, overlap: withdrawals.length === 1 && expenses.length > 0, inclusion: null };
  if (!result.overlap) return result;
  if (!choice) { result.rows = []; return result; }
  if (choice === 'apart') return result;
  if (choice !== 'included') throw new Error('Indica si los gastos estaban incluidos en el retiro.');
  var withdrawal = withdrawals[0];
  if (expenses.some(function(row) { return row.person !== withdrawal.person || row.date !== withdrawal.date; })) throw new Error('Para incluirlos en un retiro, los gastos deben tener la misma persona y fecha. Aclara la frase o elige que salieron aparte.');
  var total = expenses.reduce(function(sum, row) { return sum + row.amount; }, 0);
  if (total > withdrawal.amount) throw new Error('Los gastos superan el retiro. Corrige los montos o indica que salieron aparte.');
  result.inclusion = { amount: withdrawal.amount, person: withdrawal.person, date: withdrawal.date };
  result.rows = validated.filter(function(row) { return row.kind !== 'withdrawal'; }).map(function(row) {
    return Object.assign({}, row, { _included: row.kind === 'expense' });
  });
  var remainder = withdrawal.amount - total;
  if (remainder) result.rows.push({ type: 'egreso', amount: remainder, category: 'otros', description: 'Resto del retiro',
    person: withdrawal.person, date: withdrawal.date, kind: 'withdrawal', _included: true });
  return result;
}
function voiceInstallPreview(result) {
  VoiceDraft.overlap = result.overlap;
  VoiceDraft.inclusion = result.inclusion;
  VoiceDraft.rows = result.rows.map(function(row) { return Object.assign({}, row, { id: voiceId('voice'), _originKind: row.kind }); });
  VoiceDraft.batchId = VoiceDraft.rows.length ? voiceId('batch') : null;
}
function voiceApplyInterpretation(data, source) {
  var answer = voiceValidateResponse(data);
  voiceInvalidatePreview();
  VoiceDraft.preparedText = source.text; VoiceDraft.preparedPerson = source.person; VoiceDraft.preparedDate = source.date;
  VoiceDraft.needsClarification = answer.needsClarification; VoiceDraft.question = answer.question;
  VoiceDraft.rawMovements = answer.movements;
  if (!answer.needsClarification) {
    try { voiceInstallPreview(voiceBuildPreview(answer.movements, null)); }
    catch (error) { VoiceDraft.needsClarification = true; VoiceDraft.question = error.message; }
  }
  voicePersistDraft(); voiceRenderPreview(); voiceUpdateStatus();
}
function voiceChooseWithdrawal(choice) {
  if (VoiceDraft.withdrawalChoice === choice && VoiceDraft.rows.length) return;
  VoiceRuntime.error = '';
  VoiceDraft.withdrawalChoice = choice;
  try { voiceInstallPreview(voiceBuildPreview(VoiceDraft.rawMovements, choice)); }
  catch (error) { VoiceDraft.rows = []; VoiceDraft.batchId = null; VoiceDraft.inclusion = null; VoiceRuntime.error = error.message; }
  voicePersistDraft(); voiceRenderPreview(); voiceUpdateStatus();
  if (VoiceDraft.rows.length) { var heading = voiceElement('voicePreviewTitle'); heading.focus({ preventScroll: false }); if (heading.scrollIntoView) heading.scrollIntoView({ block: 'start', behavior: 'auto' }); }
}
function voiceValidatePreview() {
  if (!voicePreparedMatches()) return 'Prepara la frase actual para revisar sus movimientos.';
  if (VoiceDraft.needsClarification) return VoiceDraft.question || 'Aclara la frase antes de guardar.';
  if (VoiceDraft.overlap && !VoiceDraft.withdrawalChoice) return 'Indica si los gastos salieron del retiro.';
  if (!VoiceDraft.rows.length || VoiceDraft.rows.length > VOICE_LIMIT) return 'La propuesta debe tener entre 1 y 10 movimientos.';
  try { VoiceDraft.rows.forEach(voiceValidateMovement); } catch (error) { return error.message; }
  if (VoiceDraft.inclusion) {
    var included = VoiceDraft.rows.filter(function(row) { return row._included; });
    var anchor = VoiceDraft.inclusion;
    if (included.some(function(row) { return row.type !== 'egreso' || row.date !== anchor.date || row.person !== anchor.person; })) return 'Los gastos incluidos deben conservar la persona y fecha del retiro. Reformula la frase si necesitas cambiarlas.';
    var sum = included.reduce(function(total, row) { return total + row.amount; }, 0);
    if (sum !== anchor.amount) return 'Los gastos incluidos y el resto deben sumar ' + fmtAmt(anchor.amount) + ', el total del retiro. Ajusta los montos antes de guardar.';
  }
  return '';
}
function voiceApiMessage(data) {
  var code = data && (data.code || data.error && data.error.code);
  if (code === 'AI_NOT_CONFIGURED') return 'Asistente pendiente de activación. El registro manual sigue disponible.';
  if (code === 'UNAUTHORIZED' || code === 'AI_UNAUTHORIZED' || code === 'INVALID_ACCESS_TOKEN') return 'El código privado no es válido. Revísalo en Acceso privado.';
  if (code === 'RATE_LIMITED' || code === 'AI_RATE_LIMITED') return 'El asistente está ocupado. Espera un momento y vuelve a preparar la frase.';
  return typeof (data && data.error) === 'string' ? data.error.slice(0, 500) : 'No se pudo preparar la propuesta. El texto sigue guardado; vuelve a intentar.';
}
function voiceAbortRequest() {
  VoiceRuntime.requestSequence++;
  if (VoiceRuntime.controller) { try { VoiceRuntime.controller.abort(); } catch (error) {} }
  if (VoiceRuntime.requestTimer) clearTimeout(VoiceRuntime.requestTimer);
  VoiceRuntime.controller = null; VoiceRuntime.requestTimer = null; VoiceRuntime.busy = false;
}
async function voicePrepare() {
  if (VoiceRuntime.busy || VoiceRuntime.saving) return;
  voiceStopListening(false);
  VoiceRuntime.error = '';
  var accessToken = voiceAccessToken();
  if (!accessToken) { VoiceRuntime.error = 'Asistente pendiente de activación. Añade el código privado en Acceso privado.'; voiceUpdateStatus(); return; }
  if (!VoiceDraft.text.trim()) { VoiceRuntime.error = 'Escribe o dicta lo que entró o salió de la caja.'; voiceUpdateStatus(); return; }
  if (!voiceValidDate(VoiceDraft.date)) { VoiceRuntime.error = 'Selecciona una fecha válida, desde 1900 hasta hoy.'; voiceUpdateStatus(); return; }
  voiceInvalidatePreview(); voicePersistDraft(); voiceRenderPreview();
  var source = { text: VoiceDraft.text, person: VoiceDraft.person, date: VoiceDraft.date };
  var sequence = ++VoiceRuntime.requestSequence;
  var controller = new AbortController();
  VoiceRuntime.controller = controller; VoiceRuntime.busy = true;
  var timedOut = false;
  VoiceRuntime.requestTimer = setTimeout(function() { timedOut = true; controller.abort(); }, 45000);
  voiceUpdateStatus();
  try {
    var response = await fetch(GAS_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'interpret', accessToken: accessToken, payload: source }), signal: controller.signal });
    var body = await response.text();
    if (sequence !== VoiceRuntime.requestSequence) return;
    var parsed;
    try { parsed = JSON.parse(body); } catch (error) { throw new Error('El asistente no devolvió una propuesta válida. Tu frase sigue guardada.'); }
    if (response.ok === false || !parsed || parsed.ok !== true) throw new Error(voiceApiMessage(parsed));
    voiceApplyInterpretation(parsed.data, source);
    var summary = voiceElement(VoiceDraft.needsClarification ? 'voiceQuestion' : VoiceDraft.overlap && !VoiceDraft.withdrawalChoice ? 'voiceOverlapQuestion' : 'voicePreviewTitle');
    if (summary) summary.focus({ preventScroll: false });
  } catch (error) {
    if (sequence !== VoiceRuntime.requestSequence) return;
    VoiceRuntime.error = timedOut ? 'El asistente tardó demasiado. Tu frase sigue guardada; vuelve a preparar cuando quieras.' : error.name === 'AbortError' ? 'Preparación cancelada. Tu frase sigue guardada.' : error.message || 'No hay conexión con el asistente. Tu frase sigue guardada.';
  } finally {
    if (sequence === VoiceRuntime.requestSequence) {
      clearTimeout(VoiceRuntime.requestTimer); VoiceRuntime.requestTimer = null;
      VoiceRuntime.controller = null; VoiceRuntime.busy = false; voiceUpdateStatus();
    }
  }
}
function voiceName(person) { return person === 'd' ? S.names.d : S.names.t; }
function voiceRowDescription(row) {
  var categories = row.type === 'ingreso' ? CATS_I : CATS_E;
  var category = categories.find(function(item) { return item.id === row.category; });
  return row.description || (category ? category.name : 'Movimiento');
}
function voiceRowMeta(row) {
  var date = typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date) ? row.date.slice(8) + '/' + row.date.slice(5, 7) + '/' + row.date.slice(0, 4) : 'Revisa la fecha';
  return voiceName(row.person) + ' · ' + date;
}
function voiceRowAmount(row) { return (row.type === 'ingreso' ? '+' : '−') + (Number.isSafeInteger(row.amount) ? fmtAmt(row.amount) : 'Revisa el monto'); }
function voiceRowHTML(row, index) {
  var prefix = 'voiceRow' + index;
  var options = (row.type === 'ingreso' ? CATS_I : CATS_E).map(function(category) {
    return '<option value="' + voiceEscape(category.id) + '"' + (category.id === row.category ? ' selected' : '') + '>' + voiceEscape(category.name) + '</option>';
  }).join('');
  return '<details class="voice-row" id="' + prefix + 'Card" data-voice-index="' + index + '"><summary><span class="voice-row-summary-text"><strong id="' + prefix + 'SummaryDescription">' + voiceEscape(voiceRowDescription(row)) + '</strong><span id="' + prefix + 'SummaryMeta">' + voiceEscape(voiceRowMeta(row)) + '</span></span><span class="voice-row-summary-amount"><strong id="' + prefix + 'SummaryAmount">' + voiceEscape(voiceRowAmount(row)) + '</strong><span>Editar ↓</span></span></summary><fieldset class="voice-row-fields"><legend class="sr-only">Editar movimiento ' + (index + 1) + '</legend>'
    + '<div class="voice-row-top"><span>' + (row._included ? 'Incluido en el retiro' : row.kind === 'withdrawal' ? 'Retiro de caja' : row.type === 'ingreso' ? 'Entrada de efectivo' : 'Salida de efectivo') + '</span><button type="button" class="voice-remove" data-voice-remove="' + index + '" aria-label="Quitar movimiento ' + (index + 1) + '">Quitar</button></div>'
    + '<div class="voice-grid"><label for="' + prefix + 'Type">Tipo<select id="' + prefix + 'Type" data-voice-field="type"><option value="egreso"' + (row.type === 'egreso' ? ' selected' : '') + '>Gasto / salida</option><option value="ingreso"' + (row.type === 'ingreso' ? ' selected' : '') + '>Ingreso</option></select></label>'
    + '<label for="' + prefix + 'Amount">Monto en COP<input id="' + prefix + 'Amount" data-voice-field="amount" type="number" inputmode="numeric" min="1" max="1000000000000" step="1" value="' + voiceEscape(row.amount) + '"></label>'
    + '<label for="' + prefix + 'Category">Categoría<select id="' + prefix + 'Category" data-voice-field="category">' + options + '</select></label>'
    + '<label for="' + prefix + 'Person">Persona<select id="' + prefix + 'Person" data-voice-field="person"><option value="d"' + (row.person === 'd' ? ' selected' : '') + '>' + voiceEscape(voiceName('d')) + '</option><option value="t"' + (row.person === 't' ? ' selected' : '') + '>' + voiceEscape(voiceName('t')) + '</option></select></label>'
    + '<label class="voice-wide" for="' + prefix + 'Date">Fecha<input id="' + prefix + 'Date" data-voice-field="date" type="date" min="1900-01-01" max="' + voiceToday() + '" value="' + voiceEscape(row.date) + '"></label></div>'
    + '<label class="voice-description" for="' + prefix + 'Description">Descripción<input id="' + prefix + 'Description" data-voice-field="description" maxlength="500" value="' + voiceEscape(row.description) + '"></label></fieldset></details>';
}
function voiceUpdateRowSummary(index) {
  var row = VoiceDraft.rows[index], prefix = 'voiceRow' + index;
  if (!row) return;
  voiceElement(prefix + 'SummaryDescription').textContent = voiceRowDescription(row);
  voiceElement(prefix + 'SummaryMeta').textContent = voiceRowMeta(row);
  voiceElement(prefix + 'SummaryAmount').textContent = voiceRowAmount(row);
}
function voiceRenderPreview() {
  voiceElement('voiceClarification').hidden = !VoiceDraft.needsClarification;
  voiceElement('voiceQuestion').textContent = VoiceDraft.question;
  voiceElement('voiceOverlap').hidden = !VoiceDraft.overlap || VoiceDraft.needsClarification;
  voiceElement('voiceIncluded').setAttribute('aria-pressed', String(VoiceDraft.withdrawalChoice === 'included'));
  voiceElement('voiceApart').setAttribute('aria-pressed', String(VoiceDraft.withdrawalChoice === 'apart'));
  voiceElement('voiceReview').hidden = !VoiceDraft.rows.length;
  voiceElement('voiceRows').innerHTML = VoiceDraft.rows.map(voiceRowHTML).join('');
  voiceUpdateTotals();
}
function voiceUpdateTotals() {
  var totals = VoiceDraft.rows.reduce(function(result, row) {
    if (Number.isSafeInteger(row.amount) && row.amount > 0) result[row.type === 'ingreso' ? 'income' : 'expense'] += row.amount;
    return result;
  }, { income: 0, expense: 0 });
  var net = totals.income - totals.expense;
  voiceElement('voiceTotalIn').textContent = fmtAmt(totals.income);
  voiceElement('voiceTotalOut').textContent = fmtAmt(totals.expense);
  voiceElement('voiceTotalNet').textContent = (net < 0 ? '−' : '+') + fmtAmt(Math.abs(net));
  var invalid = voiceValidatePreview();
  voiceElement('voicePreviewError').textContent = VoiceDraft.rows.length ? invalid : '';
  var button = voiceElement('voiceConfirm');
  button.textContent = 'Guardar ' + VoiceDraft.rows.length + (VoiceDraft.rows.length === 1 ? ' movimiento' : ' movimientos');
  button.disabled = !!invalid || VoiceRuntime.saving || VoiceRuntime.busy;
}
function voiceEditRow(event) {
  var field = event.target.getAttribute('data-voice-field');
  var container = event.target.closest('[data-voice-index]');
  if (!field || !container || VoiceRuntime.saving) return;
  var index = Number(container.getAttribute('data-voice-index')), row = VoiceDraft.rows[index];
  if (!row || ['type', 'amount', 'category', 'person', 'date', 'description'].indexOf(field) < 0) return;
  row[field] = field === 'amount' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value;
  if (field === 'type') {
    row.category = row.type === 'ingreso' ? 'ingreso' : 'otros';
    row.kind = row.type === 'ingreso' ? 'income' : row._originKind === 'withdrawal' ? 'withdrawal' : 'expense';
  }
  VoiceRuntime.error = '';
  voicePersistDraft();
  if (field === 'type') { voiceRenderPreview(); voiceElement('voiceRow' + index + 'Card').open = true; voiceElement('voiceRow' + index + 'Type').focus(); }
  else { voiceUpdateRowSummary(index); voiceUpdateTotals(); }
  voiceUpdateStatus();
}
function voiceRemoveRow(index) {
  if (VoiceRuntime.saving || !Number.isInteger(index) || !VoiceDraft.rows[index]) return;
  VoiceDraft.rows.splice(index, 1); VoiceRuntime.error = '';
  voicePersistDraft(); voiceRenderPreview(); voiceUpdateStatus();
}
function voiceConfirm() {
  if (VoiceRuntime.saving || VoiceRuntime.busy) return;
  VoiceRuntime.error = voiceValidatePreview();
  if (VoiceRuntime.error) { voiceUpdateStatus(); return; }
  if (!voicePersistDraft()) { voiceUpdateStatus(); return; }
  VoiceRuntime.saving = true; voiceUpdateTotals();
  try {
    var transactions = VoiceDraft.rows.map(function(row) {
      return { id: row.id, type: row.type, amount: row.amount, category: row.category,
        description: row.description.trim(), person: row.person, date: row.date + 'T12:00:00' };
    });
    opAddTxBatch(transactions, VoiceDraft.batchId);
    var pending = typeof isPending !== 'function' || transactions.some(function(tx) { return isPending(tx.id); });
    // Enqueue is durable before touching this draft or closing its review.
    VoiceDraft = voiceEmptyDraft();
    voicePersistDraft();
    VoiceRuntime.saving = false;
    closeAll();
    toast(pending ? 'Guardados en este iPhone; pendientes de sincronizar.' : 'Los movimientos ya están guardados y sincronizados.');
  } catch (error) {
    VoiceRuntime.saving = false;
    VoiceRuntime.error = error.message || 'No se pudo guardar. La propuesta sigue aquí para volver a intentar.';
    voiceUpdateTotals(); voiceUpdateStatus();
  }
}
function voiceSpeechConstructor() { return window.SpeechRecognition || window.webkitSpeechRecognition; }
function voiceStandalone() {
  return navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}
function voiceCanListen() { return !!voiceSpeechConstructor() && !voiceStandalone(); }
function voiceClearSpeechTimers() {
  if (VoiceRuntime.noSpeechTimer) clearTimeout(VoiceRuntime.noSpeechTimer);
  if (VoiceRuntime.speechTimer) clearTimeout(VoiceRuntime.speechTimer);
  VoiceRuntime.noSpeechTimer = null; VoiceRuntime.speechTimer = null;
}
function voiceStopListening(announce) {
  var recognition = VoiceRuntime.recognition;
  VoiceRuntime.recognition = null; VoiceRuntime.listening = false; voiceClearSpeechTimers();
  if (recognition) { recognition.onresult = recognition.onerror = recognition.onend = null; try { recognition.abort(); } catch (error) {} }
  if (announce) voiceElement('voiceMicStatus').textContent = 'Dictado detenido. Puedes corregir el texto antes de prepararlo.';
  if (voiceElement('voiceMic')) { voiceElement('voiceMic').textContent = 'Usar micrófono'; voiceElement('voiceMic').setAttribute('aria-pressed', 'false'); }
}
function voiceUseKeyboard(message) {
  voiceStopListening(false);
  voiceElement('voiceMicStatus').textContent = message || 'Toca el texto y usa el micrófono del teclado del iPhone.';
  voiceElement('voiceText').focus({ preventScroll: false });
}
function voiceToggleMic() {
  if (VoiceRuntime.listening) { voiceStopListening(true); return; }
  if (!voiceCanListen()) { voiceUseKeyboard(); return; }
  if (VoiceRuntime.busy || VoiceRuntime.saving) return;
  var Recognition = voiceSpeechConstructor(), recognition;
  try { recognition = new Recognition(); } catch (error) { voiceUseKeyboard(); return; }
  voiceStopListening(false);
  VoiceRuntime.recognition = recognition; VoiceRuntime.listening = true;
  VoiceRuntime.speechBase = VoiceDraft.text.trim(); VoiceRuntime.hasSpeech = false;
  recognition.lang = 'es-CO'; recognition.continuous = true; recognition.interimResults = true; recognition.maxAlternatives = 1;
  recognition.onresult = function(event) {
    if (VoiceRuntime.recognition !== recognition) return;
    var parts = [];
    for (var index = 0; index < event.results.length; index++) if (event.results[index][0]) parts.push(event.results[index][0].transcript);
    var transcript = parts.join(' ').trim();
    if (!transcript) return;
    VoiceRuntime.hasSpeech = true;
    if (VoiceRuntime.noSpeechTimer) clearTimeout(VoiceRuntime.noSpeechTimer);
    VoiceRuntime.noSpeechTimer = null;
    voiceUpdateText((VoiceRuntime.speechBase ? VoiceRuntime.speechBase + ' ' : '') + transcript, true);
    voiceElement('voiceMicStatus').textContent = 'Escuchando… toca Detener cuando termines.';
  };
  recognition.onerror = function() {
    if (VoiceRuntime.recognition !== recognition) return;
    voiceUseKeyboard('El micrófono del navegador no está disponible. Usa el micrófono del teclado del iPhone.');
  };
  recognition.onend = function() {
    if (VoiceRuntime.recognition !== recognition) return;
    var heard = VoiceRuntime.hasSpeech;
    voiceStopListening(false);
    voiceElement('voiceMicStatus').textContent = heard ? 'Dictado listo. Revisa el texto antes de prepararlo.' : 'No llegó dictado. Puedes usar el micrófono del teclado del iPhone.';
  };
  voiceElement('voiceMic').textContent = 'Detener'; voiceElement('voiceMic').setAttribute('aria-pressed', 'true');
  voiceElement('voiceMicStatus').textContent = 'Escuchando… puedes dictar hasta 45 segundos.';
  VoiceRuntime.noSpeechTimer = setTimeout(function() {
    if (VoiceRuntime.recognition === recognition && !VoiceRuntime.hasSpeech) voiceUseKeyboard('No llegó dictado. Usa el micrófono del teclado del iPhone.');
  }, 10000);
  VoiceRuntime.speechTimer = setTimeout(function() {
    if (VoiceRuntime.recognition === recognition) voiceStopListening(true);
  }, 45000);
  try { recognition.start(); } catch (error) { voiceUseKeyboard(); }
}
function voiceUpdateStatus() {
  var configured = !!voiceAccessToken();
  voiceElement('voiceActivation').textContent = configured ? 'Acceso privado listo en este iPhone.' : 'Asistente pendiente de activación.';
  voiceElement('voiceDisconnect').hidden = !configured;
  voiceElement('voiceError').textContent = VoiceRuntime.error || VoiceRuntime.storageError;
  voiceElement('voiceCharacterCount').textContent = VoiceDraft.text.length + ' / 2000';
  var prepare = voiceElement('voicePrepare');
  prepare.textContent = VoiceRuntime.busy ? 'Preparando movimientos…' : 'Preparar movimientos';
  prepare.disabled = !configured || !VoiceDraft.text.trim() || VoiceRuntime.busy || VoiceRuntime.saving;
  voiceElement('voiceMic').hidden = !voiceCanListen();
  voiceElement('voiceMic').disabled = VoiceRuntime.busy || VoiceRuntime.saving;
  voiceUpdateTotals();
}
function voiceFocusText() { voiceElement('voiceText').focus({ preventScroll: false }); }
function voiceOpen() {
  if (!VoiceDraft.text.trim() && !VoiceDraft.rows.length) VoiceDraft.date = voiceToday();
  voiceElement('voiceText').value = VoiceDraft.text;
  voiceElement('voicePersonD').textContent = voiceName('d'); voiceElement('voicePersonT').textContent = voiceName('t');
  voiceElement('voicePerson').value = VoiceDraft.person;
  voiceElement('voiceDate').value = VoiceDraft.date; voiceElement('voiceDate').max = voiceToday();
  voiceElement('voiceAccessInput').value = '';
  voiceElement('voiceAccessError').textContent = '';
  voiceElement('voiceMicStatus').textContent = 'En iPhone, toca el texto y usa el micrófono del teclado. También puedes escribir.';
  voiceRenderPreview(); voiceUpdateStatus(); open_('voiceModal');
}
function voiceOnClose() { voiceStopListening(false); voiceAbortRequest(); }
function voiceInit() {
  voiceLoadDraft();
  voiceElement('voiceText').addEventListener('input', function(event) { voiceUpdateText(event.target.value, false); });
  voiceElement('voicePerson').addEventListener('change', voiceChangeContext);
  voiceElement('voiceDate').addEventListener('change', voiceChangeContext);
  voiceElement('voiceRows').addEventListener('input', voiceEditRow);
  voiceElement('voiceRows').addEventListener('click', function(event) {
    var button = event.target.closest('[data-voice-remove]');
    if (button) voiceRemoveRow(Number(button.getAttribute('data-voice-remove')));
  });
  document.addEventListener('visibilitychange', function() { if (document.hidden) voiceStopListening(false); });
  voiceUpdateStatus();
}
voiceInit();
