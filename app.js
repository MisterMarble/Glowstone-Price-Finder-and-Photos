const state = {
  rows: [],
  byName: new Map(),
  placeholder: "images/image-not-available.jpg"
};

function slugify(s=""){return s.toLowerCase().replace(/[^a-z0-9\s\-]/g,"").trim().replace(/\s+/g,"-").replace(/\-+/g,"-");}
function imgFor(name){ return `images/${slugify(name)}.jpg`; }
function moneyUSD(n){ const x = parseFloat(n); if (Number.isNaN(x)) return "-"; return "$ " + x.toFixed(2) + " / m²"; }

async function loadExcel(path){
  const res = await fetch(path + "?t=" + Date.now(), { cache: "no-store" });
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
  state.rows = json.map(r => ({
    name: String(r["Product Name"]||"").trim(),
    mm30: r["30mm"],
    mm20: r["20mm"]
  })).filter(r => r.name);
  state.byName.clear();
  for (const r of state.rows){ state.byName.set(r.name.toLowerCase(), r); }
}

function listMatches(term){
  const t = term.trim().toLowerCase();
  if (!t) return [];
  return state.rows.filter(r => r.name.toLowerCase().includes(t)).slice(0, 8);
}

function renderSuggestions(term){
  const mount = document.getElementById("suggestions");
  const matches = listMatches(term);
  if (!matches.length){ mount.hidden = true; mount.innerHTML = ""; return; }
  mount.innerHTML = matches.map(m => `<li data-name="${m.name}">${m.name}</li>`).join("");
  mount.hidden = false;
  mount.querySelectorAll("li").forEach(li => {
    li.onclick = () => { selectByName(li.dataset.name); mount.hidden = true; };
  });
}

function selectByName(name){
  const row = state.byName.get(String(name).toLowerCase());
  renderResult(row);
  const q = document.getElementById("query");
  q.value = name || "";
}

function renderResult(item){
  const mount = document.getElementById("result");
  if (!item){
    mount.innerHTML = `<div class="card"><div class="content"><div class="title">No match</div><div>Try a keyword (e.g., "Stratus") or the full name.</div></div></div>`;
    return;
  }
  const img = imgFor(item.name);
  mount.innerHTML = `
  <article class="card">
    <div class="img-wrap">
      <img src="${img}" alt="${item.name}" onerror="this.src='${state.placeholder}'; this.nextElementSibling.style.display='flex'">
      <div class="fallback">Image Not Available</div>
    </div>
    <div class="content">
      <div class="title">${item.name}</div>
      <div class="grid">
        <div class="pricebox">
          <div class="label">30 mm</div>
          <div class="value">${moneyUSD(item.mm30)}</div>
        </div>
        <div class="pricebox">
          <div class="label">20 mm</div>
          <div class="value">${moneyUSD(item.mm20)}</div>
        </div>
      </div>
      <div class="actions">
        <button class="primary" id="shareBtn">Share photo</button>
        <button id="copyLinkBtn">Copy link</button>
        <a id="downloadBtn" class="ghost" href="${img}" download="${slugify(item.name)}.jpg">Download photo</a>
      </div>
    </div>
  </article>`;

  document.getElementById("shareBtn").onclick = () => sharePhoto(item.name, img);
  document.getElementById("copyLinkBtn").onclick = () => copyLink(img);
}

async function sharePhoto(name, imgUrl){
  try{
    const r = await fetch(imgUrl);
    const blob = await r.blob();
    const file = new File([blob], `${slugify(name)}.jpg`, { type: blob.type || "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files:[file] })){
      await navigator.share({ title: name, text: name, files: [file] });
      return;
    }
    if (navigator.share){
      await navigator.share({ title: name, text: name, url: imgUrl });
      return;
    }
  }catch(e){ /* fall back below */ }
  const msg = encodeURIComponent(`${name} — ${imgUrl}`);
  const wa = `https://wa.me/?text=${msg}`;
  window.open(wa, "_blank");
}

async function copyLink(link){
  try{
    await navigator.clipboard.writeText(link);
    alert("Image link copied. Paste it into WhatsApp or email.");
  }catch(e){
    prompt("Copy this link:", link);
  }
}

async function init(){
  await loadExcel("data/price-list.xlsx");
  const q = document.getElementById("query");
  const s = document.getElementById("suggestions");
  document.getElementById("clearBtn").onclick = () => { q.value=""; s.hidden = true; document.getElementById("result").innerHTML=""; q.focus(); };

  q.addEventListener("input", () => renderSuggestions(q.value));
  q.addEventListener("focus", () => renderSuggestions(q.value));
  q.addEventListener("blur", () => setTimeout(() => s.hidden = true, 120));

  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter"){
      const matches = listMatches(q.value);
      if (matches.length){ selectByName(matches[0].name); }
      else { renderResult(null); }
    }
  });
}
init();
