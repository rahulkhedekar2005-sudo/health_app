// Central app logic for mapping, profile, overview, and articles
let map = null;
let path = null;
let watchId = null;
let lastPos = null;
let totalDistance = 0;
let time = 0;
let timer = null;
let currentPath = [];
let currentOverviewFilter = 'month';

// Initialize map only when #map exists (prevents errors on other pages)
if (document.getElementById('map')) {
  map = L.map('map').setView([0,0], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  path = L.polyline([], { color: 'blue' }).addTo(map);
}

// Utility
function safeSetText(id, val){ let el = document.getElementById(id); if(el) el.innerText = val; }
function formatTime(s){ let mm = Math.floor(s/60); let ss = s%60; return String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0'); }

// Tracking
function updateControls(){ let startBtn=document.querySelector('.start'); let pauseBtn=document.querySelector('.pause'); let stopBtn=document.querySelector('.stop'); if(watchId){ if(startBtn) startBtn.classList.add('hidden'); if(pauseBtn) pauseBtn.classList.remove('hidden'); if(stopBtn) stopBtn.classList.remove('hidden'); } else { if(startBtn) startBtn.classList.remove('hidden'); if(pauseBtn) pauseBtn.classList.add('hidden'); if(stopBtn) stopBtn.classList.add('hidden'); } }

function startTracking() {
  if (watchId) return;
  if (!navigator.geolocation) { alert('Geolocation not supported'); return; }

  watchId = navigator.geolocation.watchPosition(pos => {
    let lat = pos.coords.latitude;
    let lng = pos.coords.longitude;
    let current = L.latLng(lat, lng);

    if (map) map.setView(current);
    if (path) path.addLatLng(current);
    currentPath.push([lat, lng]);

    if (lastPos && typeof lastPos.distanceTo === 'function') {
      totalDistance += lastPos.distanceTo(current);
      safeSetText('distance', (totalDistance>=1000? (totalDistance/1000).toFixed(2)+' km' : totalDistance.toFixed(1)+' m'));
    }

    lastPos = current;
  }, err => {
    console.warn('Geolocation error:', err);
    alert('Unable to access location: ' + (err.message || err.code));
  }, { enableHighAccuracy: true });

  updateControls();
  timer = setInterval(() => { time++; safeSetText('time', formatTime(time)); }, 1000);
  safeSetText('time', formatTime(time));
}

function pauseTracking() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (timer) clearInterval(timer);
  timer = null;
  updateControls();
}

function stopTracking() {
  pauseTracking();
  if (currentPath.length > 0) saveHistory();

  lastPos = null;
  totalDistance = 0;
  time = 0;
  currentPath = [];
  if (path && typeof path.setLatLngs === 'function') path.setLatLngs([]);
  safeSetText('time', formatTime(0));
  safeSetText('distance', '0 m');
  updateControls();
  let h=document.getElementById('mappingHistory'); if(h) setTimeout(()=>{ h.scrollIntoView({behavior:'smooth'}); },200);
}

// History storage
function getHistory(){ return JSON.parse(localStorage.getItem('tracks')) || []; }
function saveHistory(){
  let history = getHistory();
  history.unshift({ date: new Date().toLocaleString(), ts: Date.now(), distance: totalDistance.toFixed(1), time: formatTime(time), path: currentPath.slice() });
  localStorage.setItem('tracks', JSON.stringify(history));
  renderMappingHistory();
  renderOverviewHistory(currentOverviewFilter || 'month');
}

// Rendering mapping history with actions
function renderMappingHistory(){
  let history = getHistory();
  let list = document.getElementById('historyList'); if(!list) return;
  list.innerHTML = '';

  history.forEach((track, idx)=>{
    let li = document.createElement('li');
    li.style.display='flex'; li.style.justifyContent='space-between'; li.style.alignItems='center';
    li.style.padding='10px'; li.style.borderRadius='8px'; li.style.marginBottom='8px'; li.style.background='white';
    let dist = Number(track.distance);
    let distText = dist>=1000 ? (dist/1000).toFixed(2)+ ' km' : dist.toFixed(1) + ' m';
    li.innerHTML = `
      <div>
        <b>${track.date}</b><br>
        ⏱ ${track.time} | 📏 ${distText}
      </div>
      <div style="display:flex; gap:6px">
        <button onclick="shareTrack(${idx})" style="padding:6px 8px;border-radius:8px;border:none;background:#1976d2;color:#fff">Share</button>
        <button onclick="copyTrack(${idx})" style="padding:6px 8px;border-radius:8px;border:none;background:#4caf50;color:#fff">Copy</button>
        <button onclick="deleteTrack(${idx})" style="padding:6px 8px;border-radius:8px;border:none;background:#f44336;color:#fff">Delete</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function clearAllHistory(){ if(!confirm('Clear ALL history? This cannot be undone.')) return; localStorage.removeItem('tracks'); renderMappingHistory(); renderOverviewHistory(currentOverviewFilter); }
function clearRecentHistory(){ let h = getHistory(); if(h.length===0){ alert('No history to clear'); return; } if(!confirm('Clear the most recent entry?')) return; h.shift(); localStorage.setItem('tracks', JSON.stringify(h)); renderMappingHistory(); renderOverviewHistory(currentOverviewFilter); }
function deleteTrack(idx){ let h = getHistory(); h.splice(idx,1); localStorage.setItem('tracks', JSON.stringify(h)); renderMappingHistory(); renderOverviewHistory(currentOverviewFilter); }

function copyTrack(idx){ let h = getHistory(); if(!h[idx]){ alert('Nothing to copy'); return; } copyToClipboard(buildShareText(h[idx])); alert('Copied'); }
function copyLatest(){ let h=getHistory(); if(h.length===0){ alert('No history'); return; } copyToClipboard(buildShareText(h[0])); alert('Copied last route'); }

function buildShareText(track){ let coords = (track.path && track.path.length)? track.path.map(p=>p.join(',')).slice(0,20).join(';') : 'No coordinates'; return `Route on ${track.date} - ${track.distance} m, ${track.time}s. Coordinates: ${coords}`; }

function shareTrack(idx){ let h=getHistory(); let track=h[idx]; if(!track){ alert('No track to share'); return; } let text = buildShareText(track); if(navigator.share){ navigator.share({ title: 'My Route', text }).catch(()=>{ window.open('https://wa.me/?text='+encodeURIComponent(text)); }); } else { window.open('https://wa.me/?text='+encodeURIComponent(text), '_blank'); } }

function copyToClipboard(text){ if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text); let ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); return Promise.resolve(); }

// Articles
function getArticleSuggestions(){ return ['10 Tips for Better Sleep','How Walking Improves Heart Health','Daily Habits for a Healthy Life','Best Foods for Heart Health','Simple Home Workouts','Mindfulness for Better Sleep','Stretching for Beginners','Improve Walking Endurance']; }
function renderHomeArticles(choices){ let list=document.getElementById('articlesList'); if(!list) return; list.innerHTML=''; choices.forEach(topic=>{ let a=document.createElement('div'); a.className='article'; a.innerHTML = `<a href="https://www.google.com/search?q=${encodeURIComponent(topic)}" target="_blank">${topic} <small style="color:#777; float:right">Open</small></a>`; list.appendChild(a); }); }
function refreshArticles(){ let topics = getArticleSuggestions(); for(let i = topics.length-1;i>0;i--){ let j = Math.floor(Math.random()*(i+1)); [topics[i],topics[j]]=[topics[j],topics[i]]; } renderHomeArticles(topics.slice(0,3)); }

// Profile and goals
function loadProfile(){ let name = localStorage.getItem('userName') || 'Your Account'; document.getElementById('profileName') && (document.getElementById('profileName').innerText = name); let desc = localStorage.getItem('userDesc') || 'Stay fit. Stay healthy.'; document.getElementById('profileDesc') && (document.getElementById('profileDesc').innerText = desc); ['goalSteps','goalSleep','goalCal'].forEach(id=>{ let v=localStorage.getItem(id); if(v){ let el=document.getElementById(id); if(el) el.querySelector('.goal-text').innerText=v; } }); }
function toggleEditProfile(){ let nameEl=document.getElementById('profileName'); if(!nameEl) return; if(nameEl.contentEditable=='true'){ nameEl.contentEditable='false'; localStorage.setItem('userName', nameEl.innerText.trim()); alert('Profile saved'); } else { nameEl.contentEditable='true'; nameEl.focus(); document.execCommand('selectAll',false,null); } }
function editGoal(id){ let el=document.getElementById(id); if(!el) return; let span=el.querySelector('.goal-text'); if(!span) return; if(span.contentEditable=='true'){ span.contentEditable='false'; localStorage.setItem(id, span.innerText.trim()); alert('Goal saved'); } else { span.contentEditable='true'; span.focus(); document.execCommand('selectAll',false,null); } }
function openSettings(){ alert('Settings placeholder — add your settings page'); }
function logout(){ if(confirm('Log out?')){ localStorage.removeItem('tracks'); window.location.href='login.html'; } }

// Overview history grouping
function renderOverviewHistory(filter){ let history = getHistory(); let container = document.getElementById('overviewHistoryContent'); if(!container) return; let now = Date.now(); let filtered = history.filter(track=>{ if(filter==='day') return (now - track.ts)<=24*3600*1000; if(filter==='week') return (now - track.ts)<=7*24*3600*1000; if(filter==='month') return (now - track.ts)<=30*24*3600*1000; return true; }); let groups={}; filtered.forEach(track=>{ let d=new Date(track.ts); let key=d.toLocaleString(undefined,{year:'numeric', month:'long'}); groups[key]=groups[key]||[]; groups[key].push(track); }); container.innerHTML=''; if(filtered.length===0){ container.innerHTML='<div>No history found for this period.</div>'; return; } Object.keys(groups).sort((a,b)=>{ let ad=new Date(groups[a][0].ts); let bd=new Date(groups[b][0].ts); return bd-ad; }).forEach(groupKey=>{ let div=document.createElement('div'); div.innerHTML=`<h4 style="margin:10px 0">${groupKey}</h4>`; groups[groupKey].forEach(track=>{ let item=document.createElement('div'); item.style.background='white'; item.style.padding='10px'; item.style.marginBottom='8px'; item.style.borderRadius='8px'; item.innerHTML=`<b>${track.date}</b><br>⏱ ${track.time}s | 📏 ${track.distance} m`; div.appendChild(item); }); container.appendChild(div); }); }
function setOverviewFilter(f){ currentOverviewFilter=f; ['filterDay','filterWeek','filterMonth'].forEach(id=>{ let el=document.getElementById(id); if(el) el.classList.remove('active'); }); if(f==='day') document.getElementById('filterDay') && document.getElementById('filterDay').classList.add('active'); if(f==='week') document.getElementById('filterWeek') && document.getElementById('filterWeek').classList.add('active'); if(f==='month') document.getElementById('filterMonth') && document.getElementById('filterMonth').classList.add('active'); renderOverviewHistory(f); }
function showHistory(metric){ setOverviewFilter('month'); let el=document.getElementById('overviewHistory'); if(el) el.scrollIntoView({behavior:'smooth'}); }

// Init
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', ()=>{ renderMappingHistory(); renderOverviewHistory(currentOverviewFilter); loadProfile(); if(document.getElementById('articlesList')) refreshArticles(); updateControls(); }); } else { renderMappingHistory(); renderOverviewHistory(currentOverviewFilter); loadProfile(); if(document.getElementById('articlesList')) refreshArticles(); updateControls(); }