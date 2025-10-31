// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { 
    getAuth, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    collection, 
    query, 
    where,
    getDocs,
    Timestamp,
    setLogLevel
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 1. FIREBASE CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyBwR16eUVAgX4y2Xy7RU7W0GohfXdK1Pdw",
    authDomain: "student-teacher-booking-8cdae.firebaseapp.com",
    projectId: "student-teacher-booking-8cdae",
    storageBucket: "student-teacher-booking-8cdae.firebasestorage.app",
    messagingSenderId: "432372663487",
    appId: "1:432372663487:web:616361ff8e1cdf8970320a",
    measurementId: "G-5BHNDT3Q27"
};

// --- 2. GLOBAL VARIABLES & INITIALIZATION ---
let db, auth, app;
let currentUserId = null;
let currentUserData = null;
let allTeachers = []; 
let teacherListeners = []; 
let studentListeners = []; 
let adminListeners = [];

const usersRefPath = "users";
const appointmentsRefPath = "appointments";
let usersRef, appointmentsRef;

// DOM Elements 
const views = {
    loading: document.getElementById('loadingView'),
    auth: document.getElementById('authView'),
    pending: document.getElementById('pendingView'),
    admin: document.getElementById('adminView'),
    teacher: document.getElementById('teacherView'),
    student: document.getElementById('studentView'),
};
const welcomeMessage = document.getElementById('welcomeMessage');
const logoutButton = document.getElementById('logoutButton');
const loginTabButton = document.getElementById('loginTabButton');
const registerTabButton = document.getElementById('registerTabButton');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// --- 3. INITIALIZATION ---

function initializeFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        const analytics = getAnalytics(app); 
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('Debug'); 
        
        usersRef = collection(db, usersRefPath);
        appointmentsRef = collection(db, appointmentsRefPath);

        setupAuthListener();
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showView('auth');
        document.getElementById('loginError').textContent = 'Error initializing application. Check console for details.';
    }
}

async function setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        detachAllListeners();

        if (user) { 
            currentUserId = user.uid;
            await fetchUserData(user.uid);
            logoutButton.classList.remove('hidden');
        } else {
            currentUserId = null;
            currentUserData = null;
            allTeachers = [];
            showView('auth');
            welcomeMessage.textContent = '';
            logoutButton.classList.add('hidden');
        }
    });
}

async function fetchUserData(uid) {
    showView('loading');
    const userDocRef = doc(usersRef, uid);
    
    try {
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            welcomeMessage.textContent = `Welcome, ${currentUserData.name}!`;
            routeUser(currentUserData);
        } else {
            // Sign out users with Auth login but no Firestore profile.
            await signOut(auth);
            showView('auth');
            document.getElementById('loginError').textContent = 'User profile not set up. Please contact admin.';
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        showView('auth');
        document.getElementById('loginError').textContent = 'Error fetching user data.';
    }
}

function detachAllListeners() {
    [...adminListeners, ...teacherListeners, ...studentListeners].forEach(unsubscribe => unsubscribe());
    adminListeners = [];
    teacherListeners = [];
    studentListeners = [];
}

// --- 4. AUTHENTICATION FUNCTIONS ---

async function handleLogin(e) {
    e.preventDefault();
    const email = loginForm.loginEmail.value;
    const password = loginForm.loginPassword.value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        errorEl.textContent = error.message;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = registerForm.registerEmail.value;
    const password = registerForm.registerPassword.value;
    const name = registerForm.registerName.value;
    const errorEl = document.getElementById('registerError');
    const successEl = document.getElementById('registerSuccess');
    errorEl.textContent = '';
    successEl.style.display = 'none';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userDocRef = doc(usersRef, user.uid);
        const newStudentData = {
            uid: user.uid,
            name: name,
            email: email,
            role: 'student',
            status: 'pending' // Requires admin approval
        };
        await setDoc(userDocRef, newStudentData);
        
        successEl.style.display = 'block';
        registerForm.reset();
        
        await signOut(auth); // Log out immediately, student must be approved
        
        switchAuthTab('login');

    } catch (error) {
        errorEl.textContent = error.message;
    }
}

function handleLogout() {
    signOut(auth);
}

// --- 5. ROUTING & UI FUNCTIONS ---

function showView(viewId) {
    Object.values(views).forEach(view => {
        view.style.display = 'none';
    });
    if (views[viewId]) {
        views[viewId].style.display = 'block';
    } else {
        views.auth.style.display = 'block'; 
    }
}

function routeUser(userData) {
    switch (userData.role) {
        case 'admin':
            showView('admin');
            loadAdminDashboard();
            break;
        case 'teacher':
            showView('teacher');
            loadTeacherDashboard();
            break;
        case 'student':
            if (userData.status === 'pending') {
                showView('pending');
            } else if (userData.status === 'approved') {
                showView('student');
                loadStudentDashboard();
            }
            break;
        default:
            showView('auth');
    }
}

function switchAuthTab(tab) {
    if (tab === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        loginTabButton.classList.add('text-primary-color', 'border-primary-color');
        registerTabButton.classList.remove('text-primary-color', 'border-primary-color');
        registerTabButton.classList.add('text-text-color-light');
    } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        registerTabButton.classList.add('text-primary-color', 'border-primary-color');
        loginTabButton.classList.remove('text-primary-color', 'border-primary-color');
        loginTabButton.classList.add('text-text-color-light');
    }
}

// --- 6. ADMIN FUNCTIONS ---

function loadAdminDashboard() {
    listenForPendingStudents();
    listenForTeachers();
    document.getElementById('addTeacherForm').onsubmit = handleAddTeacher;
}

function listenForPendingStudents() {
    const q = query(usersRef, where("role", "==", "student"), where("status", "==", "pending"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById('studentApprovalList');
        if (snapshot.empty) {
            listEl.innerHTML = '<p class="text-text-color-light">No students waiting for approval.</p>';
            return;
        }
        listEl.innerHTML = '';
        snapshot.forEach((doc) => {
            const student = doc.data();
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg border';
            item.innerHTML = `
                <div>
                    <p class="font-semibold text-text-color">${student.name}</p>
                    <p class="text-sm text-text-color-light">${student.email}</p>
                </div>
                <button data-uid="${student.uid}" class="approve-student-btn bg-success-color hover:opacity-90 text-white font-semibold py-1 px-3 rounded-lg shadow">Approve</button>
            `;
            listEl.appendChild(item);
        });
        
        listEl.querySelectorAll('.approve-student-btn').forEach(btn => {
            btn.onclick = () => approveStudent(btn.dataset.uid);
        });
    }, (error) => console.error('Error listening for pending students:', error));
    
    adminListeners.push(unsubscribe); 
}

async function approveStudent(uid) {
    const userDocRef = doc(usersRef, uid);
    try {
        await updateDoc(userDocRef, { status: 'approved' });
    } catch (error) {
        console.error('Error approving student:', error);
    }
}

function listenForTeachers() {
    const q = query(usersRef, where("role", "==", "teacher"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById('teacherList');
        allTeachers = []; 
        if (snapshot.empty) {
            listEl.innerHTML = '<p class="text-text-color-light">No teachers found.</p>';
            return;
        }
        listEl.innerHTML = '';
        snapshot.forEach((doc) => {
            const teacher = doc.data();
            allTeachers.push(teacher); 
            const item = document.createElement('div'); 
            item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg border';

            item.innerHTML = `
                <div>
                    <p class="font-semibold text-text-color">${teacher.name}</p>
                    <p class="text-sm text-text-color-light">${teacher.email}</p>
                    <p class="text-xs text-text-color-light">${teacher.department} - ${teacher.subject}</p>
                </div>
                <button data-uid="${teacher.uid}" class="delete-teacher-btn bg-danger-color hover:opacity-90 text-white font-semibold py-1 px-3 rounded-lg shadow">Delete</button>
            `;
            listEl.appendChild(item);
        });
        
        listEl.querySelectorAll('.delete-teacher-btn').forEach(btn => {
            btn.onclick = () => deleteTeacher(btn.dataset.uid);
        });
    }, (error) => console.error('Error listening for teachers:', error));
    
    adminListeners.push(unsubscribe); 
}

async function handleAddTeacher(e) {
    e.preventDefault();
    const form = e.target;
    const uid = form.teacherUid.value.trim();
    const name = form.teacherName.value;
    const email = form.teacherEmail.value;
    const department = form.teacherDept.value;
    const subject = form.teacherSubject.value;
    
    const errorEl = document.getElementById('addTeacherError');
    const successEl = document.getElementById('addTeacherSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';

    if (!uid) {
        errorEl.textContent = 'User UID is required.';
        return;
    }

    try {
        const teacherDocRef = doc(usersRef, uid);
        
        // Check if the Firestore doc already exists
        const docSnap = await getDoc(teacherDocRef);
        if (docSnap.exists()) {
            errorEl.textContent = 'Error: A user document with this UID already exists.';
            return;
        }

        // Create the Firestore document
        await setDoc(teacherDocRef, {
            uid: uid,
            name: name,
            email: email,
            role: 'teacher',
            department: department,
            subject: subject
        });
        
        successEl.textContent = 'Teacher profile saved successfully! Tell the teacher to log in.';
        form.reset();
        setTimeout(() => { successEl.textContent = ''; }, 5000);
        
    } catch (error) {
        console.error('Error adding teacher doc:', error);
        errorEl.textContent = error.message;
    }
}

async function deleteTeacher(uid) {
    try {
        const teacherDocRef = doc(usersRef, uid);
        await deleteDoc(teacherDocRef);
    } catch (error) {
        console.error('Error deleting teacher doc:', error);
    }
}

// --- 7. TEACHER FUNCTIONS ---

function loadTeacherDashboard() {
    listenForTeacherAppointments();
}

function listenForTeacherAppointments() {
    const q = query(appointmentsRef, where("teacherId", "==", currentUserId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById('teacherAppointmentList');
        if (snapshot.empty) {
            listEl.innerHTML = '<p class="text-text-color-light">You have no appointments.</p>';
            return;
        }
        
        const appointments = [];
        snapshot.forEach(doc => appointments.push({ id: doc.id, ...doc.data() }));
        
        // Sort by date (newest first)
        appointments.sort((a, b) => b.dateTime.toMillis() - a.dateTime.toMillis());
        
        listEl.innerHTML = ''; 
        appointments.forEach(appt => {
            listEl.appendChild(createAppointmentCard(appt, 'teacher'));
        });
        
        listEl.querySelectorAll('.appt-approve-btn').forEach(btn => {
            btn.onclick = () => updateAppointmentStatus(btn.dataset.id, 'approved');
        });
        listEl.querySelectorAll('.appt-cancel-btn').forEach(btn => {
            btn.onclick = () => updateAppointmentStatus(btn.dataset.id, 'cancelled');
        });
    }, (error) => console.error('Error listening for teacher appointments:', error));
    
    teacherListeners.push(unsubscribe); 
}

async function updateAppointmentStatus(apptId, newStatus) {
    const apptDocRef = doc(appointmentsRef, apptId);
    try {
        await updateDoc(apptDocRef, { status: newStatus });
    } catch (error) {
        console.error('Error updating appointment:', error);
    }
}

// --- 8. STUDENT FUNCTIONS ---

function loadStudentDashboard() {
    listenForStudentAppointments();
    setupTeacherSearch();
    document.getElementById('bookAppointmentForm').onsubmit = handleBookAppointment;
}

function listenForStudentAppointments() {
    const q = query(appointmentsRef, where("studentId", "==", currentUserId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const listEl = document.getElementById('studentAppointmentList');
        if (snapshot.empty) {
            listEl.innerHTML = '<p class="text-text-color-light">You have no appointments.</p>';
            return;
        }
        
        const appointments = [];
        snapshot.forEach(doc => appointments.push({ id: doc.id, ...doc.data() }));
        
        appointments.sort((a, b) => b.dateTime.toMillis() - a.dateTime.toMillis());

        listEl.innerHTML = ''; 
        appointments.forEach(appt => {
            listEl.appendChild(createAppointmentCard(appt, 'student'));
        });
    }, (error) => console.error('Error listening for student appointments:', error));
    
    studentListeners.push(unsubscribe); 
}

function setupTeacherSearch() {
    const searchInput = document.getElementById('teacherSearch');
    const resultsEl = document.getElementById('teacherSearchResults');
    
    // Fetch all teacher profiles for the search function
    const q = query(usersRef, where("role", "==", "teacher"));
    getDocs(q).then(snapshot => {
        allTeachers = snapshot.docs.map(doc => doc.data());
        console.log("Teachers loaded for search:", allTeachers.length);
        if (allTeachers.length === 0) {
             console.warn("No teachers loaded. Check Admin setup or Firestore Security Rules.");
        }
    }).catch(error => {
        // This is where the error will be visible if Firestore Security Rules are the problem
        console.error("Error fetching teachers for search. Check Firestore Security Rules to allow students to read teacher profiles.", error);
    });
    

    searchInput.onkeyup = (e) => {
        const query = e.target.value.toLowerCase();
        resultsEl.innerHTML = ''; 
        
        if (query.length < 2) {
            return;
        }
        
        const results = allTeachers.filter(t => {
            // FIX: Robust check for both 'name' and 'subject'
            const nameMatches = typeof t.name === 'string' && t.name.toLowerCase().includes(query);
            const subjectMatches = typeof t.subject === 'string' && t.subject.toLowerCase().includes(query);

            return nameMatches || subjectMatches;
        });

        results.forEach(teacher => {
            const item = document.createElement('div');
            item.className = 'p-2 border rounded-md hover:bg-gray-100 cursor-pointer text-text-color';
            item.textContent = `${teacher.name} (${teacher.subject || 'N/A'})`;
            item.onclick = () => selectTeacher(teacher); // CRITICAL: This is where the selection happens
            resultsEl.appendChild(item);
        });
    };
}

function selectTeacher(teacher) {
    document.getElementById('teacherSearch').value = teacher.name;
    document.getElementById('selectedTeacherId').value = teacher.uid; // CRITICAL: Updates hidden field
    document.getElementById('selectedTeacherName').textContent = `${teacher.name} (${teacher.subject || 'N/A'})`;
    document.getElementById('teacherSearchResults').innerHTML = '';
}

async function handleBookAppointment(e) {
    e.preventDefault();
    const form = e.target;
    const teacherId = form.selectedTeacherId.value; // Checks hidden field
    const teacherNameEl = document.getElementById('selectedTeacherName');
    const dateTime = form.appointmentTime.value;
    const purpose = form.appointmentPurpose.value;
    const successEl = document.getElementById('bookingSuccess');
    
    if (!teacherId) {
        successEl.textContent = 'Please select a teacher from the search results.';
        successEl.className = 'text-danger-color text-sm mt-2';
        return;
    }

    if (!dateTime) {
        successEl.textContent = 'Please select a date and time.';
        successEl.className = 'text-danger-color text-sm mt-2';
        return;
    }
    
    const appointmentData = {
        studentId: currentUserId,
        studentName: currentUserData.name,
        teacherId: teacherId,
        teacherName: teacherNameEl.textContent, 
        dateTime: Timestamp.fromDate(new Date(dateTime)),
        purpose: purpose,
        status: 'pending' // Default status
    };

    try {
        await addDoc(appointmentsRef, appointmentData);
        successEl.textContent = 'Appointment requested successfully! Waiting for approval.';
        successEl.className = 'text-success-color text-sm mt-2';
        form.reset();
        document.getElementById('selectedTeacherName').textContent = 'None'; // Reset selected teacher
        setTimeout(() => { successEl.textContent = ''; }, 5000);
    } catch (error) {
        console.error('Error booking appointment:', error);
        successEl.textContent = 'Error: ' + error.message;
        successEl.className = 'text-danger-color text-sm mt-2';
    }
}

// --- 9. SHARED UI COMPONENTS ---

function createAppointmentCard(appt, role) {
    const item = document.createElement('div');
    item.className = 'p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm';
    
    let dt;
    if (appt.dateTime && appt.dateTime.toDate) {
        dt = appt.dateTime.toDate(); 
    } else {
        dt = new Date(); // Fallback
    }

    const friendlyDate = dt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    
    let statusColorClass = 'text-warning-color';
    if (appt.status === 'approved') statusColorClass = 'text-success-color';
    if (appt.status === 'cancelled') statusColorClass = 'text-danger-color';
    
    let html = `
        <div class="flex justify-between items-start">
            <div>
                <p class="font-bold text-lg ${statusColorClass}">${appt.status.toUpperCase()}</p>
                <p class="font-semibold text-text-color">
                    ${role === 'student' ? `With: ${appt.teacherName}` : `Student: ${appt.studentName}`}
                </p>
                <p class="text-sm text-text-color-light">${friendlyDate}</p>
            </div>
    `;
    
    // Add buttons for Teacher (Approve/Cancel Appointment)
    if (role === 'teacher' && appt.status === 'pending') {
        html += `
            <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-2 sm:mt-0">
                <button data-id="${appt.id}" class="appt-approve-btn bg-success-color hover:opacity-90 text-white font-semibold py-1 px-3 rounded-lg shadow">Approve</button>
                <button data-id="${appt.id}" class="appt-cancel-btn bg-danger-color hover:opacity-90 text-white font-semibold py-1 px-3 rounded-lg shadow">Cancel</button>
            </div>
        `;
    }
    
    // View Messages (Purpose field acts as the message)
    html += `</div>
            <div class="mt-3 p-3 bg-white border rounded-md">
                <p class="text-sm font-medium text-text-color-light">Purpose & Message:</p>
                <p class="text-sm text-text-color whitespace-pre-wrap">${appt.purpose}</p>
            </div>
    `;
    
    item.innerHTML = html;
    return item;
}


// --- 10. EVENT LISTENERS ---
loginTabButton.onclick = () => switchAuthTab('login');
registerTabButton.onclick = () => switchAuthTab('register');
loginForm.onsubmit = handleLogin;
registerForm.onsubmit = handleRegister;
logoutButton.onclick = handleLogout;

// --- 11. STARTUP ---
showView('loading');
initializeFirebase();