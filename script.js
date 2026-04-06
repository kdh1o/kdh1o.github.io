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

// [데이터 실시간 수신]
onSnapshot(dataDoc, (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        
        // 1. 시험 디데이
        const examDiff = new Date(data.examDate) - new Date();
        const examDays = Math.ceil(examDiff / (1000 * 60 * 60 * 24));
        document.getElementById('exam-dday').innerText = examDays > 0 ? `D-${examDays}` : (examDays === 0 ? "D-Day" : "종료");

        // 2. 공지사항
        document.getElementById('notice-content').innerHTML = linkify(data.notice || "공지가 없습니다.");

        // 3. 부리미어 리그 디데이 로직
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
                plEl.innerHTML = `
                    <div class="mb-2 flex items-center gap-2">
                        <span class="bg-cyan-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full animate-blink uppercase">Live Coming</span>
                        <span class="text-cyan-400 text-xs font-bold">${ddayStr}</span>
                    </div>
                    <div class="text-lg font-bold text-white tracking-tight">${linkify(plRaw)}</div>
                `;
            } else {
                plEl.innerHTML = `<div class="text-slate-500 font-bold text-sm italic">[경기 종료 또는 진행중]</div><div class="text-slate-400 text-sm mt-1">${linkify(plRaw)}</div>`;
            }
        } else { plEl.innerHTML = `<div class="text-slate-500 text-sm">${linkify(plRaw || "일정이 없습니다.")}</div>`; }

        // 4. 수행평가 리스트
        const listBody = document.getElementById('assessment-list');
        listBody.innerHTML = "";
        const rows = (data.rawAssessments || "").split('\n').filter(r => r.includes('|'));
        if(rows.length > 0) {
            const firstRow = rows[0].split('|');
            document.getElementById('nearest-assessment').innerText = `${firstRow[0]}: ${firstRow[1]}`;
            rows.forEach(r => {
                const [s, c, d] = r.split('|');
                listBody.innerHTML += `<tr><td class="p-4 font-extrabold text-indigo-600">${s}</td><td class="p-4 text-gray-600">${linkify(c)}</td><td class="p-4 text-right font-bold text-slate-400">${d}</td></tr>`;
            });
        }

        // 5. 시험 범위
        const rangeCont = document.getElementById('range-cards');
        rangeCont.innerHTML = "";
        (data.rawRanges || "").split('\n').forEach(l => {
            if(l.includes(':')) {
                const [t, d] = l.split(':');
                rangeCont.innerHTML += `<div class="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100/50 hover:bg-white transition-colors"><h3 class="font-bold text-indigo-700 text-lg mb-1">${t}</h3><p class="text-gray-500 text-sm leading-relaxed">${linkify(d)}</p></div>`;
            }
        });

        // 관리자 인풋값 동기화
        document.getElementById('input-date').value = data.examDate || "";
        document.getElementById('input-assessments').value = data.rawAssessments || "";
        document.getElementById('input-ranges').value = data.rawRanges || "";
        document.getElementById('input-notice').value = data.notice || "";
        document.getElementById('input-pl').value = data.plSchedule || "";
    }
});

// [게시판]
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40));
onSnapshot(q, (snap) => {
    const list = document.getElementById('post-list');
    list.innerHTML = "";
    const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const postId = docSnap.id;
        const postEl = document.createElement('div');
        postEl.className = "card !p-5 bg-white/60 hover:bg-white transition-all border border-gray-100";
        let delBtn = isAdmin ? `<button class="text-red-400 text-[10px] ml-2 font-bold hover:underline" onclick="window.deletePost('${postId}')">삭제</button>` : "";
        postEl.innerHTML = `<div class="flex justify-between text-[11px] mb-2 text-gray-400"><div><span class="font-black text-indigo-500 mr-1">${p.user}</span>${delBtn}</div><span>${p.createdAt?.toDate().toLocaleString().slice(5, 16)}</span></div><p class="text-[14px] text-slate-700 leading-relaxed font-medium">${linkify(p.text)}</p>`;
        list.appendChild(postEl);
    });
});

window.deletePost = async (id) => { if(confirm("삭제하시겠습니까?")) await deleteDoc(doc(db, "posts", id)); };

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
    if(!confirm("서버 데이터를 갱신하시겠습니까?")) return;
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value,
        lastUpdated: new Date().toLocaleString()
    });
    alert("서버 저장 완료!");
};
