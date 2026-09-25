// Mini moteur de rendu pour fichiers "x-dc" (templates sc-for / sc-if / {{ }}), usage maquettes uniquement.
class DCLogic { constructor(){ this.state = {}; } setState(p){ const n = typeof p === 'function' ? p(this.state) : p; this.state = Object.assign({}, this.state, n); window.__dcRender && window.__dcRender(); } }
window.DCLogic = DCLogic;
function evalExpr(expr, scope){ try { return new Function('scope', 'with(scope){ return (' + expr + '); }')(scope); } catch(e){ return undefined; } }
const RE = /\{\{\s*([\s\S]+?)\s*\}\}/g;
function interp(str, scope){ const m = str.match(/^\s*\{\{\s*([\s\S]+?)\s*\}\}\s*$/); if (m && str.split("{{").length === 2) return evalExpr(m[1], scope); return str.replace(RE, (_, e) => { const v = evalExpr(e, scope); return v == null ? '' : v; }); }
function renderNode(node, scope, out){
  if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.textContent, scope))); return; }
  if (node.nodeType !== 1) return;
  const tag = node.tagName.toLowerCase();
  if (tag === 'sc-for') { const list = interp(node.getAttribute('list'), scope) || []; const as = node.getAttribute('as');
    list.forEach((item, i) => { const s = Object.create(scope); s[as] = item; s.index = i; node.childNodes.forEach(c => renderNode(c, s, out)); }); return; }
  if (tag === 'sc-if') { if (interp(node.getAttribute('value'), scope)) node.childNodes.forEach(c => renderNode(c, scope, out)); return; }
  const el = document.createElement(node.tagName);
  for (const a of node.attributes) { const n = a.name;
    if (n.startsWith('on') && a.value.includes('{{')) { const fn = interp(a.value, scope); if (typeof fn === 'function') el.addEventListener(n.slice(2).toLowerCase() === 'change' ? 'input' : n.slice(2).toLowerCase(), fn); continue; }
    if (n.startsWith('hint-')) continue;
    const v = interp(a.value, scope); if (n === 'value') el.value = v; if (n === 'checked') { if (v) el.setAttribute('checked', ''); continue; } el.setAttribute(n, v == null ? '' : v); }
  node.childNodes.forEach(c => renderNode(c, scope, el)); out.appendChild(el);
}
window.addEventListener('DOMContentLoaded', () => {
  const host = document.querySelector('x-dc'); const tpl = document.createElement('div'); tpl.innerHTML = host.innerHTML; host.remove();
  const helmet = tpl.querySelector('helmet'); if (helmet) { [...helmet.childNodes].forEach(c => document.head.appendChild(c.cloneNode(true))); helmet.remove(); }
  const code = document.querySelector('script[data-dc-script]').textContent;
  const Comp = new Function('DCLogic', code + '\n;return Component;')(DCLogic);
  const comp = new Comp(); window.__dc = comp;
  const root = document.createElement('div'); document.body.appendChild(root);
  window.__dcRender = () => { const vals = comp.renderVals(); const frag = document.createDocumentFragment(); tpl.childNodes.forEach(c => renderNode(c, vals, frag)); root.replaceChildren(frag); };
  window.__dcRender();
});
