import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. 새로운 파이어베이스 설정 적용
const firebaseConfig = {
  apiKey: "AIzaSyBiUbjpxKMTr96tSoBwwgFn8-5NTCLEnJ8",
  authDomain: "byhs1-4-de284.firebaseapp.com",
  projectId: "byhs1-4-de284",
  storageBucket: "byhs1-4-de284.firebasestorage.app",
  messagingSenderId: "732735890321",
  appId: "1:732735890321:web:230c9225b7dbd1f22f7030"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

// 2. 관리자 이메일을 목록(배열)으로 관리
const ADMIN_EMAILS = [
    "kr.craft1016@gmail.com", 
    "26bh1401@gmail.com" // 여기에 두 번째 관리자 이메일을 넣으세요!
];

const dataDoc = doc(db, "classData", "main");

// --- [로그인 상태 감지 부분 수정] ---
onAuthStateChanged(auth, async (user) => {
    const adminPanel = document.getElementById('admin-panel');
    const postInput = document.getElementById('post-input-section');
    const postMsg = document.getElementById('post-login-msg');
    const loginBtn = document.getElementById('loginBtn');
    
    if (user) {
        loginBtn.innerText = "LOGOUT";
        if (postInput) postInput.classList.remove('hidden');
        if (postMsg) postMsg.classList.add('hidden');
        
        // 관리자 목록에 로그한 유저의 이메일이 있는지 확인
        if (ADMIN_EMAILS.includes(user.email)) {
            adminPanel.classList.remove('hidden');
            const snap = await getDoc(dataDoc);
            if (snap.exists()) {
                const d = snap.data();
                // 기존 데이터 불러오기 로직...
                document.getElementById('input-date').value = d.examDate || "";
                document.getElementById('input-assessments').value = d.rawAssessments || "";
                document.getElementById('input-ranges').value = d.rawRanges || "";
                document.getElementById('input-notice').value = d.notice || "";
                document.getElementById('input-pl').value = d.plSchedule || "";
                document.getElementById('input-pl-rank').value = d.plRank || "";
            }
        } else {
            if (adminPanel) adminPanel.classList.add('hidden');
        }
    } else {
        loginBtn.innerText = "ADMIN";
        if (adminPanel) adminPanel.classList.add('hidden');
        if (postInput) postInput.classList.add('hidden');
        if (postMsg) postMsg.classList.remove('hidden');
    }
});

// --- [게시판 삭제 버튼 권한 수정] ---
// 게시판 목록 렌더링 부분에서 아래 조건을 사용하세요.
// let isAdmin = auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email);

// 유틸리티 함수
let mealStore = { 1: "정보 없음", 2: "정보 없음", 3: "정보 없음" };
const linkify = (t) => t ? t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="text-indigo-500 font-bold underline">$1</a>') : "";

// --- [A] 탭 전환 시스템 (버튼 클릭 안되는 문제 해결 핵심) ---
const tabs = ['exam', 'pl', 'meal', 'board'];
const switchTab = (id) => {
    tabs.forEach(t => {
        const content = document.getElementById(`content-${t}`);
        const btn = document.getElementById(`tab-${t}`);
        if (content) content.classList.add('hidden');
        if (btn) {
            btn.className = 'flex-1 py-4 font-bold text-gray-400 transition-all text-[13px] border-x border-gray-50';
        }
    });
    
    const activeContent = document.getElementById(`content-${id}`);
    const activeBtn = document.getElementById(`tab-${id}`);
    if (activeContent) activeContent.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.className = 'flex-1 py-4 font-bold tab-active transition-all text-[13px]';
    }

    if(id === 'meal') getMeal(); // 급식 탭 클릭 시 데이터 로드
};

// 모든 탭 버튼에 클릭 이벤트 등록
tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (btn) btn.onclick = () => switchTab(t);
});

// --- [B] 로그인 및 관리자 설정 ---
const loginBtn = document.getElementById('loginBtn');
loginBtn.onclick = async () => {
    if (auth.currentUser) {
        if (confirm("로그아웃 하시겠습니까?")) await signOut(auth);
    } else {
        try { await signInWithPopup(auth, provider); } 
        catch (e) { alert("로그인 실패: " + e.message); }
    }
};

// --- [C] 실시간 데이터 렌더링 (PL 전적 포함) ---
onSnapshot(dataDoc, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    // 1. 시험 디데이
    if (data.examDate) {
        const today = new Date(); today.setHours(0,0,0,0);
        const target = new Date(data.examDate); target.setHours(0,0,0,0);
        const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
        document.getElementById('exam-dday').innerText = diff > 0 ? `D-${diff}` : (diff === 0 ? "D-Day🔥" : "종료");
    }

    // 2. 가장 빠른 수행평가
    document.getElementById('nearest-assessment').innerHTML = getNearest(data.rawAssessments || "");

    // 3. 공지사항
    document.getElementById('notice-content').innerHTML = linkify(data.notice);

    // 4. 수행평가 리스트
    const list = document.getElementById('assessment-list');
    list.innerHTML = "";
    (data.rawAssessments || "").split('\n').filter(r => r.includes('|')).forEach(r => {
        const [s, c, d] = r.split('|');
        list.innerHTML += `<tr><td class="p-4 font-black text-indigo-600">${s}</td><td class="p-4 text-gray-600">${linkify(c)}</td><td class="p-4 text-right font-bold text-slate-400">${d}</td></tr>`;
    });

    // 5. 시험 범위
    const rCont = document.getElementById('range-cards');
    rCont.innerHTML = "";
    (data.rawRanges || "").split('\n').filter(l => l.includes(':')).forEach(l => {
        const [t, d] = l.split(':');
        rCont.innerHTML += `<div class="bg-white p-6 rounded-2xl border border-indigo-50 animate-fadeIn"><h3 class="font-bold text-indigo-700 text-lg mb-2">${t}</h3><p class="text-slate-600 text-sm">${linkify(d)}</p></div>`;
    });

    // 6. 부리미어 리그 (일정 및 전적)
    const plEl = document.getElementById('pl-main-content');
    plEl.innerHTML = `<div class="w-full bg-slate-800/50 p-6 rounded-2xl border border-slate-700 text-left animate-fadeIn"><p class="text-lg font-bold">${linkify(data.plSchedule || "경기 정보 없음")}</p></div>`;

    const rankList = document.getElementById('pl-rank-list');
    rankList.innerHTML = "";
    (data.plRank || "").split('\n').filter(r => r.includes('|')).forEach((r, idx) => {
        const [team, record] = r.split('|');
        rankList.innerHTML += `<tr class="animate-fadeIn"><td class="py-4 px-2 font-black text-cyan-500">${idx+1}</td><td class="py-4 font-bold text-white">${team}</td><td class="py-4 text-right text-slate-300 font-mono">${record}</td></tr>`;
    });
});

// --- [D] 게시판 로직 ---
const addPostBtn = document.getElementById('addPostBtn');
const postText = document.getElementById('post-text');
onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20)), (snap) => {
    const postList = document.getElementById('post-list');
    postList.innerHTML = "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const div = document.createElement('div');
        div.className = "card !p-5 bg-white border border-gray-100 animate-fadeIn relative";
        let delBtn = (auth.currentUser?.email === ADMIN_EMAIL) ? `<button onclick="window.deletePost('${docSnap.id}')" class="text-red-400 text-[10px] ml-2">삭제</button>` : "";
        div.innerHTML = `<div class="flex justify-between text-[11px] mb-2 text-gray-400"><div><span class="font-black text-indigo-500 mr-2">${p.user}</span>${delBtn}</div><span>${p.createdAt?.toDate().toLocaleString().slice(5, 16) || "방금 전"}</span></div><p class="text-sm text-slate-700 whitespace-pre-wrap">${linkify(p.text)}</p>`;
        postList.appendChild(div);
    });
});
window.deletePost = async (id) => { if(confirm("삭제?")) await deleteDoc(doc(db, "posts", id)); };
addPostBtn.onclick = async () => {
    if (!postText.value.trim()) return;
    await addDoc(collection(db, "posts"), { user: auth.currentUser.displayName || "익명", text: postText.value, createdAt: serverTimestamp() });
    postText.value = "";
};

// --- [E] 급식 로직 ---
async function getMeal() {
    const now = new Date();
    const today = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=3366de199e3b43ccb46803dcdceb0a92&Type=json&ATPT_OFCDC_SC_CODE=N10&SD_SCHUL_CODE=8140052&MLSV_YMD=${today}`;
    try {
        const resArr = await Promise.all([1,2,3].map(c => fetch(`${url}&MMEAL_SC_CODE=${c}`).then(r => r.json())));
        resArr.forEach((d, i) => {
            mealStore[i+1] = d.mealServiceDietInfo ? d.mealServiceDietInfo[1].row[0].DDISH_NM.replace(/[0-9.]/g, "").replace(/\(\)/g, "").replace(/<br\/>/g, ", ") : "식단 정보가 없습니다.";
        });
        const hm = now.getHours() * 100 + now.getMinutes();
        showMeal(hm < 830 ? 1 : (hm < 1330 ? 2 : 3));
    } catch (e) { console.error(e); }
}
function showMeal(type) {
    const container = document.getElementById('meal-display-container');
    const cfg = { 1: ['orange', '조식'], 2: ['emerald', '중식'], 3: ['indigo', '석식'] }[type];
    [1,2,3].forEach(t => {
        const btn = document.getElementById(`btn-meal-${t}`);
        if(btn) btn.className = t === type ? `px-5 py-2.5 rounded-xl bg-white shadow text-${cfg[0]}-600 font-black` : `px-5 py-2.5 rounded-xl text-gray-400 font-bold`;
    });
    if(container) container.innerHTML = `<div class="w-full bg-${cfg[0]}-50 p-8 rounded-[2.5rem] text-center animate-fadeIn"><p class="text-xs text-${cfg[0]}-400 font-black mb-2">${cfg[1]}</p><p class="text-lg font-extrabold break-keep text-slate-800">${mealStore[type]}</p></div>`;
}
[1,2,3].forEach(t => {
    const btn = document.getElementById(`btn-meal-${t}`);
    if(btn) btn.onclick = () => showMeal(t);
});

// --- [F] 유틸리티 함수들 ---
function getNearest(raw) {
    const lines = raw.split('\n').filter(l => l.includes('|'));
    if (lines.length === 0) return "--";
    const now = new Date(); now.setHours(0,0,0,0);
    let minDiff = Infinity; let nearestSubj = "";
    lines.forEach(line => {
        const [subj, , dateStr] = line.split('|');
        const [m, d] = dateStr.split('.').map(Number);
        const target = new Date(now.getFullYear(), m - 1, d);
        target.setHours(0,0,0,0);
        const diff = target - now;
        if (diff >= 0 && diff < minDiff) { minDiff = diff; nearestSubj = subj; }
    });
    const dday = Math.ceil(minDiff / (1000 * 60 * 60 * 24));
    return nearestSubj ? `<p class="text-red-600 font-black text-2xl">D-${dday}</p><p class="text-gray-700 text-[10px] font-bold mt-1">${nearestSubj}</p>` : "--";
}

document.getElementById('saveBtn').onclick = async () => {
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value,
        plRank: document.getElementById('input-pl-rank').value
    }, { merge: true });
    alert("서버에 저장되었습니다!");
};
