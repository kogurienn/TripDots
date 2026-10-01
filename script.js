'use strict';
// Storage boundary: replace load/save with API calls when moving to a database.
const STORAGE_KEY = 'tripdots.posts.v1';
const seedTrips = [
  {id:'seed-jeju',title:'Jeju Island',country:'South Korea',category:'自然',season:'Summer',days:'2泊3日',memo:'海とごはんが最高だった',image:'images/jeju.jpeg',lat:33.4996,lng:126.5312},
  {id:'seed-hokkaido',title:'Hokkaido',country:'Japan',category:'自然',season:'Summer',days:'2泊3日',memo:'積丹の海とウニを満喫',image:'images/syakotan.jpg',lat:43.33,lng:140.35},
  {id:'seed-new-york',title:'New York',country:'USA',category:'街歩き',season:'Spring',days:'3泊4日',memo:'街歩きとグルメが楽しかった',image:'images/NY.jpg',lat:40.7128,lng:-74.006}
];
const form = document.querySelector('#trip-form');
const status = document.querySelector('#form-status');
const searchBox = document.querySelector('#search-box');
const dialog = document.querySelector('#trip-detail');
let selectedCountry = 'all', selectedCategory = 'all', detailId = null;
let storageHealthy = true;
const normalize = value => value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
// Same destination, country, category, season, duration and memoir = same post.
const fingerprint = trip => ['title','country','category','season','days','memo'].map(key => normalize(trip[key])).join('\u001f');
function validTrip(trip) {
  return trip && typeof trip.id === 'string' && trip.id.startsWith('post-') &&
    ['title','country','category','season','days','memo'].every(key => typeof trip[key] === 'string' && trip[key].trim()) &&
    typeof trip.image === 'string' && Number.isFinite(trip.lat) && Number.isFinite(trip.lng) &&
    Math.abs(trip.lat) <= 90 && Math.abs(trip.lng) <= 180;
}
function showStatus(message, error = false) { status.textContent = message; status.classList.toggle('error', error); }
function loadPosts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(validTrip)) throw new Error('Invalid storage');
    const seen = new Set(seedTrips.map(fingerprint)), ids = new Set();
    return parsed.filter(trip => { const key = fingerprint(trip); if (seen.has(key) || ids.has(trip.id)) return false; seen.add(key); ids.add(trip.id); return true; });
  } catch (_) {
    storageHealthy = false;
    showStatus('保存データを読み込めません。ブラウザーの保存設定・データを確認してください。既存データは上書きしていません。', true);
    return [];
  }
}
let posts = loadPosts();
const allTrips = () => [...seedTrips, ...posts];
function savePosts(next) {
  if (!storageHealthy) { showStatus('保存データを読み込めないため、投稿・削除はできません。', true); return false; }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); posts = next; return true; }
  catch (_) { showStatus('保存できませんでした。保存容量やブラウザーの設定を確認してください。入力内容は残っています。', true); return false; }
}
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function imageFor(trip, className) {
  const img = element('img', className); img.alt = trip.title; img.loading = 'lazy';
  // Only allow HTTPS user images. All text is inserted as textContent, never HTML.
  let source = trip.image;
  if (!seedTrips.some(item => item.id === trip.id)) { try { if (new URL(source).protocol !== 'https:') source = ''; } catch (_) { source = ''; } }
  const placeholder = () => element('div',className + ' image-placeholder','TripDots · 写真のない旅');
  if (!source) return placeholder();
  img.src = source;
  img.addEventListener('error', () => img.replaceWith(placeholder()), {once:true});
  return img;
}
function renderFilters() {
  const trips = allTrips();
  for (const [key, container, selected] of [['country','#country-filters',selectedCountry],['category','#category-filters',selectedCategory]]) {
    const values = [...new Set(trips.map(trip => trip[key]))];
    if (selected !== 'all' && !values.includes(selected)) { if (key === 'country') selectedCountry = 'all'; else selectedCategory = 'all'; }
    const active = key === 'country' ? selectedCountry : selectedCategory;
    const root = document.querySelector(container); root.replaceChildren();
    for (const value of ['all',...values]) {
      const button = element('button','',value === 'all' ? 'すべて' : value); button.type = 'button'; button.dataset[key] = value; button.setAttribute('aria-pressed',String(active === value));
      button.addEventListener('click', () => { if (key === 'country') selectedCountry = value; else selectedCategory = value; render(); document.querySelector(container).querySelectorAll('button').forEach(item => { if(item.dataset[key] === value) item.focus(); }); }); root.append(button);
    }
  }
  document.querySelector('#countries').replaceChildren(...[...new Set(trips.map(trip => trip.country))].map(country => { const option = element('option'); option.value = country; return option; }));
}
let map = null, markers = null, draftMarker = null, visibleTrips = [];
function initMap() {
  if (!window.L) { document.querySelector('#map-status').textContent = '地図を読み込めませんでした。緯度・経度はフォームから入力できます。'; return; }
  map = L.map('map',{scrollWheelZoom:false}).setView([32,120],3);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  tiles.on('tileerror', () => { document.querySelector('#map-status').textContent = '背景地図の取得に失敗しました。接続を確認してください。'; });
  markers = L.layerGroup().addTo(map);
  const resizeObserver = new ResizeObserver(() => {
    map.invalidateSize();
    fitVisibleTrips();
  });
  resizeObserver.observe(document.querySelector('#map'));
  map.on('click', event => {
    form.elements.lat.value = event.latlng.lat.toFixed(6); form.elements.lng.value = event.latlng.lng.toFixed(6);
    if (draftMarker) map.removeLayer(draftMarker);
    draftMarker = L.circleMarker(event.latlng,{radius:8,color:'#df9b30',fillOpacity:.8}).addTo(map);
    document.querySelector('#map-status').textContent = '投稿する位置を選びました。フォームに緯度・経度を入力しました。';
  });
}
function fitVisibleTrips() {
  if (map && visibleTrips.length) map.fitBounds(L.latLngBounds(visibleTrips.map(trip => [trip.lat,trip.lng])),{padding:[30,30],maxZoom:10});
}
function render() {
  renderFilters();
  const query = normalize(searchBox.value);
  const visible = allTrips().filter(trip => (selectedCountry === 'all' || trip.country === selectedCountry) && (selectedCategory === 'all' || trip.category === selectedCategory) && normalize([trip.title,trip.country,trip.category,trip.memo,trip.season,trip.days].join(' ')).includes(query));
  visibleTrips = visible;
  const list = document.querySelector('#trip-list'); list.replaceChildren();
  for (const trip of visible) {
    const card = element('article','trip-card'); card.dataset.country = trip.country;
    card.append(imageFor(trip,'card-image'));
    const body = element('div','card-body'); body.append(element('p','card-country',trip.country),element('h2','',trip.title),element('p','card-memo',trip.memo));
    const bottom = element('div','card-bottom'); bottom.append(element('span','tag',trip.category));
    const button = element('button','detail-button','詳しく見る ↗'); button.type = 'button'; button.dataset.trip = trip.id; button.addEventListener('click', () => openDetail(trip.id)); bottom.append(button); body.append(bottom); card.append(body); list.append(card);
  }
  document.querySelector('#result-count').textContent = `${visible.length} 件の旅`;
  document.querySelector('#empty-state').hidden = visible.length !== 0;
  if (markers) {
    markers.clearLayers();
    for (const trip of visible) { const marker = L.marker([trip.lat,trip.lng],{title:trip.title}).addTo(markers); marker.bindPopup(element('strong','',trip.title)); marker.on('click', () => openDetail(trip.id)); }
    fitVisibleTrips();
  }
}
function openDetail(id) {
  const trip = allTrips().find(item => item.id === id); if (!trip) return;
  detailId = id;
  const content = document.querySelector('#detail-content'); content.replaceChildren(imageFor(trip,'detail-image'));
  const body = element('div','detail-body'), title = element('h2','',trip.title); title.id = 'detail-title';
  body.append(element('p','card-country',trip.country),title,element('p','detail-meta',`${trip.category} · ${trip.season} · ${trip.days}`),element('p','',trip.memo));
  if (posts.some(item => item.id === id)) {
    const remove = element('button','delete-button','この旅行を削除'); remove.type = 'button';
    remove.addEventListener('click', () => { if (!window.confirm(`「${trip.title}」を削除しますか？`)) return; if (savePosts(posts.filter(item => item.id !== id))) { dialog.close(); render(); showStatus('旅行を削除しました。'); } else { const message = element('p','',status.textContent); message.setAttribute('role','alert'); body.append(message); } }); body.append(remove);
  }
  content.append(body); if (!dialog.open) dialog.showModal();
}
document.querySelector('#close-detail').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
searchBox.addEventListener('input',render);
form.addEventListener('submit', event => {
  event.preventDefault(); if (!form.reportValidity()) return;
  const data = new FormData(form), trip = {id:`post-${crypto.randomUUID()}`};
  for (const key of ['title','country','category','season','days','memo','image']) trip[key] = String(data.get(key)).trim();
  trip.lat = Number(data.get('lat')); trip.lng = Number(data.get('lng'));
  if (!validTrip(trip)) { showStatus('行き先・国・日数・思い出と、有効な緯度・経度を入力してください。',true); return; }
  if (trip.image) { try { if(new URL(trip.image).protocol !== 'https:') throw new Error(); } catch (_) { showStatus('画像URLは https:// から始まるURLを入力してください。',true); return; } }
  // Use the existing spelling of a country to avoid duplicate filter chips.
  const country = allTrips().find(item => normalize(item.country) === normalize(trip.country)); if (country) trip.country = country.country;
  if (allTrips().some(item => fingerprint(item) === fingerprint(trip))) { showStatus('同じ内容の旅行はすでに登録されています。',true); return; }
  if (!savePosts([...posts,trip])) return;
  form.reset(); searchBox.value = ''; selectedCountry = 'all'; selectedCategory = 'all';
  if (draftMarker) { map.removeLayer(draftMarker); draftMarker = null; }
  render(); showStatus('旅を保存しました。再読み込みしても、このブラウザーに残ります。');
  document.querySelector('#map-status').textContent = '投稿時は地図をクリックして位置を選べます。';
});
// Keep multiple tabs in sync and prevent overwriting a newer post list.
window.addEventListener('storage',event => { if (event.key === STORAGE_KEY || event.key === null) { storageHealthy = true; posts = loadPosts(); if (dialog.open) { if(allTrips().some(trip => trip.id === detailId)) openDetail(detailId); else dialog.close(); } render(); } });
initMap(); render();
