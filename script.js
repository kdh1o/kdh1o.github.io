import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const linkify = (t) => t ? t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-500 font-bold underline">$1</a>') : "";

// [탭 시스템]
const switchTab = (tabId) => {
    ['exam', 'pl', 'meal', 'board'].forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).className = 'flex-1 py-4 font-bold text-gray-400 transition-all text-[13px]';
    });
    document.getElementById(`content-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).className = 'flex-1 py-4 font-bold tab-active transition-all text-[13px]';
    if(tabId === 'meal') getMeal();
};

document.getElementById('tab-exam').onclick = () => switchTab('exam');
document.getElementById('tab-pl').onclick = () => switchTab('pl');
document.getElementById('tab-meal').onclick = () => switchTab('meal');
document.getElementById('tab-board').onclick = () => switchTab('board');

// [가장 빠른 수행평가 계산 함수]
function calculateNearest(rawText) {
    const rows = rawText.split('\n').filter(r => r.includes('|'));
    if (rows.length === 0) return "--";

    const now = new Date();
    const currentYear = now.getFullYear();
    let nearest = null;
    let minDiff = Infinity;

    rows.forEach(r => {
        const [subj, cont, dateStr] = r.split('|');
        const [m, d] = dateStr.split('.').map(n => parseInt(n));
        const targetDate = new Date(currentYear, m - 1, d);
        
        // 날짜가 지났다면 내년으로 설정하지 않고 무시 (올해 기준)
        const diff = targetDate - now;
        if (diff > -86400000 && diff < minDiff) { // 하루 정도 지난 것까지는 포함
            minDiff = diff;
            nearest = { subj, diff: Math.ceil(diff / (1000 * 60 * 60 * 24)) };
        }
    });

    if (!nearest) return "--";
    return `<p class="text-red-600 font-black text-2xl">D-${nearest.diff}</p><p class="text-gray-700 text-[10px] font-bold mt-1">${nearest.subj}</p>`;
}

// [학업 데이터 수신]
onSnapshot(dataDoc, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    // 1. 시험 D-Day
    const diff = new Date(data.examDate) - new Date();
    document.getElementById('exam-dday').innerText = diff > 0 ? `D-${Math.ceil(diff/(1000*60*60*24))}` : "종료";

    // 2. 가장 빠른 수행평가 (수정됨)
    document.getElementById('nearest-assessment').innerHTML = calculateNearest(data.rawAssessments || "");

    // 3. 공지사항
    document.getElementById('notice-content').innerHTML = linkify(data.notice);

    // 4. 수행평가 리스트
    const list = document.getElementById('assessment-list');
    list.innerHTML = "";
    const assessRows = (data.rawAssessments || "").split('\n').filter(r => r.includes('|'));
    assessRows.forEach(r => {
        const [subj, cont, date] = r.split('|');
        list.innerHTML += `<tr><td class="p-4 font-black text-indigo-600">${subj}</td><td class="p-4 text-gray-600">${linkify(cont)}</td><td class="p-4 text-right font-bold text-slate-400">${date}</td></tr>`;
    });

    // 5. 시험범위
    const rCont = document.getElementById('range-cards');
    rCont.innerHTML = "";
    (data.rawRanges || "").split('\n').forEach(l => {
        if(l.includes(':')) {
            const [t, d] = l.split(':');
            rCont.innerHTML += `<div class="bg-white p-6 rounded-2xl border border-indigo-50 animate-fadeIn"><h3 class="font-bold text-indigo-700 text-lg mb-2">${t}</h3><p class="text-slate-600 text-sm">${linkify(d)}</p></div>`;
        }
    });

    // 6. PL 리그
    const plEl = document.getElementById('pl-main-content');
    const plRaw = data.plSchedule || "";
    const plMatch = plRaw.match(/(\d{1,2})[./](\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if(plMatch) {
        const gameDate = new Date(new Date().getFullYear(), parseInt(plMatch[1])-1, parseInt(plMatch[2]), parseInt(plMatch[3]), parseInt(plMatch[4]));
        const tDiff = gameDate - new Date();
        if(tDiff > 0) {
            const h = Math.floor(tDiff/(1000*60*60));
            plEl.innerHTML = `<div class="animate-fadeIn"><span class="bg-cyan-500 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black animate-pulse uppercase">Next Match</span><h3 class="text-5xl font-black mt-6 mb-4 text-white">${h > 24 ? 'D-'+Math.floor(h/24) : h+'시간 전'}</h3><p class="text-slate-400 font-medium">${linkify(plRaw)}</p></div>`;
        } else {
            plEl.innerHTML = `<div class="w-full bg-slate-800/50 p-6 rounded-3xl border border-slate-700 text-left animate-fadeIn"><p class="text-cyan-400 font-bold text-xs mb-2 italic">Match Info</p><p class="text-xl font-bold">${linkify(plRaw)}</p></div>`;
        }
    } else { plEl.innerHTML = `<p class="text-slate-500">${linkify(plRaw || "등록된 일정이 없습니다.")}</p>`; }
});

// [급식 시스템]
async function getMeal() {
    const container = document.getElementById('meal-display-container');
    try {
        const now = new Date();
        const today = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
        const key = "3366de199e3b43ccb46803dcdceb0a92";
        const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${key}&Type=json&ATPT_OFCDC_SC_CODE=N10&SD_SCHUL_CODE=8140052&MLSV_YMD=${today}`;
        const resArr = await Promise.all([1,2,3].map(c => fetch(`${url}&MMEAL_SC_CODE=${c}`).then(r => r.json())));
        resArr.forEach((d, i) => {
            mealStore[i+1] = d.mealServiceDietInfo ? d.mealServiceDietInfo[1].row[0].DDISH_NM.replace(/[0-9.]/g, "").replace(/\(\)/g, "").replace(/<br\/>/g, ", ") : "급식 정보가 없습니다.";
        });
        const hourMin = now.getHours() * 100 + now.getMinutes();
        showMeal(hourMin < 830 ? 1 : (hourMin < 1330 ? 2 : 3));
        document.getElementById('meal-update-time').innerText = `Last Updated: ${now.toLocaleTimeString()}`;
    } catch (e) { container.innerHTML = "급식 서버 로드 실패"; }
}

function showMeal(type) {
    const container = document.getElementById('meal-display-container');
    const cfg = { 1: ['orange', '아침'], 2: ['emerald', '점심'], 3: ['indigo', '저녁'] }[type];
    [1,2,3].forEach(t => {
        const btn = document.getElementById(`btn-meal-${t}`);
        if(btn) btn.className = t === type ? `px-5 py-2.5 rounded-xl bg-white shadow text-${cfg[0]}-600 font-black` : `px-5 py-2.5 rounded-xl text-gray-400 font-bold`;
    });
    container.innerHTML = `<div class="w-full bg-${cfg[0]}-50 p-8 rounded-[2.5rem] text-center animate-fadeIn"><p class="text-xs text-${cfg[0]}-400 font-black mb-2">${cfg[1]}</p><p class="text-lg font-extrabold break-keep text-slate-800">${mealStore[type]}</p></div>`;
}
[1,2,3].forEach(t => document.getElementById(`btn-meal-${t}`).onclick = () => showMeal(t));

// [게시판 시스템] - 새로 추가됨!
const postList = document.getElementById('post-list');
const postText = document.getElementById('post-text');
const addPostBtn = document.getElementById('addPostBtn');

const postQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20));

onSnapshot(postQuery, (snap) => {
    postList.innerHTML = "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const date = p.createdAt?.toDate().toLocaleString().slice(5, 16) || "방금 전";
        const div = document.createElement('div');
        div.className = "card !p-5 bg-white border border-gray-100 animate-fadeIn relative";
        
        // 관리자용 삭제 버튼
        let delBtn = (auth.currentUser?.email === ADMIN_EMAIL) ? `<button onclick="window.deletePost('${docSnap.id}')" class="text-red-400 text-[10px] ml-2">삭제</button>` : "";
        
        div.innerHTML = `
            <div class="flex justify-between text-[11px] mb-2 text-gray-400">
                <div><span class="font-black text-indigo-500 mr-2">${p.user}</span>${delBtn}</div>
                <span>${date}</span>
            </div>
            <p class="text-sm text-slate-700 font-medium whitespace-pre-wrap">${linkify(p.text)}</p>
        `;
        postList.appendChild(div);
    });
});

window.deletePost = async (id) => { if(confirm("삭제하시겠습니까?")) await deleteDoc(doc(db, "posts", id)); };

addPostBtn.onclick = async () => {
    if (!auth.currentUser) return alert("먼저 로그인해주세요!");
    if (!postText.value.trim()) return alert("내용을 입력해주세요.");
    
    try {
        await addDoc(collection(db, "posts"), {
            user: auth.currentUser.displayName || "익명",
            text: postText.value,
            createdAt: serverTimestamp()
        });
        postText.value = "";
    } catch (e) { alert("글 작성 실패: " + e.message); }
};

// [인증 및 관리자 기능]
onAuthStateChanged(auth, async (user) => {
    const adminPanel = document.getElementById('admin-panel');
    const loginBtn = document.getElementById('loginBtn');
    const postInput = document.getElementById('post-input-section');
    const postMsg = document.getElementById('post-login-msg');

    if (user) {
        loginBtn.innerText = "LOGOUT";
        postInput.classList.remove('hidden');
        postMsg.classList.add('hidden');
        if (user.email === ADMIN_EMAIL) {
            adminPanel.classList.remove('hidden');
            const snap = await getDoc(dataDoc);
            if(snap.exists()){
                const d = snap.data();
                document.getElementById('input-date').value = d.examDate || "";
                document.getElementById('input-assessments').value = d.rawAssessments || "";
                document.getElementById('input-ranges').value = d.rawRanges || "";
                document.getElementById('input-notice').value = d.notice || "";
                document.getElementById('input-pl').value = d.plSchedule || "";
            }
        }
    } else {
        loginBtn.innerText = "ADMIN";
        adminPanel.classList.add('hidden');
        postInput.classList.add('hidden');
        postMsg.classList.remove('hidden');
    }
    loginBtn.onclick = () => user ? signOut(auth) : signInWithPopup(auth, provider);
});

document.getElementById('saveBtn').onclick = async () => {
    if(!confirm("서버에 저장할까요?")) return;
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value
    }, { merge: true });
    alert("저장 성공!");
};
