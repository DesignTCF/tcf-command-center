const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

// Bookmarklet stored cleanly — no template literal conflicts
const BOOKMARKLET_CODE = [
  '(function(){',
  'var D="http://localhost:3001";',
  'var c=[];',
  'var raw=document.body.innerText.slice(0,30000);',
  'var sels=[".msg-list-item",".contact-item",".conversation-item","[class*=\\"contactItem\\"]","[class*=\\"msgItem\\"]","[class*=\\"talkItem\\"]",".talk-item",".im-contact-item","[class*=\\"ConversationItem\\"]"];',
  'var items=[];',
  'for(var i=0;i<sels.length;i++){var f=document.querySelectorAll(sels[i]);if(f.length>0){items=Array.from(f);break;}}',
  'items.forEach(function(el){',
  '  var n=el.querySelector("[class*=\\"name\\"],[class*=\\"company\\"],[class*=\\"title\\"]");',
  '  var m=el.querySelector("[class*=\\"msg\\"],[class*=\\"content\\"],[class*=\\"preview\\"]");',
  '  var t=el.querySelector("[class*=\\"time\\"],[class*=\\"date\\"]");',
  '  var u=el.querySelector("[class*=\\"unread\\"],[class*=\\"badge\\"]");',
  '  var nm=n?n.innerText.trim():"";',
  '  if(nm){c.push({supplierName:nm,lastMessage:m?m.innerText.trim().slice(0,500):"",lastMessageTime:t?t.innerText.trim():"",hasUnread:!!u&&u.innerText.trim()!=="0",needsReply:!!u&&u.innerText.trim()!=="0",sourceUrl:window.location.href});}',
  '});',
  'var ov=document.createElement("div");',
  'ov.style.cssText="position:fixed;top:20px;right:20px;z-index:99999;background:#0D9E9E;color:white;padding:16px 20px;border-radius:10px;font-family:sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);";',
  'ov.innerHTML="Syncing to TCF Dashboard...";',
  'document.body.appendChild(ov);',
  'fetch(D+"/api/alibaba-sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({conversations:c,rawText:raw,url:window.location.href,timestamp:new Date().toISOString()})}).then(function(r){return r.json();}).then(function(d){ov.style.background="#157A50";ov.innerHTML="Synced "+d.count+" conversations";setTimeout(function(){ov.remove();},3000);}).catch(function(){ov.style.background="#B52B2B";ov.innerHTML="Dashboard not running";setTimeout(function(){ov.remove();},3000);});',
  '})();'
].join('')

const BOOKMARKLET = 'javascript:' + BOOKMARKLET_CODE

router.get('/', (req, res) => {
  let syncData = { conversations: [], lastSync: null }
  try { syncData = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/alibaba-sync.json'), 'utf8')) } catch {}

  const count = (syncData.conversations || []).length
  const needReply = (syncData.conversations || []).filter(c => c.needsReply || c.hasUnread).length
  const lastSync = syncData.lastSync ? new Date(syncData.lastSync).toLocaleDateString() : 'Never'

  // Encode bookmarklet for safe HTML attribute embedding
  const bmEncoded = BOOKMARKLET.replace(/&/g, '&amp;').replace(/"/g, '&quot;')

  res.send('<!DOCTYPE html><html><head><title>Alibaba Sync</title><style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:-apple-system,sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}'
    + '.card{background:white;border-radius:16px;padding:2.5rem;max-width:540px;width:100%;box-shadow:0 4px 32px rgba(0,0,0,.08)}'
    + 'h1{font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:8px}'
    + '.sub{font-size:13px;color:#58595b;margin-bottom:2rem;line-height:1.6}'
    + '.step{display:flex;gap:14px;margin-bottom:1.5rem}'
    + '.num{width:28px;height:28px;border-radius:50%;background:#0D9E9E;color:white;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}'
    + '.step h3{font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:3px}'
    + '.step p{font-size:12px;color:#58595b;line-height:1.5}'
    + '.drag-area{background:#FFF8F0;border:2px dashed #FF6A00;border-radius:12px;padding:2rem;text-align:center;margin:1.5rem 0}'
    + '.bm-btn{display:inline-block;background:#FF6A00;color:white;padding:13px 28px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;cursor:grab;user-select:none}'
    + '.drag-hint{font-size:11px;color:#A86200;font-weight:600;margin-top:12px;text-transform:uppercase;letter-spacing:.06em}'
    + '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:2rem;padding-top:1.5rem;border-top:1px solid #E0E0E0;text-align:center}'
    + '.sv{font-size:26px;font-weight:300;color:#1a1a1a}'
    + '.sv.alert{color:#A86200;font-weight:600}'
    + '.sl{font-size:10px;color:#58595b;text-transform:uppercase;letter-spacing:.06em;margin-top:2px}'
    + '.back{display:block;text-align:center;margin-top:1.5rem;font-size:13px;color:#0D9E9E;text-decoration:none}'
    + '.tip{background:#F0FAFA;border-left:3px solid #0D9E9E;padding:10px 14px;border-radius:4px;margin-top:1rem;font-size:12px;color:#58595b;line-height:1.5}'
    + '</style></head><body><div class="card">'
    + '<h1>&#128230; Alibaba Message Sync</h1>'
    + '<p class="sub">Drag the button to your bookmarks bar. Click it once when you are on Alibaba and all your supplier conversations sync to the dashboard instantly.</p>'
    + '<div class="step"><div class="num">1</div><div><h3>Drag this to your bookmarks bar</h3><p>Grab the orange button and drag it up to the bookmarks bar at the top of Chrome. One time only.</p></div></div>'
    + '<div class="drag-area">'
    + '<a class="bm-btn" href="' + bmEncoded + '">&#128230;&nbsp; Sync Alibaba &rarr; TCF Dashboard</a>'
    + '<div class="drag-hint">&#8593; Drag this up to your Chrome bookmarks bar</div>'
    + '</div>'
    + '<div class="step"><div class="num">2</div><div><h3>Go to Alibaba and click it</h3><p>Open <strong>message.alibaba.com</strong>, sign in, go to your messages, then click the bookmark. A green banner confirms the sync.</p></div></div>'
    + '<div class="step"><div class="num">3</div><div><h3>Ask your dashboard anything</h3><p>Come back and ask: <em>&ldquo;Which suppliers need a reply?&rdquo;</em> or <em>&ldquo;What did Chunbai say last?&rdquo;</em></p></div></div>'
    + '<div class="tip">&#128161; <strong>Tip:</strong> Click the bookmark any time you want to refresh &mdash; before a supplier check-in or weekly review.</div>'
    + '<div class="stats">'
    + '<div><div class="sv">' + count + '</div><div class="sl">Synced</div></div>'
    + '<div><div class="sv' + (needReply > 0 ? ' alert' : '') + '">' + needReply + '</div><div class="sl">Need Reply</div></div>'
    + '<div><div class="sv" style="font-size:13px;padding-top:8px;">' + lastSync + '</div><div class="sl">Last Sync</div></div>'
    + '</div>'
    + '<a class="back" href="/">&#8592; Back to dashboard</a>'
    + '</div></body></html>')
})

module.exports = router
