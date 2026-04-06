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

const linkify = (text) => {
    if (!text) return "";
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<a href="$1" target="_blank" class="auto-link">$1</a>');
};

const switchTab = (tab) => {
    document.getElementById('content-exam').classList.toggle('hidden', tab !== 'exam');
    document.getElementById('content-board').classList.toggle('hidden', tab !== 'board');
    document.getElementById('tab-exam').className = tab === 'exam' ? 'flex-1 py-4 font-bold tab-active transition-all' : 'flex-1 py-4 font-bold text-gray-400 transition-all';
    document.getElementById('tab-board').className = tab === 'board' ? 'flex-1 py-4 font-bold tab-active transition-all' : 'flex-1 py-4 font-bold text-gray-400 transition-all';
};
document.getElementById('tab-exam').onclick = () => switchTab('exam');
document.getElementById('tab-board').onclick = () => switchTab('board');

// [급식 기능: JohnsonLib 연동]
async function getMeal() {
    const mealEl = document.getElementById('meal-content');
    try {
        // 부여고 행정표준코드 8140052 사용
        const meal = await MealRequest('high', '8140052');
        
        if (meal && meal.length > 0) {
            const mealType = meal[0]; // 중식 등 시간대
            const menu = meal.slice(1).join(", "); // 메뉴만 추출
            
            mealEl.innerHTML = `
                <div class="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-100/50">
                    <p class="text-[10px] text-emerald-500 font-black mb-1 uppercase tracking-widest">${mealType}</p>
                    <p class="text-emerald-800 font-bold text-base leading-relaxed break-keep">${menu}</p>
                </div>
            `;
        } else {
            mealEl.innerHTML = `<div class="text-center py-4 text-gray-400 italic text-sm">🍱 오늘 등록된 식단이 없습니다.</div>`;
        }
    } catch (e) {
        console.error(e);
        mealEl.innerHTML = `<div class="text-center py-4 text-red-400 text-xs">⚠️ 급식 데이터를 불러오지 못했습니다.</div>`;
    }
}

// [실시간 데이터 렌더링]
onSnapshot(dataDoc, (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        
        // 1. 중간고사 D-Day
        const examDiff = new Date(data.examDate) - new Date();
        const examDays = Math.ceil(examDiff / (1000 * 60 * 60 * 24));
        document.getElementById('exam-dday').innerText = examDays > 0 ? `D-${examDays}` : (examDays === 0 ? "D-Day" : "종료");

        // 2. 공지사항
        document.getElementById('notice-content').innerHTML = linkify(data.notice || "공지가 없습니다.");

        // 3. 부리미어 리그
        const plRaw = data.plSchedule || "";
        const plEl = document.getElementById('pl-content');
        const timeRegex = /(\d{1,2})[./](\d{1,2})\s+(\d{1,2}):(\d{2})/;
        const plMatch = plRaw.match(timeRegex);
        if (plMatch) {
            const [_, mon, day, hr, min] = plMatch;
            const now = new Date();
            const gameDate = new Date(now.getFullYear(), parseInt(mon) - 1, parseInt(day), parseInt(hr), parseInt(min));
            const tDiff = gameDate - now;
            if (tDiff > 0) {
                const d = Math.floor(tDiff / (1000 * 60 * 60 * 24));
                const h = Math.floor((tDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((tDiff % (1000 * 60 * 60)) / (1000 * 60));
                let ddayStr = d > 0 ? `D-${d} ${h}시간 전` : (h > 0 ? `${h}시간 ${m}분 전` : `${m}분 전`);
                plEl.innerHTML = `<div class="mb-2 flex items-center gap-2"><span class="bg-cyan-400 text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-full animate-blink uppercase">Coming</span><span class="text-cyan-400 text-xs font-bold">${ddayStr}</span></div><div class="text-lg font-bold text-white">${linkify(plRaw)}</div>`;
            } else {
                plEl.innerHTML = `<div class="text-slate-500 font-bold text-xs italic">[진행중/종료]</div><div class="text-slate-400 text-sm mt-1">${linkify(plRaw)}</div>`;
            }
        } else { plEl.innerHTML = `<div class="text-slate-500 text-sm">${linkify(plRaw || "일정이 없습니다.")}</div>`; }

        // 4. 수행평가 리스트 & D-Day
        const listBody = document.getElementById('assessment-list');
        listBody.innerHTML = "";
        const rows = (data.rawAssessments || "").split('\n').filter(r => r.includes('|'));
        if(rows.length > 0) {
            const [subj, cont, dateStr] = rows[0].split('|');
            const now = new Date();
            const [m, d] = dateStr.split('.').map(v => parseInt(v));
            const targetDate = new Date(now.getFullYear(), m - 1, d);
            const diff = Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24));
            let ddayText = diff > 0 ? `D-${diff}` : (diff === 0 ? "D-Day" : "종료");
            document.getElementById('nearest-assessment').innerHTML = `<p class="text-red-600 font-black text-2xl">${ddayText}</p><p class="text-gray-700 text-[10px] font-bold mt-1 tracking-tight">${subj}</p>`;
            rows.forEach(r => {
                const [s, c, d_val] = r.split('|');
                listBody.innerHTML += `<tr><td class="p-4 font-extrabold text-indigo-600">${s}</td><td class="p-4 text-gray-600">${linkify(c)}</td><td class="p-4 text-right font-bold text-slate-400">${d_val}</td></tr>`;
            });
        }

        // 5. 시험 범위 (폰트 크기 확대 적용)
        const rangeCont = document.getElementById('range-cards');
        rangeCont.innerHTML = "";
        (data.rawRanges || "").split('\n').forEach(l => {
            if(l.includes(':')) {
                const [t, d] = l.split(':');
                rangeCont.innerHTML += `<div class="bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100/50 transition-colors hover:bg-white"><h3 class="font-bold text-indigo-700 text-xl mb-2 flex items-center gap-2"><span class="w-1 h-5 bg-indigo-400 rounded-full"></span>${t}</h3><p class="range-text">${linkify(d)}</p></div>`;
            }
        });

        // 어드민 데이터 싱크
        document.getElementById('input-date').value = data.examDate || "";
        document.getElementById('input-assessments').value = data.rawAssessments || "";
        document.getElementById('input-ranges').value = data.rawRanges || "";
        document.getElementById('input-notice').value = data.notice || "";
        document.getElementById('input-pl').value = data.plSchedule || "";
    }
});

// [게시판 및 로그인]
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40));
onSnapshot(q, (snap) => {
    const list = document.getElementById('post-list');
    list.innerHTML = "";
    const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const postId = docSnap.id;
        const postEl = document.createElement('div');
        postEl.className = "card !p-5 bg-white/60 hover:bg-white border border-gray-100";
        let delBtn = isAdmin ? `<button class="text-red-400 text-[10px] ml-2 font-bold" onclick="window.deletePost('${postId}')">삭제</button>` : "";
        postEl.innerHTML = `<div class="flex justify-between text-[11px] mb-2 text-gray-400"><div><span class="font-black text-indigo-500 mr-1">${p.user}</span>${delBtn}</div><span>${p.createdAt?.toDate().toLocaleString().slice(5, 16)}</span></div><p class="text-[14px] text-slate-700 leading-relaxed font-medium">${linkify(p.text)}</p>`;
        list.appendChild(postEl);
    });
});

window.deletePost = async (id) => { if(confirm("삭제할까요?")) await deleteDoc(doc(db, "posts", id)); };

document.getElementById('addPostBtn').onclick = async () => {
    const text = document.getElementById('post-text').value;
    if(!text.trim() || !auth.currentUser) return;
    await addDoc(collection(db, "posts"), { text, user: auth.currentUser.displayName, createdAt: new Date() });
    document.getElementById('post-text').value = "";
};

onAuthStateChanged(auth, (user) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin);
    document.getElementById('post-input-section').classList.toggle('hidden', !user);
    document.getElementById('post-login-msg').classList.toggle('hidden', !!user);
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.innerText = user ? "LOGOUT" : "ADMIN";
    loginBtn.onclick = () => user ? signOut(auth) : signInWithPopup(auth, provider);
});

document.getElementById('saveBtn').onclick = async () => {
    if(!confirm("서버에 반영할까요?")) return;
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value,
        lastUpdated: new Date().toLocaleString()
    });
    alert("반영 완료!");
};

// **페이지 로드 시 급식 함수 실행**
getMeal();
