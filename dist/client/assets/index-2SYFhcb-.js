const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/passkey-vYlKOEtM.js","assets/index-CusJxp7I.js","assets/CrossOriginAuth-CubEWBdJ.js"])))=>i.map(i=>d[i]);
(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const d of o.addedNodes)d.tagName==="LINK"&&d.rel==="modulepreload"&&i(d)}).observe(document,{childList:!0,subtree:!0});function n(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(s){if(s.ep)return;s.ep=!0;const o=n(s);fetch(s.href,o)}})();const ie="modulepreload",re=function(e){return"/"+e},K={},G=function(a,n,i){let s=Promise.resolve();if(n&&n.length>0){document.getElementsByTagName("link");const d=document.querySelector("meta[property=csp-nonce]"),m=(d==null?void 0:d.nonce)||(d==null?void 0:d.getAttribute("nonce"));s=Promise.allSettled(n.map(y=>{if(y=re(y),y in K)return;K[y]=!0;const f=y.endsWith(".css"),k=f?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${y}"]${k}`))return;const v=document.createElement("link");if(v.rel=f?"stylesheet":ie,f||(v.as="script"),v.crossOrigin="",v.href=y,m&&v.setAttribute("nonce",m),document.head.appendChild(v),f)return new Promise((r,E)=>{v.addEventListener("load",r),v.addEventListener("error",()=>E(new Error(`Unable to preload CSS for ${y}`)))})}))}function o(d){const m=new Event("vite:preloadError",{cancelable:!0});if(m.payload=d,window.dispatchEvent(m),!m.defaultPrevented)throw d}return s.then(d=>{for(const m of d||[])m.status==="rejected"&&o(m.reason);return a().catch(o)})},Q="https://amused-kameko-veridex-demo-37453117.koyeb.app/api/v1",oe=Q.replace(/\/api\/v1\/?$/,""),F="stablehacks_identity";let N=null,C=null,D=null;async function Z(){return N||(N=await G(()=>import("./passkey-vYlKOEtM.js"),__vite__mapDeps([0,1]))),N}async function le(){return C||(C=await G(()=>import("./CrossOriginAuth-CubEWBdJ.js"),__vite__mapDeps([2,1]))),C}async function M(){if(!D){const{PasskeyManager:e}=await Z();D=new e({rpName:"StableHacks Treasury Workspace",rpId:window.location.hostname,userVerification:"required",authenticatorAttachment:"platform",relayerUrl:oe})}return D}function ee(e){return{credentialId:e.credentialId,publicKeyX:e.publicKeyX.toString(),publicKeyY:e.publicKeyY.toString(),keyHash:e.keyHash}}async function O(){const e=await M();e.saveToLocalStorage(),typeof e.saveCredentialToRelayer=="function"&&await e.saveCredentialToRelayer().catch(()=>!1)}async function ae(e){const{createCrossOriginAuth:a}=await le();return a({relayerUrl:Q,rpId:window.location.hostname}).createServerSession({address:"",sessionPublicKey:"",expiresAt:Date.now()+12*60*60*1e3,signature:e.signature,credential:e.credential},{permissions:["treasury:read","wallet:fund","assets:refresh"],expiresInMs:12*60*60*1e3})}async function ce(){const{PasskeyManager:e}=await Z();return e.isSupported()}function P(){const e=localStorage.getItem(F);if(!e)return null;try{return JSON.parse(e)}catch{return null}}function j(e){localStorage.setItem(F,JSON.stringify(e))}function de(){localStorage.removeItem(F)}async function pe(e,a){const n=await M();await n.register(e,a),await O();const i=await n.authenticate();return n.setCredential(i.credential),await O(),{username:e,displayName:a,credential:ee(i.credential),authOrigin:window.location.origin,authSession:await ae(i)}}async function ue(e,a){const n=await M();n.loadFromLocalStorage();const i=await n.authenticate();return n.setCredential(i.credential),await O(),{username:e,displayName:a,credential:ee(i.credential),authOrigin:window.location.origin,authSession:await ae(i)}}const x=document.querySelector("#app");if(!x)throw new Error("App root not found.");let g=null,l=null,T=null,L="",b="";async function h(e,a){const n=await fetch(e,{...a,headers:{"content-type":"application/json",...(a==null?void 0:a.headers)||{}}}),i=await n.json();if(!n.ok||!i.success||!i.data)throw new Error(i.error||"Request failed.");return i.data}function A(){const e=window.location.hash||"";return e.startsWith("#/dashboard")?{page:"dashboard"}:e.startsWith("#/public/pay/")?{page:"public-pay",slug:e.replace("#/public/pay/","")}:e.startsWith("#/public/claim/")?{page:"public-claim",slug:e.replace("#/public/claim/","")}:{page:"landing"}}function t(e){return e.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function q(e){return e?new Intl.DateTimeFormat("en-US",{dateStyle:"medium",timeStyle:"short"}).format(e):"Not available"}function me(e){return new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(e)}function _(e){return e?e.length<=12?e:`${e.slice(0,6)}...${e.slice(-6)}`:"Not connected"}function w(e){switch(e){case"healthy":case"approved":case"settled":case"verified":case"confirmed":case"active":case"paid":case"claimed":return"good";case"escalated":case"medium":case"degraded":case"pending":case"sent":return"warn";case"blocked":case"failed":case"critical":case"rejected":case"invalid":case"expired":case"void":return"bad";default:return"neutral"}}function te(e){return`
    <article class="validation-card">
      <div class="row between center">
        <strong>${t(e.label)}</strong>
        <span class="pill pill-${w(e.status)}">${t(e.status)}</span>
      </div>
      <p>${t(e.details)}</p>
      <div class="micro-meta">
        <span>${t(e.target)}</span>
        <span>${e.latencyMs??"n/a"} ms</span>
      </div>
    </article>
  `}function be(e){return e.verdictReasons.map(a=>`
        <li class="reason reason-${t(a.severity)}">
          <strong>${t(a.code)}</strong>
          <span>${t(a.description)}</span>
        </li>
      `).join("")}function ye(e){return`
    <article class="timeline-card">
      <div class="row between center">
        <strong>${t(e.assetSymbol)} • ${t(e.amountDisplay)}</strong>
        <span class="pill pill-${w(e.status)}">${t(e.status)}</span>
      </div>
      <p>${t(e.notes||`${e.eventType} routed to the connected wallet.`)}</p>
      <div class="micro-meta">
        <span>${t(e.eventType)}</span>
        <span>${t(q(e.createdAt))}</span>
      </div>
      ${e.explorerUrl?`<a class="inline-link" href="${t(e.explorerUrl)}" target="_blank" rel="noreferrer">Open transaction</a>`:""}
    </article>
  `}function ve(e){return`
    <article class="timeline-card">
      <div class="row between center">
        <strong>${t(e.title)}</strong>
        <span class="pill pill-${w(e.status)}">${t(e.status)}</span>
      </div>
      <p>${t(e.description||`${e.kind} for ${e.amountDisplay} ${e.assetSymbol}`)}</p>
      <div class="micro-meta">
        <span>${t(e.kind)}</span>
        <span>${t(e.amountDisplay)} ${t(e.assetSymbol)}</span>
      </div>
      <a class="inline-link" href="${t(e.url)}" target="_blank" rel="noreferrer">${t(e.url)}</a>
      ${e.explorerUrl?`<a class="inline-link" href="${t(e.explorerUrl)}" target="_blank" rel="noreferrer">Open receipt transaction</a>`:""}
    </article>
  `}function ne(e){return`
    <section class="topbar">
      <div class="brand-block">
        <span class="brand-mark">SH</span>
        <div>
          <strong>StableHacks 2026</strong>
          <span>${e.page==="dashboard"?"Operator Dashboard":e.page.startsWith("public")?"Public Checkout":"Solana Treasury Workspace"}</span>
        </div>
      </div>
      <div class="topbar-actions">
        <span class="signal"><i></i>Live devnet infrastructure</span>
        ${e.page==="dashboard"?'<button class="button button-secondary" data-action="goto-landing">Landing</button>':'<button class="button button-secondary" data-action="goto-dashboard">Dashboard</button>'}
      </div>
    </section>
  `}function U(){var s;const e=A(),a=l,n=g,i=(n==null?void 0:n.validations.filter(o=>o.status==="healthy").length)||0;return`
    ${ne(e)}
    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow">Enterprise treasury operations for the Solana ecosystem</span>
        <h1>Passkey-secured treasury control built for real stablecoin operations.</h1>
        <p class="hero-lede">
          StableHacks combines Solana passkey onboarding, relayer-backed Auth Sessions,
          Prisma-backed asset intelligence, payment links, invoices, receipts, and live policy execution into one control plane.
        </p>
        <div class="hero-proof">
          <span>Passkey wallet lifecycle</span>
          <span>Auth Session governance</span>
          <span>Payment and claim links</span>
          <span>Invoices and receipts</span>
          <span>Solana-only settlement</span>
        </div>
        <div class="hero-actions">
          <a class="button button-primary" href="#wallet-onboarding">Create passkey wallet</a>
          <button class="button button-secondary" data-action="bootstrap">
            ${n!=null&&n.summary.stableAsset?"Treasury live on devnet":"Bootstrap treasury"}
          </button>
          <button class="button button-secondary" data-action="refresh-state">Refresh live state</button>
        </div>
        <div class="hero-band">
          <div class="hero-band-card">
            <span>Validated dependencies</span>
            <strong>${i}/${(n==null?void 0:n.validations.length)||0}</strong>
          </div>
          <div class="hero-band-card">
            <span>Connected operator wallet</span>
            <strong>${a?_(a.profile.walletAddress):"Not connected"}</strong>
          </div>
          <div class="hero-band-card">
            <span>Dashboard route</span>
            <strong>${e.page==="dashboard"?"Active":"Standby"}</strong>
          </div>
        </div>
      </div>
      <div class="hero-stage panel">
        <div class="hero-stage-head">
          <span class="section-tag">Control plane preview</span>
          <strong>Operator session overview</strong>
        </div>
        <div class="control-preview">
          <div class="preview-shell">
            <div class="preview-header">
              <span>Connected wallet</span>
              <strong>${a?_(a.profile.walletAddress):"Awaiting passkey session"}</strong>
            </div>
            <div class="preview-metrics">
              <article>
                <span>Session state</span>
                <strong>${t(((s=a==null?void 0:a.authSession)==null?void 0:s.status)||"Not started")}</strong>
              </article>
              <article>
                <span>Tracked assets</span>
                <strong>${(a==null?void 0:a.assets.length)||0}</strong>
              </article>
              <article>
                <span>Payment links</span>
                <strong>${(a==null?void 0:a.paymentLinks.length)||0}</strong>
              </article>
              <article>
                <span>Invoices</span>
                <strong>${(a==null?void 0:a.invoices.length)||0}</strong>
              </article>
            </div>
            <div class="preview-rail">
              <div>
                <span>Wallet onboarding</span>
                <strong>Passkey -> Auth Session -> Dashboard redirect</strong>
              </div>
              <div>
                <span>Collections</span>
                <strong>Payment links -> Invoice settlement -> Receipt creation</strong>
              </div>
              <div>
                <span>Payouts</span>
                <strong>Claim link -> Treasury stable transfer -> Explorer proof</strong>
              </div>
            </div>
          </div>
        </div>
        <div class="live-status">
          <span>${L?`Working: ${t(L)}`:"Live Solana devnet only."}</span>
          <span>${b?t(b):"No mocked settlement, links, invoices, or payout flows."}</span>
        </div>
      </div>
    </section>
  `}function W(){var n,i,s,o;const e=l,a=P();return`
    <section class="workspace-grid" id="wallet-onboarding">
      <article class="panel onboarding-panel">
        <div class="section-head">
          <div>
            <span class="section-tag">Wallet onboarding</span>
            <h2>Connect a passkey wallet and redirect into the operator dashboard.</h2>
          </div>
          ${e?`<span class="pill pill-${w(((n=e.authSession)==null?void 0:n.status)||"neutral")}">${t(((i=e.authSession)==null?void 0:i.status)||"connected")}</span>`:""}
        </div>
        <form id="wallet-form" class="stack-form">
          <div class="field-grid">
            <label>
              <span>Workspace handle</span>
              <input name="username" value="${t((e==null?void 0:e.profile.username)||(a==null?void 0:a.username)||"treasury@stablehacks.io")}" required />
            </label>
            <label>
              <span>Display name</span>
              <input name="displayName" value="${t((e==null?void 0:e.profile.displayName)||(a==null?void 0:a.displayName)||"StableHacks Treasury")}" required />
            </label>
          </div>
          <div class="action-row">
            <button class="button button-primary" type="button" data-action="create-wallet">Create passkey wallet</button>
            <button class="button button-secondary" type="button" data-action="reconnect-wallet">Reconnect with passkey</button>
            ${e?'<button class="button button-ghost" type="button" data-action="disconnect-wallet">Clear local session</button>':""}
          </div>
        </form>
      </article>

      <article class="panel wallet-panel">
        <div class="section-head">
          <div>
            <span class="section-tag">Connected workspace</span>
            <h2>${e?t(e.profile.displayName):"No wallet connected yet"}</h2>
          </div>
          ${e!=null&&e.profile.walletExplorerUrl?`<a class="inline-link" href="${t(e.profile.walletExplorerUrl)}" target="_blank" rel="noreferrer">Open on explorer</a>`:""}
        </div>
        ${e?`
              <div class="wallet-summary">
                <div>
                  <span>Wallet address</span>
                  <strong class="mono">${t(e.profile.walletAddress)}</strong>
                </div>
                <div>
                  <span>Auth Session</span>
                  <strong>${t(q(((s=e.authSession)==null?void 0:s.expiresAt)||null))}</strong>
                </div>
                <div>
                  <span>Dashboard links</span>
                  <strong>${e.paymentLinks.length} active records</strong>
                </div>
              </div>
              <div class="action-row">
                <button class="button button-primary" data-action="goto-dashboard">Open dashboard</button>
                <button class="button button-secondary" data-action="refresh-assets">Refresh assets</button>
                <button class="button button-secondary" data-action="wallet-airdrop">Request 1 SOL airdrop</button>
                <button class="button button-secondary" data-action="wallet-seed">Seed 250 ${t(((o=g==null?void 0:g.summary.stableAsset)==null?void 0:o.symbol)||"USDX")}</button>
              </div>
            `:'<p class="empty">Create a passkey wallet to unlock the operator dashboard and shared payment routes.</p>'}
      </article>
    </section>
  `}function ge(){var s,o,d,m,y,f,k,v;const e=g,a=l;if(!a)return`
      ${U()}
      ${W()}
      <section class="panel"><p class="empty">Create or reconnect a passkey wallet first, then you will be redirected to the dashboard.</p></section>
    `;const n=((s=e==null?void 0:e.summary.stableAsset)==null?void 0:s.symbol)||"USDX",i=!!(e!=null&&e.summary.stableAsset);return`
    ${U()}
    <section class="trust-strip">
      ${e!=null&&e.validations.length?e.validations.map(te).join(""):'<p class="empty">Validation data unavailable.</p>'}
    </section>
    ${W()}

    <section class="workspace-grid">
      <article class="panel">
        <div class="section-head">
          <div>
            <span class="section-tag">Collections</span>
            <h2>Create payment links and payout claim links</h2>
          </div>
        </div>
        <form id="payment-link-form" class="stack-form">
          <div class="field-grid">
            <label><span>Payment link title</span><input name="title" placeholder="Advisory retainer" required /></label>
            <label><span>Amount (${t(n)})</span><input name="amount" type="number" min="1" step="0.01" required /></label>
            <label><span>Customer name</span><input name="customerName" placeholder="Acme Ventures" /></label>
            <label><span>Customer email</span><input name="customerEmail" placeholder="finance@acme.xyz" /></label>
          </div>
          <label><span>Description</span><input name="description" placeholder="Shared payment request on Solana devnet" /></label>
          <button class="button button-primary" type="submit">Create payment link</button>
        </form>
        <form id="claim-link-form" class="stack-form">
          <div class="field-grid">
            <label><span>Claim link title</span><input name="title" placeholder="Vendor rebate payout" required /></label>
            <label><span>Amount (${t(n)})</span><input name="amount" type="number" min="1" step="0.01" required /></label>
            <label><span>Recipient name</span><input name="customerName" placeholder="Beneficiary name" /></label>
            <label><span>Recipient email</span><input name="customerEmail" placeholder="ops@beneficiary.xyz" /></label>
          </div>
          <label><span>Description</span><input name="description" placeholder="Public claim link for treasury-funded payout" /></label>
          <button class="button button-secondary" type="submit">Create claim link</button>
        </form>
      </article>

      <article class="panel">
        <div class="section-head">
          <div>
            <span class="section-tag">Invoicing</span>
            <h2>Issue invoices with linked payment requests</h2>
          </div>
        </div>
        <form id="invoice-form" class="stack-form">
          <div class="field-grid">
            <label><span>Invoice title</span><input name="title" placeholder="Platform integration fee" required /></label>
            <label><span>Amount (${t(n)})</span><input name="amount" type="number" min="1" step="0.01" required /></label>
            <label><span>Customer name</span><input name="customerName" placeholder="Northwind Trading" required /></label>
            <label><span>Customer email</span><input name="customerEmail" placeholder="ap@northwind.io" /></label>
          </div>
          <label><span>Description</span><input name="description" placeholder="Invoice details" /></label>
          <label><span>Due date</span><input name="dueDate" type="date" /></label>
          <button class="button button-primary" type="submit">Create invoice</button>
        </form>
      </article>
    </section>

    <section class="workspace-grid">
      <article class="panel">
        <div class="section-head">
          <div><span class="section-tag">Payment links</span><h2>Shared collection and claim routes</h2></div>
        </div>
        <div class="timeline-list">
          ${a.paymentLinks.length?a.paymentLinks.map(ve).join(""):'<p class="empty">No payment or claim links created yet.</p>'}
        </div>
      </article>

      <article class="panel">
        <div class="section-head">
          <div><span class="section-tag">Invoices and receipts</span><h2>Commercial records</h2></div>
        </div>
        <div class="timeline-list">
          ${a.invoices.length||a.receipts.length?`
                ${a.invoices.map(r=>`
                  <article class="timeline-card">
                    <div class="row between center">
                      <strong>${t(r.invoiceNumber)} • ${t(r.title)}</strong>
                      <span class="pill pill-${w(r.status)}">${t(r.status)}</span>
                    </div>
                    <p>${t(r.customerName)} • ${t(r.amountDisplay)} ${t(r.assetSymbol)}</p>
                    <div class="micro-meta"><span>${t(q(r.createdAt))}</span></div>
                  </article>
                `).join("")}
                ${a.receipts.map(r=>`
                  <article class="timeline-card">
                    <div class="row between center">
                      <strong>${t(r.receiptNumber)}</strong>
                      <span class="pill pill-${w(r.kind)}">${t(r.kind)}</span>
                    </div>
                    <p>${t(r.amountDisplay)} ${t(r.assetSymbol)} • ${t(_(r.recipientAddress))}</p>
                    ${r.explorerUrl?`<a class="inline-link" href="${t(r.explorerUrl)}" target="_blank" rel="noreferrer">Open explorer proof</a>`:""}
                  </article>
                `).join("")}
              `:'<p class="empty">Receipts are generated after verified payment-link settlement or claim-link payout.</p>'}
        </div>
      </article>
    </section>

    <section class="workspace-grid">
      <article class="panel">
        <div class="section-head">
          <div><span class="section-tag">Funding workflow</span><h2>Fund the operator wallet</h2></div>
        </div>
        <div class="action-row">
          <button class="button button-primary" data-action="refresh-assets">Refresh assets</button>
          <button class="button button-secondary" data-action="wallet-airdrop">Request 1 SOL airdrop</button>
          <button class="button button-secondary" data-action="wallet-seed">Seed 250 ${t(n)}</button>
        </div>
        <div class="assets-grid">
          ${a.assets.length?a.assets.map(r=>`
            <article class="asset-card">
              <div class="row between center"><strong>${t(r.symbol)}</strong><span>${t(r.assetType)}</span></div>
              <h3>${t(r.amountDisplay)}</h3>
              <p>${t(r.name)}</p>
            </article>
          `).join(""):'<p class="empty">No asset snapshots yet.</p>'}
        </div>
      </article>

      <article class="panel">
        <div class="section-head">
          <div><span class="section-tag">Funding history</span><h2>Recent wallet events</h2></div>
        </div>
        <div class="timeline-list">
          ${a.fundingEvents.length?a.fundingEvents.map(ye).join(""):'<p class="empty">Funding events will appear here.</p>'}
        </div>
      </article>
    </section>

    <section class="workspace-grid">
      <article class="panel">
        <div class="section-head">
          <div><span class="section-tag">Treasury setup</span><h2>${i?"Policy configuration":"Bootstrap a live Solana treasury"}</h2></div>
        </div>
        ${i?`
              <form id="policy-form" class="stack-form">
                <label><span>Institution name</span><input name="institutionName" value="${t(((o=e==null?void 0:e.policy)==null?void 0:o.institutionName)||"")}" required /></label>
                <div class="field-grid">
                  <label><span>Max transfer</span><input name="maxTransactionAmount" type="number" min="1" step="0.01" value="${((d=e==null?void 0:e.policy)==null?void 0:d.maxTransactionAmount)??0}" required /></label>
                  <label><span>Daily limit</span><input name="dailySendLimit" type="number" min="1" step="0.01" value="${((m=e==null?void 0:e.policy)==null?void 0:m.dailySendLimit)??0}" required /></label>
                  <label><span>Escalation threshold</span><input name="escalationThreshold" type="number" min="1" step="0.01" value="${((y=e==null?void 0:e.policy)==null?void 0:y.escalationThreshold)??0}" required /></label>
                  <label><span>Travel rule threshold</span><input name="travelRuleThreshold" type="number" min="1" step="0.01" value="${((f=e==null?void 0:e.policy)==null?void 0:f.travelRuleThreshold)??0}" required /></label>
                </div>
                <label><span>Allowed corridors</span><input name="allowedCorridors" value="${t(((k=e==null?void 0:e.policy)==null?void 0:k.allowedCorridors.join(", "))||"")}" /></label>
                <label class="checkbox-row"><input name="requireTravelRule" type="checkbox" ${(v=e==null?void 0:e.policy)!=null&&v.requireTravelRule?"checked":""} /><span>Require travel rule metadata above threshold</span></label>
                <button class="button button-primary" type="submit">Save treasury policy</button>
              </form>
            `:`
              <form id="bootstrap-form" class="stack-form">
                <label><span>Asset mode</span><select name="assetMode"><option value="managed-mint">Managed SPL mint</option><option value="external-mint">Existing stablecoin mint</option></select></label>
                <label><span>External mint address</span><input name="externalMintAddress" placeholder="Optional for external-mint mode" /></label>
                <label><span>Initial treasury supply</span><input name="initialMintAmount" type="number" min="1000" step="1000" value="250000" /></label>
                <button class="button button-primary" type="submit">Bootstrap live devnet treasury</button>
              </form>
            `}
      </article>

      <article class="panel">
        <div class="section-head">
          <div><span class="section-tag">Payout queue</span><h2>Policy-gated treasury execution</h2></div>
        </div>
        <div class="queue-list">
          ${e!=null&&e.payouts.length?e.payouts.map(r=>`
            <article class="queue-card">
              <div class="row between center">
                <div><h3>${t(r.counterpartyName)} • ${me(r.amount)} ${t(n)}</h3><p>${t(r.corridor)} • ${t(r.memo)}</p></div>
                <span class="pill pill-${w(r.status)}">${t(r.status)}</span>
              </div>
              <ul class="reasons">${be(r)}</ul>
            </article>
          `).join(""):'<p class="empty">No payout requests yet.</p>'}
        </div>
      </article>
    </section>
  `}function he(e){const a=T;return`
    ${ne(e)}
    <section class="workspace-grid">
      <article class="panel">
        <div class="section-head">
          <div>
            <span class="section-tag">${e.page==="public-pay"?"Payment request":"Payout claim"}</span>
            <h2>${t((a==null?void 0:a.link.title)||"Loading link")}</h2>
          </div>
          ${a!=null&&a.link?`<span class="pill pill-${w(a.link.status)}">${t(a.link.status)}</span>`:""}
        </div>
        ${a?`
              <p>${t(a.link.description||"")}</p>
              <div class="wallet-summary">
                <div><span>Amount</span><strong>${t(a.link.amountDisplay)} ${t(a.link.assetSymbol)}</strong></div>
                <div><span>Recipient</span><strong class="mono">${t(a.link.destinationAddress)}</strong></div>
                <div><span>Status</span><strong>${t(a.link.status)}</strong></div>
              </div>
              ${e.page==="public-pay"?`
                    <p class="empty">Send the exact amount to the destination wallet using a Solana devnet wallet, then paste the transaction signature below so the app can verify the payment on-chain and issue a receipt.</p>
                    <form id="public-pay-form" class="stack-form">
                      <label><span>Transaction signature</span><input name="txSignature" placeholder="Paste Solana signature after payment" required /></label>
                      <button class="button button-primary" type="submit">Verify payment</button>
                    </form>
                  `:`
                    <p class="empty">Enter the Solana wallet that should receive the payout. Once submitted, the treasury will execute the claim on devnet and a receipt will be created.</p>
                    <form id="public-claim-form" class="stack-form">
                      <label><span>Recipient wallet address</span><input name="recipientAddress" placeholder="Solana wallet to receive payout" required /></label>
                      <button class="button button-primary" type="submit">Claim payout</button>
                    </form>
                  `}
            `:'<p class="empty">Loading public link...</p>'}
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="section-tag">Commercial proof</span><h2>Invoice and receipt status</h2></div></div>
        ${a?`
              ${a.invoice?`<article class="timeline-card"><div class="row between center"><strong>${t(a.invoice.invoiceNumber)}</strong><span class="pill pill-${w(a.invoice.status)}">${t(a.invoice.status)}</span></div><p>${t(a.invoice.customerName)} • ${t(a.invoice.amountDisplay)} ${t(a.invoice.assetSymbol)}</p></article>`:'<p class="empty">No invoice is attached to this link.</p>'}
              ${a.receipt?`<article class="timeline-card"><div class="row between center"><strong>${t(a.receipt.receiptNumber)}</strong><span class="pill pill-${w(a.receipt.kind)}">${t(a.receipt.kind)}</span></div><p>${t(a.receipt.amountDisplay)} ${t(a.receipt.assetSymbol)} • ${t(q(a.receipt.createdAt))}</p>${a.receipt.explorerUrl?`<a class="inline-link" href="${t(a.receipt.explorerUrl)}" target="_blank" rel="noreferrer">Open explorer proof</a>`:""}</article>`:'<p class="empty">A receipt will appear here after successful verification or claim settlement.</p>'}
            `:""}
      </article>
    </section>
  `}function fe(){return`
    ${U()}
    <section class="trust-strip">
      ${g!=null&&g.validations.length?g.validations.map(te).join(""):'<p class="empty">Run validation to confirm docs, relayer, RPC, SDK, and agent SDK dependencies.</p>'}
    </section>
    <section class="feature-grid">
      <article class="panel story-panel">
        <span class="section-tag">Product positioning</span>
        <h2>A treasury workspace with a real operator dashboard and public payment surfaces.</h2>
        <p>The landing page introduces the platform, but the real operating surface lives in the dashboard after passkey onboarding. Shared links open public payment and payout claim pages backed by real records and Solana verification.</p>
      </article>
      <article class="panel metrics-panel">
        <span class="section-tag">Platform metrics</span>
        <div class="metrics-grid">
          <div class="metric-card"><span>Wallet profiles</span><strong>${l?1:0}</strong></div>
          <div class="metric-card"><span>Payment links</span><strong>${(l==null?void 0:l.paymentLinks.length)||0}</strong></div>
          <div class="metric-card"><span>Invoices</span><strong>${(l==null?void 0:l.invoices.length)||0}</strong></div>
          <div class="metric-card"><span>Receipts</span><strong>${(l==null?void 0:l.receipts.length)||0}</strong></div>
        </div>
      </article>
    </section>
    ${W()}
  `}function $(){const e=A();if(e.page==="public-pay"||e.page==="public-claim"){x.innerHTML=he(e),Y();return}x.innerHTML=e.page==="dashboard"?ge():fe(),Y()}function Y(){var e,a,n,i,s,o,d,m,y,f,k,v,r,E,B,V,J;(e=document.querySelector('[data-action="goto-dashboard"]'))==null||e.addEventListener("click",()=>{window.location.hash="#/dashboard"}),(a=document.querySelector('[data-action="goto-landing"]'))==null||a.addEventListener("click",()=>{window.location.hash=""}),(n=document.querySelector('[data-action="bootstrap"]'))==null||n.addEventListener("click",()=>{const p=document.querySelector("#bootstrap-form");if(p){z(new FormData(p));return}b="Treasury is already bootstrapped.",$()}),(i=document.querySelector('[data-action="refresh-state"]'))==null||i.addEventListener("click",()=>{H()}),(s=document.querySelector('[data-action="create-wallet"]'))==null||s.addEventListener("click",()=>{X("create")}),(o=document.querySelector('[data-action="reconnect-wallet"]'))==null||o.addEventListener("click",()=>{X("reconnect")}),(d=document.querySelector('[data-action="disconnect-wallet"]'))==null||d.addEventListener("click",()=>{de(),l=null,b="Local wallet session cleared.",window.location.hash="",$()}),(m=document.querySelector('[data-action="refresh-assets"]'))==null||m.addEventListener("click",()=>{I("Refreshing wallet assets","/refresh-assets",{})}),(y=document.querySelector('[data-action="wallet-airdrop"]'))==null||y.addEventListener("click",()=>{I("Requesting devnet SOL airdrop","/airdrop",{amount:1})}),(f=document.querySelector('[data-action="wallet-seed"]'))==null||f.addEventListener("click",()=>{I("Seeding operator wallet","/seed-stablecoin",{amount:250})}),(k=document.querySelector("#bootstrap-form"))==null||k.addEventListener("submit",p=>{p.preventDefault(),z(new FormData(p.currentTarget))}),(v=document.querySelector("#policy-form"))==null||v.addEventListener("submit",p=>{p.preventDefault();const u=new FormData(p.currentTarget);S("Saving treasury policy",async()=>{g=await h("/api/policy",{method:"POST",body:JSON.stringify({institutionName:u.get("institutionName"),maxTransactionAmount:Number(u.get("maxTransactionAmount")),dailySendLimit:Number(u.get("dailySendLimit")),escalationThreshold:Number(u.get("escalationThreshold")),travelRuleThreshold:Number(u.get("travelRuleThreshold")),allowedCorridors:String(u.get("allowedCorridors")||"").split(",").map(c=>c.trim().toUpperCase()).filter(Boolean),requireTravelRule:u.get("requireTravelRule")==="on"})}),b="Treasury policy updated."})}),(r=document.querySelector("#payment-link-form"))==null||r.addEventListener("submit",p=>{p.preventDefault();const u=p.currentTarget,c=new FormData(u);R("Creating payment link","/payment-links",{title:c.get("title"),description:c.get("description"),amount:Number(c.get("amount")),customerName:c.get("customerName"),customerEmail:c.get("customerEmail")},"Payment link created.")}),(E=document.querySelector("#claim-link-form"))==null||E.addEventListener("submit",p=>{p.preventDefault();const u=p.currentTarget,c=new FormData(u);R("Creating payout claim link","/claim-links",{title:c.get("title"),description:c.get("description"),amount:Number(c.get("amount")),customerName:c.get("customerName"),customerEmail:c.get("customerEmail")},"Claim link created.")}),(B=document.querySelector("#invoice-form"))==null||B.addEventListener("submit",p=>{p.preventDefault();const u=p.currentTarget,c=new FormData(u);R("Creating invoice","/invoices",{title:c.get("title"),description:c.get("description"),amount:Number(c.get("amount")),customerName:c.get("customerName"),customerEmail:c.get("customerEmail"),dueDate:c.get("dueDate")},"Invoice and linked payment request created.")}),(V=document.querySelector("#public-pay-form"))==null||V.addEventListener("submit",p=>{p.preventDefault();const u=A();if(u.page!=="public-pay")return;const c=new FormData(p.currentTarget);S("Verifying Solana payment",async()=>{T=await h(`/api/public/links/${u.slug}/pay`,{method:"POST",body:JSON.stringify({txSignature:c.get("txSignature")})}),b="Payment verified and receipt created."})}),(J=document.querySelector("#public-claim-form"))==null||J.addEventListener("submit",p=>{p.preventDefault();const u=A();if(u.page!=="public-claim")return;const c=new FormData(p.currentTarget);S("Claiming treasury payout",async()=>{T=await h(`/api/public/links/${u.slug}/claim`,{method:"POST",body:JSON.stringify({recipientAddress:c.get("recipientAddress")})}),b="Claim payout executed on Solana devnet."})})}async function X(e){if(!await ce()){b="This browser does not support passkeys/WebAuthn.",$();return}const n=document.querySelector("#wallet-form"),i=new FormData(n||void 0),s=String(i.get("username")||"treasury@stablehacks.io").trim(),o=String(i.get("displayName")||"StableHacks Treasury").trim();await S(e==="create"?"Creating passkey wallet":"Reconnecting passkey wallet",async()=>{var m;const d=e==="create"?await pe(s,o):await ue(s,o);l=await h("/api/workspace/connect",{method:"POST",body:JSON.stringify(d)}),j({profileId:l.profile.id,sessionId:(m=l.authSession)==null?void 0:m.id,username:s,displayName:o,walletAddress:l.profile.walletAddress}),b="Passkey wallet connected. Redirected to dashboard.",window.location.hash="#/dashboard"})}async function z(e){await S("Bootstrapping live Solana treasury",async()=>{g=await h("/api/bootstrap",{method:"POST",body:JSON.stringify({assetMode:e.get("assetMode"),externalMintAddress:e.get("externalMintAddress")||void 0,initialMintAmount:Number(e.get("initialMintAmount")||25e4)})}),l&&await se(),b="Treasury bootstrapped on live Solana devnet."})}async function I(e,a,n){const i=P();if(!(i!=null&&i.profileId)){b="Connect a passkey wallet first.",$();return}await S(e,async()=>{var s;l=await h(`/api/workspace/${i.profileId}${a}`,{method:"POST",body:JSON.stringify({sessionId:i.sessionId,...n})}),j({...i,sessionId:(s=l.authSession)==null?void 0:s.id,walletAddress:l.profile.walletAddress}),g=await h("/api/state"),b=a==="/airdrop"?"Devnet SOL airdrop completed.":a==="/seed-stablecoin"?"Wallet funded from treasury.":"Assets refreshed."})}async function R(e,a,n,i){const s=P();if(!(s!=null&&s.profileId)){b="Connect a passkey wallet first.",$();return}await S(e,async()=>{l=await h(`/api/workspace/${s.profileId}${a}`,{method:"POST",body:JSON.stringify({sessionId:s.sessionId,...n})}),b=i})}async function se(){var a;const e=P();e!=null&&e.profileId&&(l=await h(`/api/workspace/${e.profileId}?sessionId=${encodeURIComponent(e.sessionId||"")}`),j({...e,sessionId:(a=l.authSession)==null?void 0:a.id,walletAddress:l.profile.walletAddress}))}async function S(e,a){L=e,$();try{await a()}catch(n){b=n instanceof Error?n.message:"Unexpected error."}finally{L="",$()}}async function H(){const e=A();try{if(e.page==="public-pay"||e.page==="public-claim"){T=await h(`/api/public/links/${e.slug}`),$();return}g=await h("/api/state"),await se()}catch(a){b=a instanceof Error?a.message:"Failed to load application state."}finally{$()}}window.addEventListener("hashchange",()=>{H()});H();
