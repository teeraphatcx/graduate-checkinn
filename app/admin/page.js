'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import * as XLSX from 'xlsx';
import { supabase } from '../../utils/supabase';

export default function AdminPage() {
  // --- State สำหรับ Authentication ---
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // --- State สำหรับข้อมูลบัณฑิต ---
  const [graduates, setGraduates] = useState([]);
  const [loading, setLoading] = useState(false);

  // --- ฟังก์ชันจัดการข้อมูล ---
  const fetchGraduates = async () => {
    const { data } = await supabase.from('graduates').select('*').order('student_id');
    if (data) setGraduates(data);
  };

  // 1. เช็คว่าล็อกอินอยู่หรือเปล่าตอนเปิดเว็บ
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchGraduates();
      }
      setAuthLoading(false);
    };
    checkSession();
  }, []);

  // ⚡️ ระบบ Realtime
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('admin_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'graduates' },
        (payload) => {
          console.log('มีการเปลี่ยนแปลงข้อมูล:', payload);
          fetchGraduates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 2. ฟังก์ชันล็อกอิน
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      alert('❌ ล็อกอินไม่สำเร็จ: ' + error.message);
    } else {
      setUser(data.user);
      fetchGraduates();
    }
    setAuthLoading(false);
  };

  // 3. ฟังก์ชันออกจากระบบ
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setGraduates([]);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      const { error } = await supabase.from('graduates').insert(data);
      if (error) alert('❌ Error: ' + error.message);
      else { alert(`✅ นำเข้าข้อมูลสำเร็จ ${data.length} คน!`); fetchGraduates(); }
      setLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  // 🔥🔥🔥 แก้ไขฟังก์ชันลบข้อมูลตรงนี้ 🔥🔥🔥
  const clearAllData = async () => {
    // 1. ถามยืนยัน
    if(!confirm('⚠️ เตือนครั้งสุดท้าย! ข้อมูลจะหายหมด ยืนยันไหม?')) return;
    
    // 2. สั่งลบด้วยเงื่อนไขที่ใช้ได้กับ ID ทุกประเภท (ทั้งตัวเลขและ UUID)
    const { error } = await supabase
      .from('graduates')
      .delete()
      .not('id', 'is', null); // ลบทุกแถวที่มี ID

    // 3. เช็คผลลัพธ์
    if (error) {
      alert('❌ ลบข้อมูลไม่สำเร็จ: ' + error.message);
      console.error('Delete Error:', error);
    } else {
      alert('✅ ล้างข้อมูลเรียบร้อยแล้ว');
      setGraduates([]); // สั่งเคลียร์หน้าจอทันที
    }
  };

  // --- UI ---
  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-white bg-gray-900">กำลังตรวจสอบสิทธิ์...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md text-center">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">🔐 Admin Portal</h1>
            <p className="text-gray-500 text-sm mt-1">ระบบจัดการรายชื่อบัณฑิต</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-gray-600 ml-1">Email</label>
              <input 
                type="email" 
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black mt-1"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 ml-1">Password</label>
              <input 
                type="password" 
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black mt-1"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-lg mt-4"
            >
              เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 print:p-0 print:bg-white">
      <div className="mb-8 p-6 bg-white rounded-xl shadow-sm border border-gray-200 print:hidden space-y-4">
        <div className="flex justify-between items-center border-b pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 text-green-700 p-2 rounded-full px-4 text-sm font-bold">
                Admin: {user.email}
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-100 text-sm font-bold transition"
            >
              ออกจากระบบ
            </button>
        </div>
        
        <div className="flex flex-wrap gap-4 items-center">
          <a href="/scan" target="_blank" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm">
            📸 สแกน QR
          </a>
          <button onClick={() => window.print()} className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-bold shadow-sm">
            🖨️ พิมพ์ QR
          </button>
          <button onClick={clearAllData} className="text-gray-400 hover:text-red-500 text-sm underline ml-auto">
            ล้างข้อมูลทั้งหมด
          </button>
        </div>

        <div className="mt-4 p-4 border-2 border-dashed border-blue-200 rounded-lg bg-blue-50 flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-full text-blue-600">📥</div>
          <div className="flex-1">
            <label className="block text-sm font-bold text-blue-800 mb-1">นำเข้าไฟล์ Excel</label>
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={loading} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"/>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
        {graduates.map((grad) => (
          <div key={grad.id} className="bg-white p-6 rounded-xl shadow-md flex flex-col items-center text-center border border-gray-200 print:shadow-none print:border-black break-inside-avoid">
            <h2 className="text-lg font-bold text-gray-800">{grad.fullname}</h2>
            <p className="text-sm text-gray-500 mb-4">{grad.faculty}</p>
            <div className="p-2 border rounded-lg bg-white">
              <QRCode value={grad.student_id} size={120} />
            </div>
            <p className="mt-3 font-mono font-bold text-lg text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{grad.student_id}</p>
            
            <div className={`mt-2 text-xs font-bold px-2 py-1 rounded ${grad.status === 'present' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'} transition-all duration-300`}>
              {grad.status === 'present' ? '✅ มาแล้ว' : 'รอเช็คอิน'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
