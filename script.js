import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 날아갔던 파이어베이스 설정 원상복구
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

// 링크 자동 변환
const linkify = (text) => {
    if (!text) return "";
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlPattern, '<a href="$1" target="_blank" class="auto-link">$1</a>');
};

// 탭 전환
const switchTab = (tab) => {
    document.getElementById('content-exam').classList.toggle('hidden', tab !== 'exam');
    document.getElementById('content-board').classList.toggle('hidden', tab !== 'board');
    document.getElementById('tab-exam').className = tab === 'exam' ? 'flex-1 py-4 font-semibold tab-active transition' : 'flex-1 py-4 font-semibold text-gray-400 transition';
    document.getElementById('tab-board').className = tab === 'board' ? 'flex-1 py-4 font-semibold tab-active transition' : 'flex-1 py-4 font-semibold text-gray-400 transition';
};
document.getElementById('tab-exam').onclick = () => switchTab('exam');
document.getElementById('tab-board').onclick = () => switchTab('board');

// [메인 데이터 가져오기]
onSnapshot(dataDoc, (snap) => {
    if (snap.exists()) {
        const data = snap.data();
        
        // 1. 시험 D-Day
        const examDiff = new Date(data.examDate) - new Date();
        const examDays = Math.ceil(examDiff / (1000 * 60 * 60 * 24));
        document.getElementById('exam-dday').innerText = examDays > 0 ? `D-${examDays}` : (examDays === 0 ? "D-Day" : "종료");

        // 2. 공지사항
        document.getElementById('notice-content').innerHTML = linkify(data.notice || "공지가 없습니다.");

        // 3. 부리미어 리그 (복구)
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
                plEl.innerHTML = `<div class="mb-2"><span class="bg-cyan-100 text-cyan-700 text-xs font-bold px-2 py-1 rounded shadow-sm">${ddayStr}</span></div><div class="text-base font-medium">${linkify(plRaw)}</div>`;
            } else {
                plEl.innerHTML = `<div class="mb-1"><span class="bg-gray-200 text-gray-500 text-xs px-2 py-1 rounded">경기 종료</span></div><div class="text-gray-500">${linkify(plRaw)}</div>`;
            }
        } else {
            plEl.innerHTML = linkify(plRaw || "일정이 없습니다.");
        }

        // 4. 수행평가
        const listBody = document.getElementById('assessment-list');
        listBody.innerHTML = "";
        const rows = (data.rawAssessments || "").split('\n').filter(r => r.includes('|'));
        if(rows.length > 0) {
            const firstRow = rows[0].split('|');
            document.getElementById('nearest-assessment').innerHTML = `${firstRow[0]} - ${linkify(firstRow[1])}`;
            rows.forEach(r => {
                const [s, c, d] = r.split('|');
                listBody.innerHTML += `<tr><td class="p-4 font-bold text-indigo-600">${s}</td><td class="p-4">${linkify(c)}</td><td class="p-4 text-blue-500 font-bold">${d}</td></tr>`;
            });
        }

        // 5. 시험 범위
        const rangeCont = document.getElementById('range-cards');
        rangeCont.innerHTML = "";
        (data.rawRanges || "").split('\n').forEach(l => {
            if(l.includes(':')) {
                const [t, d] = l.split(':');
                rangeCont.innerHTML += `<div class="bg-indigo-50/50 p-5 rounded-xl border border-indigo-50"><h3 class="font-bold text-indigo-700 text-lg mb-1">${t}</h3><p class="text-gray-600">${linkify(d)}</p></div>`;
            }
        });

        // 6. 관리자창 세팅
        document.getElementById('input-date').value = data.examDate || "";
        document.getElementById('input-assessments').value = data.rawAssessments || "";
        document.getElementById('input-ranges').value = data.rawRanges || "";
        document.getElementById('input-notice').value = data.notice || "";
        document.getElementById('input-pl').value = data.plSchedule || "";
    }
});

// [게시판 불러오기 및 삭제 로직 복구]
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40));
onSnapshot(q, (snap) => {
    const list = document.getElementById('post-list');
    list.innerHTML = "";
    const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const postId = docSnap.id;
        const postEl = document.createElement('div');
        postEl.className = "bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-sm";
        let delBtn = isAdmin ? `<button class="delete-btn text-red-500 text-xs ml-2 font-bold" onclick="window.deletePost('${postId}')">삭제</button>` : "";
        postEl.innerHTML = `<div class="flex justify-between text-xs mb-1"><div><span class="font-bold text-indigo-600">${p.user}</span>${delBtn}</div><span class="text-gray-400">${p.createdAt?.toDate().toLocaleString().slice(5, 16)}</span></div><p class="text-sm text-gray-700">${linkify(p.text)}</p>`;
        list.appendChild(postEl);
    });
});

window.deletePost = async (id) => {
    if(confirm("삭제하시겠습니까?")) await deleteDoc(doc(db, "posts", id));
};

document.getElementById('addPostBtn').onclick = async () => {
    const text = document.getElementById('post-text').value;
    if(!text.trim() || !auth.currentUser) return;
    await addDoc(collection(db, "posts"), { text, user: auth.currentUser.displayName, createdAt: new Date() });
    document.getElementById('post-text').value = "";
};

// [로그인 및 관리자 권한 복구]
onAuthStateChanged(auth, (user) => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin);
    document.getElementById('post-input-section').classList.toggle('hidden', !user);
    document.getElementById('post-login-msg').classList.toggle('hidden', !!user);
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.innerText = user ? "로그아웃" : "관리자 로그인";
    loginBtn.onclick = () => user ? signOut(auth) : signInWithPopup(auth, provider);
});

// [저장 로직 복구]
document.getElementById('saveBtn').onclick = async () => {
    if(!confirm("저장할까요?")) return;
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value,
        plSchedule: document.getElementById('input-pl').value,
        lastUpdated: new Date().toLocaleString()
    });
    alert("저장 완료!");
};
