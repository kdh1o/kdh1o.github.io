// Firebase import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, query, orderBy, limit, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase 설정
const firebaseConfig = {
    apiKey: "YOUR_KEY",
    authDomain: "YOUR_DOMAIN",
    projectId: "YOUR_ID",
};

// 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();
const provider = new GoogleAuthProvider();

// 관리자
const ADMIN_EMAIL = "kr.craft1016@gmail.com";

// 문서
const dataDoc = doc(db, "classData", "main");

// 링크 변환
const linkify = (text) => {
    if (!text) return "";
    return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" class="auto-link">$1</a>');
};

// 탭 전환
const switchTab = (tab) => {
    document.getElementById('content-exam').classList.toggle('hidden', tab !== 'exam');
    document.getElementById('content-board').classList.toggle('hidden', tab !== 'board');
};

document.getElementById('tab-exam').onclick = () => switchTab('exam');
document.getElementById('tab-board').onclick = () => switchTab('board');

// 데이터 실시간
onSnapshot(dataDoc, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();

    // D-Day
    const diff = new Date(data.examDate) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    document.getElementById('exam-dday').innerText =
        days > 0 ? `D-${days}` : (days === 0 ? "D-Day" : "종료");

    // 공지
    document.getElementById('notice-content').innerHTML =
        linkify(data.notice || "공지 없음");

    // 수행평가
    const list = document.getElementById('assessment-list');
    list.innerHTML = "";

    const rows = (data.rawAssessments || "").split('\n').filter(r => r.includes('|'));

    rows.forEach(r => {
        const [s, c, d] = r.split('|');
        list.innerHTML += `
        <tr>
            <td class="p-3 font-bold text-indigo-600">${s}</td>
            <td class="p-3">${linkify(c)}</td>
            <td class="p-3 text-blue-500 font-bold">${d}</td>
        </tr>`;
    });

    if (rows.length > 0) {
        const [s, c] = rows[0].split('|');
        document.getElementById('nearest-assessment').innerHTML =
            `${s} - ${linkify(c)}`;
    }

    // 시험 범위
    const range = document.getElementById('range-cards');
    if (range) {
        range.innerHTML = "";

        (data.rawRanges || "").split('\n').forEach(line => {
            if (!line.includes(':')) return;
            const [t, d] = line.split(':');

            range.innerHTML += `
            <div class="card">
                <h3 class="font-bold text-green-600">${t}</h3>
                <p>${linkify(d)}</p>
            </div>`;
        });
    }
});

// 게시판
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40));

onSnapshot(q, (snap) => {
    const list = document.getElementById('post-list');
    list.innerHTML = "";

    snap.forEach(docSnap => {
        const p = docSnap.data();

        const el = document.createElement('div');
        el.className = "card";

        el.innerHTML = `
            <div class="text-xs text-gray-400 mb-1">
                ${p.user} · ${p.createdAt?.toDate().toLocaleString()}
            </div>
            <div>${linkify(p.text)}</div>
        `;

        list.appendChild(el);
    });
});

// 글 작성
document.getElementById('addPostBtn').onclick = async () => {
    const text = document.getElementById('post-text').value;

    if (!text.trim() || !auth.currentUser) return;

    await addDoc(collection(db, "posts"), {
        text,
        user: auth.currentUser.displayName,
        createdAt: new Date()
    });

    document.getElementById('post-text').value = "";
};

// 로그인 상태
onAuthStateChanged(auth, (user) => {
    const btn = document.getElementById('loginBtn');

    btn.innerText = user ? "로그아웃" : "로그인";
    btn.onclick = () =>
        user ? signOut(auth) : signInWithPopup(auth, provider);
});

// 저장 (관리자)
document.getElementById('saveBtn')?.addEventListener('click', async () => {
    await setDoc(dataDoc, {
        examDate: document.getElementById('input-date').value,
        rawAssessments: document.getElementById('input-assessments').value,
        rawRanges: document.getElementById('input-ranges').value,
        notice: document.getElementById('input-notice').value
    });

    alert("저장 완료");
});
