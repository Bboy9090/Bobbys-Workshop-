'use strict';
// Validates checkpoint structure, not the authenticity of external receipts.
function validateCheckpoint(value) {
  const errors = [];
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  const sha = v => typeof v === 'string' && /^[a-f0-9]{40}$/i.test(v);
  const url = v => {
    if (typeof v !== 'string' || /\s/.test(v) || !v.startsWith('https://')) return false;
    try {
      const parsed = new URL(v);
      return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
    } catch { return false; }
  };
  if (!object(value)) return { valid: false, errors: ['checkpoint must be an object'] };
  if (value.version !== 1) errors.push('version must be 1');
  for (const key of ['project','task','owner','nextAction']) {
    if (!text(value[key])) errors.push(key + ' must be nonempty text');
  }
  if (!text(value.timestamp) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.timestamp) || !Number.isFinite(Date.parse(value.timestamp)) || new Date(value.timestamp).toISOString().replace('.000Z','Z') !== value.timestamp.replace('.000Z','Z')) errors.push('timestamp must be a valid UTC ISO timestamp');
  if (!object(value.source) || !text(value.source.repository) || !text(value.source.branch) || !sha(value.source.revision)) errors.push('source requires repository, branch and full commit revision');
  const states = ['planned','implemented','tested','deployed','published','physicallyProven'];
  if (!states.includes(value.state)) errors.push('state is unsupported');
  for (const key of ['blockers','dependencies']) {
    if (!Array.isArray(value[key]) || value[key].some(v => !text(v))) errors.push(key + ' must be an array of nonempty text');
  }
  if (!Array.isArray(value.evidence)) errors.push('evidence must be an array');
  else {
    value.evidence.forEach((receipt, i) => {
      if (!object(receipt) || !text(receipt.executor) || !sha(receipt.revision) || !url(receipt.url) || !['pass','fail','notRun'].includes(receipt.result) || !['implementation','test','deployment','publication','hardware'].includes(receipt.kind)) errors.push('evidence[' + i + '] has invalid receipt fields');
    });
    const kinds = {implemented:'implementation',tested:'test',deployed:'deployment',published:'publication',physicallyProven:'hardware'};
    const required = kinds[value.state];
    if (required && !value.evidence.some(r => object(r) && r.kind === required && r.result === 'pass' && r.revision === value.source?.revision && text(r.executor) && url(r.url))) errors.push(value.state + ' requires a matching successful ' + required + ' receipt');
  }
  return { valid: errors.length === 0, errors };
}
module.exports = { validateCheckpoint };

