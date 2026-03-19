import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp, 
  orderBy, 
  where,
  getDocs,
  doc,
  getDoc
} from 'firebase/firestore';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  getAuth,
  User as FirebaseUser 
} from 'firebase/auth';
import { db, auth, config } from './firebase';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import * as XLSX from 'xlsx';
import { 
  Users, 
  QrCode, 
  ClipboardList, 
  LogOut, 
  Plus, 
  Download, 
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Scan,
  Edit,
  Edit2,
  Trash2,
  GraduationCap,
  ShieldCheck,
  UserCog,
  Calendar,
  Send,
  ExternalLink,
  Lock,
  Mail,
  ChevronLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { Student, AttendanceRecord, Parent, Teacher, Class, User as AppUser } from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const calculateEndTime = (startTime: string, lessons: number) => {
  if (!startTime || !lessons || lessons <= 0) return '--:--';
  const [hours, minutes] = startTime.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes;
  
  for (let i = 1; i <= lessons; i++) {
    totalMinutes += 45; // Lesson duration
    if (i < lessons) {
      if (i === 2) {
        totalMinutes += 15; // Long break after 2nd lesson
      } else {
        totalMinutes += 5; // Short break
      }
    }
  }
  
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'teachers' | 'teacher_logs' | 'users'>('dashboard');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [now, setNow] = useState(new Date());
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDeleteStudent = async (id: string) => {
    setConfirmConfig({
      title: "O'quvchini o'chirish",
      message: "Haqiqatan ham ushbu o'quvchini o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'students', id));
          setConfirmConfig(null);
        } catch (error) {
          console.error("Error deleting student:", error);
        }
      }
    });
  };

  const handleDeleteTeacher = async (id: string) => {
    setConfirmConfig({
      title: "O'qituvchini o'chirish",
      message: "Haqiqatan ham ushbu o'qituvchini o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'teachers', id));
          setConfirmConfig(null);
        } catch (error) {
          console.error("Error deleting teacher:", error);
        }
      }
    });
  };

  const handleDeleteClass = async (id: string) => {
    setConfirmConfig({
      title: "Sinfni o'chirish",
      message: "Haqiqatan ham ushbu sinfni o'chirmoqchimisiz?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'classes', id));
          setConfirmConfig(null);
        } catch (error) {
          console.error("Error deleting class:", error);
        }
      }
    });
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create user profile
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          setUserProfile({ id: userDoc.id, ...userDoc.data() } as AppUser);
        } else {
          // Check if there's a pre-registered profile with this email
          const q = query(collection(db, 'users'), where('email', '==', u.email?.toLowerCase()));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const preRegDoc = querySnapshot.docs[0];
            const preRegData = preRegDoc.data();
            
            // Update the pre-registered doc with the real UID
            const updatedProfile: AppUser = {
              id: u.uid,
              name: u.displayName || preRegData.name || 'Noma\'lum',
              email: u.email || '',
              role: preRegData.role || 'admin'
            };
            
            // Delete the old doc and create new one with UID as ID
            await deleteDoc(doc(db, 'users', preRegDoc.id));
            await setDoc(doc(db, 'users', u.uid), updatedProfile);
            setUserProfile(updatedProfile);
          } else {
            // Create default profile ONLY for bootstrap accounts
            const isFirstSuperAdmin = u.email === 'superadmin@maktab.uz';
            const isAdminUser = u.email === 'admin@maktab.uz';
            
            if (isFirstSuperAdmin || isAdminUser) {
              const newProfile: AppUser = {
                id: u.uid,
                name: u.displayName || (isFirstSuperAdmin ? 'Super Admin' : 'Admin'),
                email: u.email || '',
                role: isFirstSuperAdmin ? 'superadmin' : 'admin'
              };
              await setDoc(doc(db, 'users', u.uid), newProfile);
              setUserProfile(newProfile);
            } else {
              // Not a bootstrap account and not pre-registered/existing
              console.warn("Unauthorized login attempt:", u.email);
              await signOut(auth);
              setLoginError("Sizga tizimga kirish uchun ruxsat berilmagan.");
            }
          }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user || !userProfile) return;

    const studentsQuery = query(collection(db, 'students'), orderBy('name'));
    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));

    const teachersQuery = query(collection(db, 'teachers'), orderBy('name'));
    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'teachers'));

    const classesQuery = query(collection(db, 'classes'), orderBy('name'));
    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'classes'));

    const parentsQuery = query(collection(db, 'parents'));
    const unsubscribeParents = onSnapshot(parentsQuery, (snapshot) => {
      setParents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Parent)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'parents'));

    const attendanceQuery = query(
      collection(db, 'attendance'), 
      orderBy('timestamp', 'desc')
    );
    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'attendance'));

    let unsubscribeUsers = () => {};
    if (userProfile.role === 'superadmin' || userProfile.role === 'director') {
      const usersQuery = query(collection(db, 'users'), orderBy('name'));
      unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setAllUsers(usersList);
        
        // Cleanup: Automatically remove the unwanted superadmin if current user is the main one
        if (userProfile.email === 'superadmin@maktab.uz') {
          const unwantedUser = usersList.find(u => u.email === 'justnobody729@gmail.com');
          if (unwantedUser) {
            deleteDoc(doc(db, 'users', unwantedUser.id)).catch(console.error);
          }
        }
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    }

    return () => {
      unsubscribeStudents();
      unsubscribeTeachers();
      unsubscribeClasses();
      unsubscribeParents();
      unsubscribeAttendance();
      unsubscribeUsers();
    };
  }, [user, userProfile]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn || !email || !password) return;
    setLoginError(null);
    setIsLoggingIn(true);
    
    // If user didn't provide a domain, append a default one for Firebase Auth
    const loginEmail = email.includes('@') ? email : `${email}@maktab.uz`;
    
    try {
      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (error: any) {
      console.error("Auth operation failed:", error);
      let message = "Xatolik yuz berdi.";
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = `Login yoki parol noto'g'ri.`;
      } else if (error.code === 'auth/invalid-email') {
        message = "Login noto'g'ri formatda.";
      } else if (error.code === 'auth/operation-not-allowed') {
        message = "Firebase konsolida 'Email/Password' provayderi yoqilmagan.";
      }
      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const exportToExcel = () => {
    const data = attendance.map(record => ({
      'O\'quvchi': record.studentName,
      'Sinf': record.class,
      'Kelgan vaqti': record.timestamp?.toDate ? format(record.timestamp.toDate(), 'dd.MM.yyyy HH:mm:ss') : 'Noma\'lum',
      'Ketgan vaqti': record.exitTimestamp?.toDate ? format(record.exitTimestamp.toDate(), 'dd.MM.yyyy HH:mm:ss') : '--',
      'Holat': record.status === 'arrived' ? 'Keldi' : 
               record.status === 'left' ? 'Ketdi' : 
               record.status === 'early_exit' ? 'Vaqtidan oldin' :
               'Kechikdi'
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Davomat");
    XLSX.writeFile(workbook, `Davomat_Hisoboti_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-stone-200">
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <QrCode className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Aqlli Davomat</h1>
          <p className="text-stone-500 mb-8">Tizimga kirish uchun login va parolingizni kiriting.</p>
          
          <div className="space-y-6 text-left">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{loginError}</p>
                </div>
              </div>
            )}
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Login</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input 
                    type="text" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Loginni kiriting"
                    className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Parol</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Parolni kiriting"
                    className="w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isLoggingIn ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Tizimga kirish"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-stone-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-stone-200 p-6 flex-col sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl text-stone-900">Aqlli Davomat</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={<ClipboardList className="w-5 h-5" />} 
            label="Dashboard" 
          />
          <NavItem 
            active={activeTab === 'scanner'} 
            onClick={() => setActiveTab('scanner')} 
            icon={<Scan className="w-5 h-5" />} 
            label="Skaner" 
          />
          <NavItem 
            active={activeTab === 'teachers'} 
            onClick={() => setActiveTab('teachers')} 
            icon={<GraduationCap className="w-5 h-5" />} 
            label="O'qituvchilar" 
          />
          <NavItem 
            active={activeTab === 'teacher_logs'} 
            onClick={() => setActiveTab('teacher_logs')} 
            icon={<Clock className="w-5 h-5" />} 
            label="O'qituvchilar Davomati" 
          />
          {(userProfile?.role === 'superadmin' || userProfile?.role === 'director') && (
            <NavItem 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')} 
              icon={<UserCog className="w-5 h-5" />} 
              label="Foydalanuvchilar" 
            />
          )}
        </nav>

        <div className="mt-auto pt-6 border-t border-stone-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="relative">
              {user?.photoURL ? (
                <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="User" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              {(userProfile?.role === 'superadmin' || userProfile?.role === 'director') && (
                <div className="absolute -top-1 -right-1 bg-emerald-600 text-white rounded-full p-0.5">
                  <ShieldCheck className="w-3 h-3" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">{user.displayName}</p>
              <p className="text-xs text-stone-500 truncate capitalize">
                {userProfile?.role === 'superadmin' ? 'Super Admin' : 
                 userProfile?.role === 'director' ? 'Direktor' : 
                 userProfile?.role === 'admin' ? 'Admin' : 'Xodim'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-stone-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-stone-900">Aqlli Davomat</span>
        </div>
        <div className="flex items-center gap-3">
          {user?.photoURL ? (
            <img src={user.photoURL} className="w-8 h-8 rounded-full border border-stone-200" alt="User" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-200">
              {user?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <button 
            onClick={handleLogout}
            className="p-2 text-stone-400 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 pb-24 md:pb-10 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <DashboardView 
            attendance={attendance} 
            onExport={exportToExcel} 
            classes={classes}
            students={students}
            onSelectClass={(id) => setSelectedClassId(id)}
            onAddClass={() => setShowAddClass(true)}
            now={now}
          />
        )}
        {activeTab === 'scanner' && (
          <ScannerView students={students} teachers={teachers} classes={classes} parents={parents} />
        )}
        {activeTab === 'teachers' && (
          <TeachersView 
            teachers={teachers} 
            searchTerm={searchTerm} 
            setSearchTerm={setSearchTerm} 
            onAdd={() => setShowAddTeacher(true)} 
            onEdit={(t) => setEditingTeacher(t)}
            onDelete={handleDeleteTeacher}
          />
        )}
        {activeTab === 'teacher_logs' && (
          <TeacherLogsView attendance={attendance} />
        )}
        {activeTab === 'users' && (userProfile?.role === 'superadmin' || userProfile?.role === 'director') && (
          <UsersView 
            users={allUsers} 
            currentUserRole={userProfile.role}
            currentUserEmail={userProfile.email}
            onUpdateRole={async (userId, newRole) => {
              await updateDoc(doc(db, 'users', userId), { role: newRole });
            }}
            onDeleteUser={async (userId) => {
              setConfirmConfig({
                title: "Foydalanuvchini o'chirish",
                message: "Foydalanuvchini o'chirishga ishonchingiz komilmi?",
                onConfirm: async () => {
                  await deleteDoc(doc(db, 'users', userId));
                  setConfirmConfig(null);
                }
              });
            }}
            onAddUser={() => setShowAddUser(true)}
            onEditUser={(user) => setEditingUser(user)}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-3 flex justify-between items-center z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <MobileNavItem 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          icon={<ClipboardList className="w-6 h-6" />} 
          label="Dashboard" 
        />
        <MobileNavItem 
          active={activeTab === 'scanner'} 
          onClick={() => setActiveTab('scanner')} 
          icon={<Scan className="w-6 h-6" />} 
          label="Skaner" 
        />
        <MobileNavItem 
          active={activeTab === 'teachers'} 
          onClick={() => setActiveTab('teachers')} 
          icon={<GraduationCap className="w-6 h-6" />} 
          label="Ustozlar" 
        />
        <MobileNavItem 
          active={activeTab === 'teacher_logs'} 
          onClick={() => setActiveTab('teacher_logs')} 
          icon={<Clock className="w-6 h-6" />} 
          label="Davomat" 
        />
        {(userProfile?.role === 'superadmin' || userProfile?.role === 'director') && (
          <MobileNavItem 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')} 
            icon={<UserCog className="w-6 h-6" />} 
            label="Adminlar" 
          />
        )}
      </nav>

      {/* Modals */}
      {showAddTeacher && (
        <AddTeacherModal 
          onClose={() => setShowAddTeacher(false)} 
        />
      )}
      {showAddUser && (
        <AddUserModal 
          onClose={() => setShowAddUser(false)} 
          currentUserRole={userProfile?.role || ''}
        />
      )}
      {editingUser && (
        <EditUserModal 
          user={editingUser}
          onClose={() => setEditingUser(null)} 
          currentUserRole={userProfile?.role || ''}
        />
      )}
      {editingTeacher && (
        <EditTeacherModal 
          teacher={editingTeacher}
          onClose={() => setEditingTeacher(null)} 
        />
      )}
      {showAddClass && (
        <AddClassModal 
          onClose={() => setShowAddClass(false)} 
        />
      )}
      {editingClass && (
        <EditClassModal 
          classData={editingClass}
          onClose={() => setEditingClass(null)} 
        />
      )}
      {selectedClassId && (
        <ClassDetailModal 
          classId={selectedClassId}
          classes={classes}
          students={students}
          attendance={attendance}
          onClose={() => setSelectedClassId(null)}
          onEdit={(c) => {
            setEditingClass(c);
            setSelectedClassId(null);
          }}
          onDelete={(id) => {
            handleDeleteClass(id);
            setSelectedClassId(null);
          }}
          parents={parents}
          onConfirm={setConfirmConfig}
          onCloseConfirm={() => setConfirmConfig(null)}
          now={now}
          currentUserRole={userProfile?.role || ''}
        />
      )}
      {confirmConfig && (
        <ConfirmModal 
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
      </div>
    </ErrorBoundary>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium ${
        active 
          ? 'bg-emerald-50 text-emerald-700' 
          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all ${
        active ? 'text-emerald-600' : 'text-stone-400'
      }`}
    >
      <div className={`p-1 rounded-lg ${active ? 'bg-emerald-50' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function BotInfoCard() {
  const [botInfo, setBotInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bot/info')
      .then(res => res.json())
      .then(data => {
        if (data.ok) setBotInfo(data.result);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!botInfo) return null;

  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
          <Send className="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-stone-900">Telegram Bot: @{botInfo.username}</h3>
          <p className="text-stone-500 text-sm">Ota-onalar botga kirib <b>Chat ID</b> olishlari mumkin.</p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
        <a 
          href={`https://t.me/${botInfo.username}`} 
          target="_blank" 
          rel="noreferrer"
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all font-bold text-sm shadow-lg shadow-blue-100"
        >
          <ExternalLink className="w-4 h-4" /> Botni ochish
        </a>
        <div className="bg-stone-50 px-6 py-3 rounded-xl border border-stone-100 text-stone-600 text-sm font-medium text-center">
          Botga <b>/start</b> buyrug'ini yuboring
        </div>
      </div>
    </div>
  );
}

function DashboardView({ 
  attendance, 
  onExport, 
  classes, 
  students, 
  onSelectClass, 
  onAddClass,
  now
}: { 
  attendance: AttendanceRecord[], 
  onExport: () => void,
  classes: Class[],
  students: Student[],
  onSelectClass: (id: string) => void,
  onAddClass: () => void,
  now: Date
}) {
  const [view, setView] = useState<'teachers' | 'classes'>('classes');
  const [selectedDate, setSelectedDate] = useState(format(now, 'yyyy-MM-dd'));
  
  // Update selectedDate if it's today and the day changed
  useEffect(() => {
    const todayStr = format(now, 'yyyy-MM-dd');
    if (selectedDate !== todayStr && new Date(selectedDate).setHours(0,0,0,0) < now.setHours(0,0,0,0)) {
      // Only auto-update if it was set to a previous day and we want to follow 'today'
      // Actually, better to just let the user decide or have a 'Today' button.
      // For now, let's just keep it as is but provide the picker.
    }
  }, [now]);

  const startOfDay = new Date(selectedDate).setHours(0,0,0,0);
  const endOfDay = new Date(selectedDate).setHours(23,59,59,999);
  
  const dayAttendance = attendance.filter(r => {
    if (!r.timestamp?.toDate) return false;
    const t = r.timestamp.toDate().getTime();
    return t >= startOfDay && t <= endOfDay;
  });
  
  const filteredAttendance = dayAttendance.filter(r => 
    view === 'classes' ? (r.userType === 'student' || !r.userType) : r.userType === 'teacher'
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <BotInfoCard />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-stone-900">Dashboard</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-stone-500">
              {selectedDate === format(now, 'yyyy-MM-dd') ? 'Bugungi' : format(new Date(selectedDate), 'dd.MM.yyyy')} davomat holati
            </p>
            <div className="relative flex items-center">
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
              />
              <Calendar className="w-4 h-4 text-emerald-600 cursor-pointer" />
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="bg-white p-1 rounded-xl border border-stone-200 flex w-full sm:w-auto">
            <button 
              onClick={() => setView('classes')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'classes' ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-500 hover:bg-stone-50'}`}
            >
              Sinflar
            </button>
            <button 
              onClick={() => setView('teachers')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'teachers' ? 'bg-emerald-600 text-white shadow-md' : 'text-stone-500 hover:bg-stone-50'}`}
            >
              Ustozlar
            </button>
          </div>
          <button 
            onClick={onExport}
            className="flex items-center justify-center gap-2 bg-white border border-stone-200 px-6 py-3 rounded-xl hover:bg-stone-50 transition-all font-medium text-stone-700 shadow-sm text-sm"
          >
            <Download className="w-4 h-4 md:w-5 md:h-5" />
            Excelga yuklash
          </button>
        </div>
      </div>

      {view === 'classes' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-stone-900">Sinflar ro'yxati</h3>
            <button 
              onClick={onAddClass}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-lg shadow-emerald-100"
            >
              <Plus className="w-4 h-4" />
              Sinf qo'shish
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {classes.map(c => {
              const classStudents = students.filter(s => s.class === c.name);
              const classAttendance = dayAttendance.filter(r => r.class === c.name);
              const presentToday = classAttendance.filter(r => r.type === 'entry').length;
              const lateToday = classAttendance.filter(r => r.status === 'late').length;
              const earlyToday = classAttendance.filter(r => r.status === 'early_exit').length;
              
              return (
                <button 
                  key={c.id}
                  onClick={() => onSelectClass(c.id)}
                  className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all text-left group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                      <Users className="w-6 h-6 text-stone-600 group-hover:text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">{c.name}</span>
                  </div>
                  <h4 className="text-xl font-bold text-stone-900 mb-1">{c.name} sinfi</h4>
                  <p className="text-stone-500 text-sm mb-4 line-clamp-1">Rahbar: {c.classTeacher}</p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-50">
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">O'quvchilar</p>
                      <p className="text-lg font-bold text-stone-900">{classStudents.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Bugun kelgan</p>
                      <p className="text-lg font-bold text-emerald-600">{presentToday}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Kechikkanlar</p>
                      <p className="text-lg font-bold text-amber-600">{lateToday}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Vaqtidan oldin</p>
                      <p className="text-lg font-bold text-red-600">{earlyToday}</p>
                    </div>
                  </div>
                </button>
              );
            })}
            {classes.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-stone-200">
                <p className="text-stone-400">Hali hech qanday sinf qo'shilmagan</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            <StatCard 
              title={view === 'classes' ? "Bugun kelgan o'quvchilar" : "Bugun kelgan o'qituvchilar"} 
              value={filteredAttendance.filter(r => r.type === 'entry').length.toString()} 
              icon={<CheckCircle2 className="text-emerald-600" />} 
              bgColor="bg-emerald-50" 
            />
            <StatCard 
              title="Kechikkanlar" 
              value={filteredAttendance.filter(r => r.status === 'late').length.toString()} 
              icon={<Clock className="text-amber-600" />} 
              bgColor="bg-amber-50" 
            />
            <StatCard 
              title="Tark etganlar" 
              value={filteredAttendance.filter(r => r.type === 'exit').length.toString()} 
              icon={<LogOut className="text-blue-600" />} 
              bgColor="bg-blue-50" 
            />
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-stone-900">{view === 'classes' ? "O'quvchilar harakati" : "O'qituvchilar harakati"}</h3>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Real vaqt</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">{view === 'classes' ? "O'quvchi" : "O'qituvchi"}</th>
                    <th className="px-6 py-4">{view === 'classes' ? "Sinf" : "Fan"}</th>
                    <th className="px-6 py-4">Kelgan vaqti</th>
                    <th className="px-6 py-4">Ketgan vaqti</th>
                    <th className="px-6 py-4">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredAttendance.map(record => (
                    <tr key={record.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-stone-900">{record.studentName}</td>
                      <td className="px-6 py-4 text-stone-500">{record.class}</td>
                      <td className="px-6 py-4 text-stone-500">
                        {record.timestamp?.toDate ? format(record.timestamp.toDate(), 'HH:mm:ss') : '--'}
                      </td>
                      <td className="px-6 py-4 text-stone-500">
                        {record.exitTimestamp?.toDate ? format(record.exitTimestamp.toDate(), 'HH:mm:ss') : '--'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          record.status === 'arrived' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : record.status === 'left'
                            ? 'bg-stone-100 text-stone-700'
                            : record.status === 'early_exit'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {record.status === 'arrived' ? 'Keldi' : 
                           record.status === 'left' ? 'Ketdi' : 
                           record.status === 'early_exit' ? 'Vaqtidan oldin' :
                           'Kechikdi'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredAttendance.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-stone-400">
                        Bugun hali hech kim qayd etilmadi
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, bgColor }: { title: string, value: string, icon: React.ReactNode, bgColor: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex items-center gap-4">
      <div className={`w-14 h-14 ${bgColor} rounded-2xl flex items-center justify-center`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-7 h-7' })}
      </div>
      <div>
        <p className="text-stone-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-stone-900">{value}</p>
      </div>
    </div>
  );
}

// Error Boundary Component
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  public state: { hasError: boolean, error: any };
  public props: { children: React.ReactNode };

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-stone-200">
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-stone-900 mb-2">Xatolik yuz berdi</h2>
            <p className="text-stone-500 mb-8">Ilovada kutilmagan xatolik yuz berdi. Iltimos, sahifani yangilang.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-600 text-white font-semibold py-4 rounded-2xl transition-all"
            >
              Sahifani yangilash
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScannerView({ students, teachers, classes, parents }: { students: Student[], teachers: Teacher[], classes: Class[], parents: Parent[] }) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [scanMessage, setScanMessage] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string | null>(null);

  const sendTelegramNotification = async (chatId: string, message: string) => {
    try {
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
      });
    } catch (error) {
      console.error("Notification error:", error);
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    try {
      // Stop any existing scanner first
      await stopScanner();

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };
      
      await html5QrCodeRef.current.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText) => onScanSuccess(decodedText),
        () => {} // ignore scan failures
      );
      setIsScanning(true);
    } catch (err) {
      console.error("Scanner start error:", err);
      setCameraError("Kameraga ulanib bo'lmadi. Iltimos, ruxsat berilganini tekshiring yoki ilovani yangi oynada oching.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
        setIsScanning(false);
      } catch (err) {
        console.error("Scanner stop error:", err);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  async function onScanSuccess(decodedText: string) {
    if (status !== 'idle') return;
    if (lastScannedRef.current === decodedText) return;
    
    lastScannedRef.current = decodedText;
    try {
      let searchId = decodedText;
      let qrName = '';
      let qrClass = '';
      let qrPhone = '';

      if (decodedText.includes('|')) {
        const parts = decodedText.split('|');
        qrName = parts[0];
        qrClass = parts[1];
        searchId = parts[2];
        qrPhone = parts[3] || '';
      }

      let student = students.find(s => s.studentId === searchId);
      let teacher = teachers.find(t => t.teacherId === searchId);
      
      // Auto-registration logic
      if (!student && !teacher && qrName && qrClass && searchId) {
        // Check if this ID was already registered while we were scanning
        const existingStudent = students.find(s => s.studentId === searchId);
        if (existingStudent) {
          student = existingStudent;
        } else {
          // Create a placeholder parent
          const parentRef = await addDoc(collection(db, 'parents'), {
            name: `${qrName} ota/onasi`,
            phone: qrPhone || 'Kiritilmagan',
            studentIds: [searchId]
          });

          // Create the student
          const studentData = {
            name: qrName,
            class: qrClass,
            studentId: searchId,
            parentId: parentRef.id,
            createdAt: new Date().toISOString()
          };
          
          await addDoc(collection(db, 'students'), studentData);
          student = { id: 'temp', ...studentData } as Student;
        }
      }
      
      if (!student && !teacher) {
        setStatus('error');
        setScanMessage("Foydalanuvchi topilmadi");
        setTimeout(() => {
          setStatus('idle');
          lastScannedRef.current = null;
        }, 3000);
        return;
      }

      const user = student || teacher;
      const userType = student ? 'student' : 'teacher';
      const userId = student ? student.studentId : teacher!.teacherId;
      const userName = user!.name;
      const userClass = student ? student.class : teacher!.subject;

      // Find class schedule
      const classData = student ? classes.find(c => c.name === student.class) : null;
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Bugungi davomatni tekshirish
      const q = query(
        collection(db, 'attendance'),
        where('studentId', '==', userId),
        where('timestamp', '>=', today),
        where('timestamp', '<', tomorrow)
      );
      
      const querySnapshot = await getDocs(q);
      const existingRecords = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      
      // Eng oxirgi yozuvni topish
      const latestRecord = existingRecords.sort((a, b) => {
        const timeA = (a.timestamp as any)?.seconds || 0;
        const timeB = (b.timestamp as any)?.seconds || 0;
        return timeB - timeA;
      })[0];

      if (latestRecord && latestRecord.type === 'entry' && !latestRecord.exitTimestamp) {
        // Chiqishni qayd etish
        let isEarly = false;
        if (classData) {
          const day = now.getDay();
          const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayKey = keys[day];
          const lessonsToday = classData.dailySchedule?.[dayKey as keyof typeof classData.dailySchedule] || 0;
          const endTime = calculateEndTime(classData.startTime, lessonsToday);
          
          if (endTime !== '--:--') {
            const [endH, endM] = endTime.split(':').map(Number);
            const endMinutes = endH * 60 + endM;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            if (currentMinutes < endMinutes) {
              isEarly = true;
            }
          }
        }

        await updateDoc(doc(db, 'attendance', latestRecord.id), {
          exitTimestamp: serverTimestamp(),
          status: isEarly ? 'early_exit' : 'left',
          type: 'exit'
        });
        
        const exitMsg = `${userName}: ${isEarly ? "Vaqtidan oldin ketdi" : "Maktabni tark etdi"}`;
        setScanMessage(exitMsg);

        // Send notification to parent
        if (student) {
          const parent = parents.find(p => p.id === student.parentId);
          if (parent?.telegramChatId) {
            const telegramMsg = `🔔 <b>Davomat xabari</b>\n\n👤 O'quvchi: <b>${userName}</b>\n🏫 Sinf: <b>${userClass}</b>\n🕒 Vaqt: <b>${new Date().toLocaleTimeString()}</b>\n📝 Holat: <b>${isEarly ? "Vaqtidan oldin ketdi" : "Maktabni tark etdi"}</b>`;
            sendTelegramNotification(parent.telegramChatId, telegramMsg);
          } else if (parent) {
            setScanMessage(prev => `${prev}\n⚠️ Telegram sozlanmagan!`);
          }
        }
      } else {
        // Kirishni qayd etish
        let isLate = false;
        if (classData) {
          const [startH, startM] = classData.startTime.split(':').map(Number);
          const startMinutes = startH * 60 + startM;
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          if (currentMinutes > startMinutes + 15) { // 15 minutdan ko'p kechiksa
            isLate = true;
          }
        } else if (userType === 'student') {
          // Fallback for students without class data
          const minutes = now.getHours() * 60 + now.getMinutes();
          isLate = minutes > (8 * 60 + 30);
        }

        await addDoc(collection(db, 'attendance'), {
          studentId: userId,
          studentName: userName,
          class: userClass,
          timestamp: serverTimestamp(),
          status: isLate ? 'late' : 'arrived',
          type: 'entry',
          userType: userType
        });

        const entryMsg = `${userName}: ${isLate ? "Kechikib keldi" : "Maktabga keldi"}`;
        setScanMessage(entryMsg);

        // Send notification to parent
        if (student) {
          const parent = parents.find(p => p.id === student.parentId);
          if (parent?.telegramChatId) {
            const telegramMsg = `🔔 <b>Davomat xabari</b>\n\n👤 O'quvchi: <b>${userName}</b>\n🏫 Sinf: <b>${userClass}</b>\n🕒 Vaqt: <b>${new Date().toLocaleTimeString()}</b>\n📝 Holat: <b>${isLate ? "Kechikib keldi" : "Maktabga keldi"}</b>`;
            sendTelegramNotification(parent.telegramChatId, telegramMsg);
          } else if (parent) {
            setScanMessage(prev => `${prev}\n⚠️ Telegram sozlanmagan!`);
          }
        }
      }

      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        lastScannedRef.current = null;
      }, 3000);
      
    } catch (error) {
      console.error("Scan processing error:", error);
      setStatus('error');
      setScanMessage("Xatolik yuz berdi");
      lastScannedRef.current = null; // Clear on error to allow retry
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-stone-900">QR Skaner</h2>
        <p className="text-sm text-stone-500">O'quvchi QR-kodini kameraga qarating</p>
      </div>

      <div className="relative aspect-square w-full max-w-[320px] md:max-w-md mx-auto">
        <div 
          id="reader" 
          className="w-full h-full overflow-hidden rounded-3xl border-4 border-white shadow-2xl bg-black"
        ></div>
        
        {!isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-900 rounded-3xl z-10 p-6">
            {!cameraError ? (
              <button 
                onClick={startScanner}
                className="w-full bg-emerald-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl"
              >
                <Scan className="w-6 h-6" />
                Kamerani yoqish
              </button>
            ) : (
              <div className="text-center text-white">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <p className="text-sm font-medium mb-4">{cameraError}</p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={startScanner}
                    className="bg-white text-stone-900 px-5 py-2.5 rounded-xl font-bold hover:bg-stone-100 transition-all text-sm"
                  >
                    Qayta urinish
                  </button>
                  <a 
                    href={window.location.href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-400 text-xs font-bold hover:underline"
                  >
                    Yangi oynada ochish
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
        
        {status === 'success' && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/90 rounded-3xl animate-in fade-in duration-300 z-20">
            <div className="text-center text-white">
              <CheckCircle2 className="w-20 h-20 mx-auto mb-4" />
              <p className="text-2xl font-bold">{scanMessage}</p>
              <p className="opacity-80">Muvaffaqiyatli qayd etildi</p>
            </div>
          </div>
        )}
        
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-600/90 rounded-3xl animate-in fade-in duration-300 z-20">
            <div className="text-center text-white">
              <AlertCircle className="w-20 h-20 mx-auto mb-4" />
              <p className="text-2xl font-bold">Xatolik</p>
              <p className="opacity-80">{scanMessage || "Qayta urinib ko'ring"}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
        <h4 className="font-bold text-stone-900 mb-2">Skaner ishlamay qolsa:</h4>
        <div className="space-y-4">
          <p className="text-stone-500 text-sm">
            1. Kamerani o'chirib, qayta yoqing.<br />
            2. Sahifani yangilang.<br />
            3. Ilovani yangi oynada oching (brauzer ruxsatlari uchun).
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button 
              onClick={stopScanner}
              className="px-4 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all text-sm"
            >
              Skanerni to'xtatish
            </button>
            <button 
              onClick={startScanner}
              className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold hover:bg-emerald-200 transition-all text-sm"
            >
              Qayta ishga tushirish
            </button>
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all text-sm flex items-center gap-2"
            >
              Yangi oynada ochish <Scan className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeachersView({ 
  teachers, 
  searchTerm, 
  setSearchTerm, 
  onAdd, 
  onEdit,
  onDelete 
}: { 
  teachers: Teacher[], 
  searchTerm: string, 
  setSearchTerm: (s: string) => void, 
  onAdd: () => void,
  onEdit: (t: Teacher) => void,
  onDelete: (id: string) => void
}) {
  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">O'qituvchilar</h2>
          <p className="text-stone-500">O'qituvchilar ro'yxati va boshqaruvi</p>
        </div>
        <button 
          onClick={onAdd}
          className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-all font-bold shadow-lg shadow-emerald-100"
        >
          <Plus className="w-5 h-5" />
          Yangi o'qituvchi
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="O'qituvchi ismi yoki fani bo'yicha qidirish..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-stone-200 pl-12 pr-4 py-4 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map(teacher => (
          <div key={teacher.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => onEdit(teacher)}
                  className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(teacher.id)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h4 className="font-bold text-lg text-stone-900 mb-1">{teacher.name}</h4>
            <p className="text-stone-500 text-sm mb-4">{teacher.subject}</p>
            <div className="pt-4 border-t border-stone-50 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">ID: {teacher.teacherId}</span>
              <div className="p-2 bg-stone-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <QrCode className="w-4 h-4 text-stone-400" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddTeacherModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const teacherId = `TR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      await addDoc(collection(db, 'teachers'), {
        name,
        subject,
        teacherId,
        createdAt: new Date().toISOString()
      });

      // Generate QR via Backend
      const response = await fetch('/api/students/register', { // Reusing the same endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, className: subject, studentId: teacherId })
      });
      
      const data = await response.json();
      if (data.qrCode) {
        setGeneratedQR(data.qrCode);
      } else {
        onClose();
      }
    } catch (error) {
      console.error("Error adding teacher:", error);
      alert("Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadQR = () => {
    if (!generatedQR) return;
    const link = document.createElement('a');
    link.href = generatedQR;
    link.download = `QR_O'qituvchi_${name}.png`;
    link.click();
  };

  if (generatedQR) {
    return (
      <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-50 animate-in fade-in duration-300 overflow-y-auto">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center my-auto animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-stone-900 mb-2">Muvaffaqiyatli!</h3>
          <p className="text-stone-500 mb-8">O'qituvchi ro'yxatga olindi va QR-kod yaratildi.</p>
          
          <div className="bg-stone-50 p-6 rounded-2xl mb-8 border border-stone-100">
            <img src={generatedQR} alt="QR Code" className="w-48 h-auto mx-auto shadow-sm rounded-lg" />
            <p className="mt-4 font-bold text-stone-900">{name}</p>
            <p className="text-sm text-stone-500">{subject}</p>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={downloadQR}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
            >
              <Download className="w-5 h-5" />
              QR-kodni yuklab olish
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-all"
            >
              Yopish
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-50 animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 my-auto animate-in zoom-in-95 duration-300">
        <h3 className="text-2xl font-bold text-stone-900 mb-6">Yangi o'qituvchi qo'shish</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">F.I.SH</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Masalan: Sobir Rahimov"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Fan</label>
            <input 
              required
              type="text" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Masalan: Matematika"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-all"
            >
              Bekor qilish
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTeacherModal({ teacher, onClose }: { teacher: Teacher, onClose: () => void }) {
  const [name, setName] = useState(teacher.name);
  const [subject, setSubject] = useState(teacher.subject);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'teachers', teacher.id), {
        name,
        subject
      });
      onClose();
    } catch (error) {
      console.error("Error updating teacher:", error);
      alert("Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-50 animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 my-auto animate-in zoom-in-95 duration-300">
        <h3 className="text-2xl font-bold text-stone-900 mb-6">O'qituvchi ma'lumotlarini tahrirlash</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">F.I.SH</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Fan</label>
            <input 
              required
              type="text" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-all"
            >
              Bekor qilish
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddClassModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [classTeacher, setClassTeacher] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [dailySchedule, setDailySchedule] = useState({
    monday: 6,
    tuesday: 6,
    wednesday: 6,
    thursday: 6,
    friday: 6,
    saturday: 5
  });
  const [startTime, setStartTime] = useState('08:00');
  const [submitting, setSubmitting] = useState(false);

  const getCurrentDayKey = () => {
    const day = new Date().getDay();
    const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return keys[day];
  };

  const calculatedEndTime = calculateEndTime(startTime, dailySchedule[getCurrentDayKey() as keyof typeof dailySchedule] || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'classes'), {
        name,
        classTeacher,
        weeklyHours: Number(weeklyHours),
        dailySchedule,
        startTime,
        endTime: calculatedEndTime,
        createdAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      console.error("Error adding class:", error);
      alert("Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const days = [
    { key: 'monday', label: 'Dushanba' },
    { key: 'tuesday', label: 'Seshanba' },
    { key: 'wednesday', label: 'Chorshanba' },
    { key: 'thursday', label: 'Payshanba' },
    { key: 'friday', label: 'Juma' },
    { key: 'saturday', label: 'Shanba' },
  ];

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-50 animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 my-auto animate-in zoom-in-95 duration-300">
        <h3 className="text-2xl font-bold text-stone-900 mb-6">Yangi sinf qo'shish</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Sinf nomi</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Masalan: 11-A"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Sinf rahbari</label>
            <input 
              required
              type="text" 
              value={classTeacher}
              onChange={(e) => setClassTeacher(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Masalan: Alisher Navoiy"
            />
          </div>
          
          <div className="space-y-3">
            <label className="block text-sm font-bold text-stone-700">Kunlik dars soatlari</label>
            <div className="grid grid-cols-2 gap-3">
              {days.map(day => (
                <div key={day.key}>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">{day.label}</label>
                  <input 
                    required
                    type="number" 
                    value={dailySchedule[day.key as keyof typeof dailySchedule]}
                    onChange={(e) => setDailySchedule({ ...dailySchedule, [day.key]: Number(e.target.value) })}
                    className="w-full border border-stone-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Haftalik umumiy dars soati</label>
            <input 
              required
              type="number" 
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Masalan: 30"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-1">Dars boshlanishi</label>
              <input 
                required
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-1">Dars tugashi (Avto)</label>
              <div className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl text-stone-600 font-bold">
                {calculatedEndTime}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Bugungi dars soatiga qarab hisoblandi</p>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-all"
            >
              Bekor qilish
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditClassModal({ classData, onClose }: { classData: Class, onClose: () => void }) {
  const [name, setName] = useState(classData.name);
  const [classTeacher, setClassTeacher] = useState(classData.classTeacher);
  const [weeklyHours, setWeeklyHours] = useState(classData.weeklyHours.toString());
  const [dailySchedule, setDailySchedule] = useState(classData.dailySchedule || {
    monday: 6,
    tuesday: 6,
    wednesday: 6,
    thursday: 6,
    friday: 6,
    saturday: 5
  });
  const [startTime, setStartTime] = useState(classData.startTime);
  const [submitting, setSubmitting] = useState(false);

  const getCurrentDayKey = () => {
    const day = new Date().getDay();
    const keys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return keys[day];
  };

  const calculatedEndTime = calculateEndTime(startTime, dailySchedule[getCurrentDayKey() as keyof typeof dailySchedule] || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'classes', classData.id), {
        name,
        classTeacher,
        weeklyHours: Number(weeklyHours),
        dailySchedule,
        startTime,
        endTime: calculatedEndTime
      });
      onClose();
    } catch (error) {
      console.error("Error updating class:", error);
      alert("Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const days = [
    { key: 'monday', label: 'Dushanba' },
    { key: 'tuesday', label: 'Seshanba' },
    { key: 'wednesday', label: 'Chorshanba' },
    { key: 'thursday', label: 'Payshanba' },
    { key: 'friday', label: 'Juma' },
    { key: 'saturday', label: 'Shanba' },
  ];

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-50 animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 my-auto animate-in zoom-in-95 duration-300">
        <h3 className="text-2xl font-bold text-stone-900 mb-6">Sinf ma'lumotlarini tahrirlash</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Sinf nomi</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Sinf rahbari</label>
            <input 
              required
              type="text" 
              value={classTeacher}
              onChange={(e) => setClassTeacher(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-stone-700">Kunlik dars soatlari</label>
            <div className="grid grid-cols-2 gap-3">
              {days.map(day => (
                <div key={day.key}>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">{day.label}</label>
                  <input 
                    required
                    type="number" 
                    value={dailySchedule[day.key as keyof typeof dailySchedule]}
                    onChange={(e) => setDailySchedule({ ...dailySchedule, [day.key]: Number(e.target.value) })}
                    className="w-full border border-stone-200 px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Haftalik umumiy dars soati</label>
            <input 
              required
              type="number" 
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-1">Dars boshlanishi</label>
              <input 
                required
                type="time" 
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-stone-700 mb-1">Dars tugashi (Avto)</label>
              <div className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl text-stone-600 font-bold">
                {calculatedEndTime}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Bugungi dars soatiga qarab hisoblandi</p>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-all"
            >
              Bekor qilish
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClassDetailModal({ 
  classId, 
  classes, 
  students, 
  attendance, 
  onClose, 
  onEdit, 
  onDelete,
  parents,
  onConfirm,
  onCloseConfirm,
  now,
  currentUserRole
}: { 
  classId: string, 
  classes: Class[], 
  students: Student[], 
  attendance: AttendanceRecord[], 
  onClose: () => void,
  onEdit: (c: Class) => void,
  onDelete: (id: string) => void,
  parents: Parent[],
  onConfirm: (config: { title: string; message: string; onConfirm: () => void }) => void,
  onCloseConfirm: () => void,
  now: Date,
  currentUserRole: string
}) {
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newTelegramChatId, setNewTelegramChatId] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(now, 'yyyy-MM-dd'));
  
  const classData = classes.find(c => c.id === classId);
  if (!classData) return null;

  const handleGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !newStudentPhone.trim()) return;
    
    setGenerating(true);
    try {
      const studentId = editingStudent ? editingStudent.studentId : `ST-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      // 1. Save/Update in Firestore immediately
      if (editingStudent) {
        await updateDoc(doc(db, 'students', editingStudent.id), {
          name: newStudentName,
        });
        
        // Update parent info if needed
        if (editingStudent.parentId) {
          await updateDoc(doc(db, 'parents', editingStudent.parentId), {
            name: `${newStudentName} ota/onasi`,
            phone: newStudentPhone,
            telegramChatId: newTelegramChatId || null
          });
        }
      } else {
        const parentRef = await addDoc(collection(db, 'parents'), {
          name: `${newStudentName} ota/onasi`,
          phone: newStudentPhone,
          telegramChatId: newTelegramChatId || null,
          studentIds: [studentId]
        });

        await addDoc(collection(db, 'students'), {
          name: newStudentName,
          class: classData.name,
          studentId,
          parentId: parentRef.id,
          createdAt: new Date().toISOString()
        });
      }

      // 2. Generate QR for the student
      const response = await fetch('/api/students/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newStudentName, 
          className: classData.name, 
          studentId,
          phone: newStudentPhone
        })
      });
      
      const data = await response.json();
      if (data.qrCode) {
        setGeneratedQR(data.qrCode);
        setShowAddModal(false);
        if (!editingStudent) {
          // Keep name for the success view, but clear phone
          setNewStudentPhone('');
        }
      }
    } catch (error) {
      console.error("Student save/QR error:", error);
      alert("Xatolik yuz berdi");
    } finally {
      setGenerating(false);
    }
  };

  const downloadQR = () => {
    if (!generatedQR) return;
    const link = document.createElement('a');
    link.href = generatedQR;
    link.download = `QR_${newStudentName}_${classData.name}.png`;
    link.click();
  };

  const handleDeleteStudent = async (student: Student) => {
    onConfirm({
      title: "O'quvchini o'chirish",
      message: `${student.name}ni o'chirishga ishonchingiz komilmi?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'students', student.id));
          if (student.parentId) {
            await deleteDoc(doc(db, 'parents', student.parentId));
          }
          onCloseConfirm();
        } catch (error) {
          console.error("Delete student error:", error);
          alert("O'chirishda xatolik yuz berdi");
        }
      }
    });
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setNewStudentName(student.name);
    const parent = parents.find(p => p.id === student.parentId);
    setNewStudentPhone(parent?.phone || ''); 
    setNewTelegramChatId(parent?.telegramChatId || '');
    setShowAddModal(true);
  };

  const classStudents = students.filter(s => s.class === classData.name);
  const startOfDay = new Date(selectedDate).setHours(0,0,0,0);
  const endOfDay = new Date(selectedDate).setHours(23,59,59,999);
  
  const dayAttendance = attendance.filter(r => 
    r.class === classData.name && 
    r.timestamp?.toDate && 
    r.timestamp.toDate().getTime() >= startOfDay && 
    r.timestamp.toDate().getTime() <= endOfDay
  );
  
  const presentToday = dayAttendance.filter(r => r.type === 'entry').length;

  const days = [
    { key: 'monday', label: 'Dushanba' },
    { key: 'tuesday', label: 'Seshanba' },
    { key: 'wednesday', label: 'Chorshanba' },
    { key: 'thursday', label: 'Payshanba' },
    { key: 'friday', label: 'Juma' },
    { key: 'saturday', label: 'Shanba' },
  ];

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-50 animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-300">
        <div className="bg-emerald-600 p-6 md:p-8 text-white relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Users className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl md:text-4xl font-bold">{classData.name} sinfi</h3>
                <p className="text-emerald-100 text-sm md:text-lg">Sinf rahbari: {classData.classTeacher}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 p-3 md:p-4 rounded-2xl transition-all flex items-center justify-center gap-2 font-bold text-sm md:text-base"
            >
              <Plus className="w-5 h-5 md:w-6 md:h-6 rotate-45" />
              <span>Yopish</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 md:gap-8 pt-6 md:pt-8 border-t border-white/20">
            <div className="bg-white/10 p-3 md:p-4 rounded-2xl text-center md:text-left">
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Jami o'quvchilar</p>
              <p className="text-xl md:text-3xl font-bold">{classStudents.length} ta</p>
            </div>
            <div className="bg-white/10 p-3 md:p-4 rounded-2xl text-center md:text-left">
              <p className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-emerald-200 mb-1">Bugun kelganlar</p>
              <p className="text-xl md:text-3xl font-bold">{presentToday} ta</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 space-y-8 md:space-y-10">
          {/* Daily Schedule Section */}
          <div className="space-y-4">
            <h4 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-emerald-600" />
              Haftalik dars soatlari
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {days.map(day => {
                const lessons = classData.dailySchedule?.[day.key as keyof typeof classData.dailySchedule] || 0;
                const endTime = calculateEndTime(classData.startTime, lessons);
                return (
                  <div key={day.key} className="bg-stone-50 p-4 rounded-2xl border border-stone-100 text-center">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">{day.label}</p>
                    <p className="text-xl font-bold text-stone-900">
                      {lessons}
                    </p>
                    <p className="text-[10px] text-stone-400">soat</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1">{endTime}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Student List Section */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h4 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-600" />
                O'quvchilar ro'yxati va davomat
              </h4>
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase self-start">
                <span>{selectedDate === format(now, 'yyyy-MM-dd') ? 'Bugun' : format(new Date(selectedDate), 'dd.MM.yyyy')}:</span>
                <div className="relative flex items-center">
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                  />
                  <Calendar className="w-4 h-4 cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Add Student Section */}
            {(currentUserRole === 'superadmin' || currentUserRole === 'admin' || currentUserRole === 'director') && (
              <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Yangi o'quvchi qo'shish</h5>
                  {generatedQR && (
                    <button 
                      onClick={() => {
                        setGeneratedQR(null);
                        setNewStudentName('');
                        setNewStudentPhone('');
                      }}
                      className="text-emerald-600 text-xs font-bold hover:underline"
                    >
                      Tozalash
                    </button>
                  )}
                </div>

                {!generatedQR ? (
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="w-full bg-white border-2 border-dashed border-stone-200 p-8 rounded-2xl text-stone-400 hover:border-emerald-500 hover:text-emerald-600 transition-all flex flex-col items-center gap-2 group"
                  >
                    <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <span className="font-bold">O'quvchi qo'shish uchun bosing</span>
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6 animate-in fade-in slide-in-from-top-2">
                    <img src={generatedQR} alt="QR" className="w-32 h-32 rounded-xl shadow-sm border border-stone-200" />
                    <div className="flex-1 text-center sm:text-left">
                      <p className="font-bold text-stone-900 text-lg">{newStudentName}</p>
                      <p className="text-stone-500 text-sm mb-4">QR-kod tayyor. O'quvchi birinchi marta skaner qilganida avtomatik ro'yxatga olinadi.</p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <button 
                          onClick={downloadQR}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" /> Yuklab olish
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Small Alert / Modal for Adding Student */}
            {showAddModal && (
              <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-[60] animate-in fade-in duration-200 overflow-y-auto">
                <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 my-auto animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-stone-900">
                      {editingStudent ? "O'quvchini tahrirlash" : "O'quvchi ma'lumotlari"}
                    </h3>
                    <button 
                      onClick={() => {
                        setShowAddModal(false);
                        setEditingStudent(null);
                        setNewStudentName('');
                        setNewStudentPhone('');
                        setNewTelegramChatId('');
                      }} 
                      className="text-stone-400 hover:text-stone-600"
                    >
                      <Plus className="w-6 h-6 rotate-45" />
                    </button>
                  </div>
                  <form onSubmit={handleGenerateQR} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Ism familiyasi</label>
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="Masalan: Ali Valiyev" 
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Telefon raqami</label>
                      <input 
                        type="tel" 
                        placeholder="+998 90 123 45 67" 
                        value={newStudentPhone}
                        onChange={(e) => setNewStudentPhone(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Telegram Chat ID (Ixtiyoriy)</label>
                      <input 
                        type="text" 
                        placeholder="Masalan: 123456789" 
                        value={newTelegramChatId}
                        onChange={(e) => setNewTelegramChatId(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                      />
                      <p className="text-[10px] text-stone-400 mt-1">Ota-ona botga /start bosganda oladigan raqami</p>
                    </div>
                    <button 
                      type="submit"
                      disabled={generating || !newStudentName.trim() || !newStudentPhone.trim()}
                      className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                    >
                      {editingStudent ? <Edit2 className="w-5 h-5" /> : <QrCode className="w-5 h-5" />}
                      {generating ? "Saqlanmoqda..." : (editingStudent ? "Saqlash" : "QR-kod yaratish")}
                    </button>
                  </form>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-stone-50 z-10">
                    <tr className="text-stone-500 text-[10px] font-bold uppercase tracking-wider border-b border-stone-100">
                      <th className="px-6 py-4">F.I.SH</th>
                      <th className="px-6 py-4">Kelgan vaqti</th>
                      <th className="px-6 py-4">Ketgan vaqti</th>
                      <th className="px-6 py-4">Holat</th>
                      <th className="px-6 py-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {classStudents.map(student => {
                      const record = dayAttendance.find(r => r.studentId === student.studentId);
                      return (
                        <tr key={student.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-stone-900">{student.name}</p>
                            <p className="text-[10px] text-stone-400 uppercase tracking-wider">ID: {student.studentId}</p>
                          </td>
                          <td className="px-6 py-4 text-stone-500 text-sm">
                            {record?.timestamp?.toDate ? format(record.timestamp.toDate(), 'HH:mm:ss') : '--:--'}
                          </td>
                          <td className="px-6 py-4 text-stone-500 text-sm">
                            {record?.exitTimestamp?.toDate ? format(record.exitTimestamp.toDate(), 'HH:mm:ss') : '--:--'}
                          </td>
                          <td className="px-6 py-4">
                            {record ? (
                              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                                record.status === 'arrived' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : record.status === 'left'
                                  ? 'bg-stone-100 text-stone-700'
                                  : record.status === 'early_exit'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {record.status === 'arrived' ? 'Keldi' : 
                                 record.status === 'left' ? 'Ketdi' : 
                                 record.status === 'early_exit' ? 'Vaqtidan oldin' :
                                 'Kechikdi'}
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-red-50 text-red-600">
                                Kelmadi
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => openEditModal(student)}
                                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Tahrirlash"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteStudent(student)}
                                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="O'chirish"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {classStudents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-stone-400">
                          Ushbu sinfda o'quvchilar mavjud emas
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-stone-100">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
            >
              <Plus className="w-5 h-5 rotate-45" />
              Asosiy sahifaga qaytish
            </button>
            <div className="flex flex-1 gap-4">
              <button 
                onClick={() => onEdit(classData)}
                className="flex-1 py-4 bg-stone-100 text-stone-700 rounded-2xl font-bold hover:bg-stone-200 transition-all flex items-center justify-center gap-2"
              >
                <Edit className="w-5 h-5" />
                Tahrirlash
              </button>
              <button 
                onClick={() => onDelete(classData.id)}
                className="flex-1 py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Sinfni o'chirish
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherLogsView({ attendance }: { attendance: AttendanceRecord[] }) {
  const teacherAttendance = attendance.filter(r => r.userType === 'teacher');
  
  const exportTeacherLogs = () => {
    const data = teacherAttendance.map(record => ({
      'O\'qituvchi': record.studentName,
      'Fan': record.class,
      'Kelgan vaqti': record.timestamp?.toDate ? format(record.timestamp.toDate(), 'dd.MM.yyyy HH:mm:ss') : 'Noma\'lum',
      'Ketgan vaqti': record.exitTimestamp?.toDate ? format(record.exitTimestamp.toDate(), 'dd.MM.yyyy HH:mm:ss') : '--',
      'Holat': record.status === 'arrived' ? 'Keldi' : 
               record.status === 'left' ? 'Ketdi' : 
               record.status === 'early_exit' ? 'Vaqtidan oldin' :
               'Kechikdi'
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Oqituvchilar_Davomati");
    XLSX.writeFile(workbook, `Oqituvchilar_Davomati_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">O'qituvchilar Davomati</h2>
          <p className="text-stone-500">O'qituvchilarning kelish va ketish vaqtlari tarixi</p>
        </div>
        <button 
          onClick={exportTeacherLogs}
          className="flex items-center justify-center gap-2 bg-white border border-stone-200 px-6 py-3 rounded-xl hover:bg-stone-50 transition-all font-medium text-stone-700 shadow-sm"
        >
          <Download className="w-5 h-5" />
          Excelga yuklash
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-stone-50 text-stone-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">O'qituvchi</th>
                <th className="px-6 py-4">Fan</th>
                <th className="px-6 py-4">Kelgan vaqti</th>
                <th className="px-6 py-4">Ketgan vaqti</th>
                <th className="px-6 py-4">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {teacherAttendance.map(record => (
                <tr key={record.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-stone-900">{record.studentName}</td>
                  <td className="px-6 py-4 text-stone-500">{record.class}</td>
                  <td className="px-6 py-4 text-stone-500">
                    {record.timestamp?.toDate ? format(record.timestamp.toDate(), 'dd.MM.yyyy HH:mm:ss') : '--'}
                  </td>
                  <td className="px-6 py-4 text-stone-500">
                    {record.exitTimestamp?.toDate ? format(record.exitTimestamp.toDate(), 'dd.MM.yyyy HH:mm:ss') : '--'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      record.status === 'arrived' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : record.status === 'left'
                        ? 'bg-stone-100 text-stone-700'
                        : record.status === 'early_exit'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {record.status === 'arrived' ? 'Keldi' : 
                       record.status === 'left' ? 'Ketdi' : 
                       record.status === 'early_exit' ? 'Vaqtidan oldin' :
                       'Kechikdi'}
                    </span>
                  </td>
                </tr>
              ))}
              {teacherAttendance.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-stone-400">
                    Hali hech qanday ma'lumot yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UsersView({ 
  users, 
  currentUserRole, 
  currentUserEmail,
  onUpdateRole, 
  onDeleteUser,
  onAddUser,
  onEditUser
}: { 
  users: AppUser[], 
  currentUserRole: string,
  currentUserEmail: string,
  onUpdateRole: (userId: string, newRole: AppUser['role']) => void,
  onDeleteUser: (userId: string) => void,
  onAddUser: () => void,
  onEditUser: (user: AppUser) => void
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Foydalanuvchilar</h2>
          <p className="text-stone-500 mt-1">Tizim adminstratorlari va direktorlarini boshqarish</p>
        </div>
        {(currentUserRole === 'superadmin' || currentUserRole === 'director') && (
          <button 
            onClick={onAddUser}
            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
          >
            <Plus className="w-5 h-5" />
            Foydalanuvchi qo'shish
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-6 py-4 text-sm font-semibold text-stone-600">Foydalanuvchi</th>
                <th className="px-6 py-4 text-sm font-semibold text-stone-600">Email</th>
                <th className="px-6 py-4 text-sm font-semibold text-stone-600">Rol</th>
                <th className="px-6 py-4 text-sm font-semibold text-stone-600 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="font-medium text-stone-900">{u.name}</div>
                      {u.isPreRegistered && (
                        <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Kutilmoqda</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-stone-600">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'director' ? 'bg-blue-100 text-blue-700' :
                      u.role === 'admin' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {u.role === 'superadmin' ? 'Super Admin' : 
                       u.role === 'director' ? 'Direktor' : 
                       u.role === 'admin' ? 'Admin' : 'Xodim'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {(currentUserRole === 'superadmin' || (currentUserRole === 'director' && (u.role === 'admin' || u.role === 'staff'))) && u.email !== currentUserEmail && (
                        <select 
                          value={u.role}
                          onChange={(e) => onUpdateRole(u.id, e.target.value as any)}
                          className="text-sm border border-stone-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                          {currentUserRole === 'superadmin' && <option value="superadmin">Super Admin</option>}
                          {currentUserRole === 'superadmin' && <option value="director">Direktor</option>}
                          <option value="admin">Admin</option>
                          <option value="staff">Xodim</option>
                        </select>
                      )}
                      {(currentUserRole === 'superadmin' || (currentUserRole === 'director' && (u.role === 'admin' || u.role === 'staff'))) && u.email !== currentUserEmail && (
                        <button 
                          onClick={() => onEditUser(u)}
                          className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {(currentUserRole === 'superadmin' || (currentUserRole === 'director' && (u.role === 'admin' || u.role === 'staff'))) && u.email !== currentUserEmail && (
                        <button 
                          onClick={() => onDeleteUser(u.id)}
                          className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ 
  title, 
  message, 
  onConfirm, 
  onCancel 
}: { 
  title: string, 
  message: string, 
  onConfirm: () => void, 
  onCancel: () => void 
}) {
  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-stone-900 mb-2">{title}</h3>
        <p className="text-stone-500 mb-8">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-50 rounded-xl transition-all"
          >
            Bekor qilish
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
          >
            O'chirish
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, currentUserRole }: { user: AppUser, onClose: () => void, currentUserRole: string }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalEmail = email.includes('@') ? email.toLowerCase() : `${email.toLowerCase()}@maktab.uz`;
      await updateDoc(doc(db, 'users', user.id), {
        name,
        email: finalEmail,
        role
      });
      onClose();
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-50 animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 my-auto animate-in zoom-in-95 duration-300">
        <h3 className="text-2xl font-bold text-stone-900 mb-6">Foydalanuvchini tahrirlash</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">F.I.SH</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Login</label>
            <input 
              required
              type="text" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Rol</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            >
              {currentUserRole === 'superadmin' && <option value="superadmin">Super Admin</option>}
              {currentUserRole === 'superadmin' && <option value="director">Direktor</option>}
              <option value="admin">Admin</option>
              <option value="staff">Xodim</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-all"
            >
              Bekor qilish
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddUserModal({ onClose, currentUserRole }: { onClose: () => void, currentUserRole: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'superadmin' | 'director' | 'admin' | 'staff'>('admin');
  const [submitting, setSubmitting] = useState(false);

  // Set initial role based on what's allowed
  useEffect(() => {
    if (currentUserRole === 'director') {
      setRole('admin');
    }
  }, [currentUserRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      alert("Parol kamida 6 ta belgidan iborat bo'lishi kerak");
      return;
    }
    setSubmitting(true);
    try {
      const finalEmail = email.includes('@') ? email.toLowerCase() : `${email.toLowerCase()}@maktab.uz`;
      
      // Create user in Firebase Auth using a secondary app instance
      // This prevents the current superadmin from being logged out
      const appName = `Secondary-${Date.now()}`;
      const secondaryApp = initializeApp(config, appName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, password);
      const newUser = userCredential.user;
      
      // Sign out and delete secondary app
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      
      // Add user profile to Firestore using the new UID
      await setDoc(doc(db, 'users', newUser.uid), {
        id: newUser.uid,
        name,
        email: finalEmail,
        role,
        createdAt: serverTimestamp()
      });
      
      onClose();
    } catch (error: any) {
      console.error("Error adding user:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Ushbu login allaqachon mavjud");
      } else {
        alert("Xatolik yuz berdi: " + (error.message || "Noma'lum xato"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex md:items-center items-start justify-center p-4 z-50 animate-in fade-in duration-300 overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 my-auto animate-in zoom-in-95 duration-300">
        <h3 className="text-2xl font-bold text-stone-900 mb-6">Yangi foydalanuvchi qo'shish</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">F.I.SH</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Masalan: Ali Valiyev"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Login</label>
            <input 
              required
              type="text" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Masalan: admin1"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Parol</label>
            <input 
              required
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              placeholder="Kamida 6 ta belgi"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1">Rol</label>
            <select 
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full border border-stone-200 px-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            >
              {currentUserRole === 'superadmin' && <option value="superadmin">Super Admin</option>}
              {currentUserRole === 'superadmin' && <option value="director">Direktor</option>}
              <option value="admin">Admin</option>
              <option value="staff">Xodim</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-stone-500 font-bold hover:bg-stone-50 rounded-2xl transition-all"
            >
              Bekor qilish
            </button>
            <button 
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda..." : "Qo'shish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
