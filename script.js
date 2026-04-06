import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDKbxqZBW6NovbiJAFJGyZIQZfYIxGvbN8",
    authDomain: "byhs1-4.firebaseapp.com",
    projectId: "byhs1-4",
    storageBucket: "byhs1-4.firebasestorage.app",
    messagingSenderId: "734684323543",
    appId: "1:734684323543:web:fb7bd8c10e6cfcacabda92"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();
const ADMIN_EMAIL = "kr.craft1016@gmail.com"; 
const dataDoc = doc(db, "classData", "main");

let mealStore = { 1: "정보 없음", 2: "정보 없음", 3: "정보 없음" };

// [유틸리티]
const linkify = (t) => t ? t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-500 font-bold underline">$1</a>') : "";

// [탭 전환 시스템]
const switchTab = (tab) => {
    ['exam', 'pl', 'meal', 'board'].forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).className = 'flex-1 py-4 font-bold text-gray-400 transition-all text-[13px]';
    });
    document.getElementById(`content-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).className = 'flex-1 py-4 font-bold tab-active transition-all text-[13px]';
    if(tab === 'meal') getMeal();
};

document.getElementById('tab-exam').onclick = () => switchTab('exam');
document.getElementById('tab-pl').onclick = () => switchTab('pl');
document.getElementById('tab-meal').onclick = () => switchTab('meal');
document.getElementById('tab-board').onclick = () => switchTab('board');

// [급식 로직: 시간별 자동 전환]
async function getMeal() {
    const container = document.getElementById('meal-display-container');
    try {
        const now = new Date();
        const today = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const key = "3366de199e3b43ccb46803dcdceb0a92";
        const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${key}&Type=json&ATPT_OFCDC_SC_CODE=N10&SD_SCHUL_CODE=8140052&MLSV_YMD=${today}`;

        const resArr = await Promise.all([1,2,3].map(c => fetch(`${url}&MMEAL_SC_CODE=${c}`).then(r => r.json())));
        resArr.forEach((d, i) => {
            mealStore[i+1] = d.mealServiceDietInfo ? d.mealServiceDietInfo[1].row[0].DDISH_NM.replace(/[0-9.]/g, "").replace(/\(\)/g, "").replace(/<br\/>/g, ", ") : "오늘 식단 정보가 없습니다. 🍱";
        });

        // 시간별 자동 선택 (8:30 전 조식, 13:30 전 중식, 이후 석식)
        const hourMin = now.getHours() * 100 + now.getMinutes();
        let defaultMeal = hourMin < 830 ? 1 : (hourMin < 1330 ? 2 : 3);
        showMeal(defaultMeal);
        document.getElementById('meal-update-time').innerText = `LAST UPDATED: ${now.toLocaleDateString()}`;
    } catch (e) { container.innerHTML = "<p class='text-red-400 font-bold'>서버 연결 실패</p>"; }
}

function showMeal(type) {
    const container = document.getElementById('meal-display-container');
    const cfg = { 1: ['orange', '아침 식단'], 2: ['emerald', '점심 식단'], 3: ['indigo', '저녁 식단'] }[type];
    [1,2,3].forEach(t => {
        const btn = document.getElementById(`btn-meal-${t}`);
        btn.className = t === type ? `px-5 py-2.5 rounded-xl bg-white shadow-md text-${cfg[0]}-600 font-black transform scale-105 transition-all` : `px-5 py-2.5 rounded-xl text-gray-400 font-bold hover:text-gray-600 transition-all`;
    });
    container.style.opacity = 0;
    setTimeout(() => {
        container.innerHTML = `<div class="w-full bg-${cfg[0]}-50/50 p-8 rounded-[2.5rem] border border-${cfg[0]}-100 text-center"><p class="text-[10px] text-${cfg[0]}-400 font-black mb-3 uppercase tracking-widest">${cfg[1]}</p><p class="text-${cfg[0]}-900 font-extrabold text-lg leading-relaxed break-keep">${mealStore[type]}</p></div>`;
        container.style.opacity = 1;
    }, 150);
}
[1,2,3].forEach(t => document.getElementById(`btn-meal-${t}`).onclick = () => showMeal(t));

// [데이터 수신 및 렌더링]
onSnapshot(dataDoc, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    
    // 시험 D-Day
    const diff = new Date(data.examDate) - new Date();
    document.getElementById('exam-dday').innerText = diff > 0 ? `D-${Math.ceil(diff/(1000*60*60*24))}` : "종료";
    document.getElementById('notice-content').innerHTML = linkify(data.notice);

    // 부리미어 리그 전용 탭 렌더링
    const plRaw = data.plSchedule || "";
    const plEl = document.getElementById('pl-main-content');
    const plMatch = plRaw.match(/(\d{1,2})[./](\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if(plMatch) {
        const gameDate = new Date(new Date().getFullYear(), parseInt(plMatch[1])-1, parseInt(plMatch[2]), parseInt(plMatch[3]), parseInt(plMatch[4]));
        const tDiff = gameDate - new Date();
        if(tDiff > 0) {
            const h = Math.floor(tDiff/(1000*60*60));
            plEl.innerHTML = `<div><span class="bg-cyan-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black animate-pulse">NEXT MATCH</span><h3 class="text-5xl font-black mt-6 mb-4 text-white">${h > 24 ? 'D-'+Math.floor(h/24) : h+'h 전'}</h3><p class="text-slate-400 font-medium">${linkify(plRaw)}</p></div>`;
        } else {
            plEl.innerHTML = `<div class="w-full bg-slate-800/50 p-6 rounded-3xl border border-slate-700 text-left"><p class="text-cyan-400 font-bold text-xs mb-2 italic">MATCH INFO</p><p class="text-xl font-bold">${linkify(plRaw)}</p></div>`;
        }
    } else { plEl.innerHTML = `<p class="text-slate-500">${linkify(plRaw || "경기 일정이 없습니다.")}</p>`; }

    // 수행평가 & 시험범위
    const list = document.getElementById('assessment-list'); list.innerHTML = "";
    const rows = (data.rawAssessments || "").split('\n').filter(r => r.includes('|'));
    if(rows.length > 0) {
        const [s, c, d] = rows[0].split('|');
        const target = new Date(new Date().getFullYear(), parseInt(d.split('.')[0])-1, parseInt(d.split('.')[1]));
        document.getElementById('nearest-assessment').innerHTML = `<p class="text-red-600 font-black text-2xl">D-${Math.ceil((target-new Date())/(1000*60*60*24))}</p><p class="text-gray-700 text-[10px] font-bold mt-1">${s}</p>`;
        rows.forEach(r => { const [subj, cont, date] = r.split('|'); list.innerHTML += `<tr><td class="p-4 font-black text-indigo-600">${subj}</td><td class="p-4 text-gray-600">${linkify(cont)}</td><td class="p-4 text-right font-bold text-slate-400">${date}</td></tr>`; });
    }
    const rCont = document.getElementById('range-cards'); rCont.innerHTML = "";
    (data.rawRanges || "").split('\n').forEach(l => { if(l.includes(':')) { const [t, d] = l.split(':'); rCont.innerHTML += `<div class="bg-white p-6 rounded-2xl border border-indigo-50 transition-all hover:shadow-md"><h3 class="font-bold text-indigo-700 text-lg mb-2 underline decoration-indigo-200 decoration-4 underline-offset-4">${t}</h3><p class="text-slate-600 text-sm leading-relaxed">${linkify(d)}</p></div>`; }});

    // 어드민 동기화
    ['input-date', 'input-assessments', 'input-ranges', 'input-notice', 'input-pl'].forEach(id => {
        const key = id.replace('input-', id === 'input-date' ? 'exam' : (id === 'input-pl' ? 'plSchedule' : (id === 'input-assessments' ? 'rawAssessments' : (id === 'input-ranges' ? 'rawRanges' : 'notice'))));
        document.getElementById(id).value = data[key] || "";
    });
});

// [게시판 & 인증]
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(30));
onSnapshot(q, (snap) => {
    const list = document.getElementById('post-list'); list.innerHTML = "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const postEl = document.createElement('div');
        postEl.className = "card !p-5 bg-white shadow-sm border border-gray-50";
        let delBtn = auth.currentUser?.email === ADMIN_EMAIL ? `<button class="text-red-400 text-[10px] ml-2" onclick="window.deletePost('${docSnap.id}')">삭제</button>` : "";
        postEl.innerHTML = `<div class="flex justify-between text-[11px] mb-2 text-gray-400"><div><span class="font-black text-indigo-500 mr-2">${p.user}</span>${delBtn}</div><span>${p.createdAt?.toDate().toLocaleString().slice(5, 16)}</span></div><p class="text-sm text-slate-700 font-medium">${linkify(p.text)}</p>`;
        list.appendChild(postEl);
    });
});
window.deletePost = async (id) => confirm("삭제할까요?") && await deleteDoc(doc(db, "posts", id));
document.getElementById('addPostBtn').onclick = async () => {
    const text = document.getElementById('post-text').value;
    if(!text.trim() || !auth.currentUser) return;
    await addDoc(collection(db, "posts"), { text, user: auth.currentUser.displayName, createdAt: new Date() });
    document.getElementById('post-text').value = "";
};
onAuthStateChanged(auth, (user) => {
    document.getElementById('admin-panel').classList.toggle('hidden', user?.email !== ADMIN_EMAIL);
    document.getElementById('post-input-section').classList.toggle('hidden', !user);
    document.getElementById('post-login-msg').classList.toggle('hidden', !!user);
    document.getElementById('loginBtn').innerText = user ? "LOGOUT" : "ADMIN";
    document.getElementById('loginBtn').onclick = () => user ? signOut(auth) : signInWithPopup(auth, provider);
});
document.getElementById('saveBtn').onclick = async () => {
    if(!confirm("서버에 저장하시겠습니까?")) return;
    await setDoc(dataDoc, { examDate: document.getElementById('input-date').value, rawAssessments: document.getElementById('input-assessments').value, rawRanges: document.getElementById('input-ranges').value, notice: document.getElementById('input-notice').value, plSchedule: document.getElementById('input-pl').value });
    alert("저장 완료!");
};

getMeal();
