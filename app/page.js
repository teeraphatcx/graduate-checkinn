'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export default function Home() {
  const [allGraduates, setAllGraduates] = useState([]); // เก็บข้อมูลทุกคน
  
  // คำนวณตัวเลข
  const total = allGraduates.length;
  const presentList = allGraduates
    .filter(g => g.status === 'present')
    .sort((a, b) => new Date(b.check_in_at) - new Date(a.check_in_at)); // เรียงคนล่าสุดขึ้นก่อน
  
  const presentCount = presentList.length;
  const pendingCount = total - presentCount;
  const progress = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  const fetchGraduates = async () => {
    const { data, error } = await supabase
      .from('graduates')
      .select('*');

    if (error) console.error('Error:', error);
    else setAllGraduates(data);
  };

  useEffect(() => {
    fetchGraduates();
    
    // ระบบ Realtime
    const channel = supabase
      .channel('home_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'graduates' },
        () => fetchGraduates()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 md:p-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-yellow-400 flex items-center gap-3">
          🎓 <span className="hidden md:inline">ระบบรายงานตัวบัณฑิต</span>
          <span className="md:hidden">รายงานตัวบัณฑิต</span>
        </h1>
        <a href="/admin" className="text-gray-500 hover:text-white text-sm transition">
          เข้าสู่ระบบ Admin
        </a>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg border-b-4 border-blue-500">
          <p className="text-gray-400 text-xs md:text-sm uppercase font-bold">บัณฑิตทั้งหมด</p>
          <p className="text-3xl md:text-4xl font-bold text-white mt-1">{total}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg border-b-4 border-green-500 relative overflow-hidden">
          <p className="text-gray-400 text-xs md:text-sm uppercase font-bold">รายงานตัวแล้ว</p>
          <p className="text-3xl md:text-4xl font-bold text-green-400 mt-1">{presentCount}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg border-b-4 border-red-500">
          <p className="text-gray-400 text-xs md:text-sm uppercase font-bold">ยังไม่มา</p>
          <p className="text-3xl md:text-4xl font-bold text-red-400 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl shadow-lg border-b-4 border-purple-500 flex flex-col justify-center">
          <p className="text-gray-400 text-xs md:text-sm uppercase font-bold mb-2">ความคืบหน้า</p>
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="text-right text-sm text-purple-300 mt-1 font-bold">{progress}%</p>
        </div>
      </div>

      {/* เส้นคั่น */}
      <div className="h-px bg-gray-800 w-full mb-8"></div>

      {/* รายชื่อคนมาแล้ว */}
      <h2 className="text-xl text-gray-400 mb-4 font-bold flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        ล่าสุดที่เข้าระบบ
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {presentList.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-700">
            <p className="text-gray-500 text-xl">... ยังไม่มีใครรายงานตัว ...</p>
            <p className="text-gray-600 text-sm mt-2">สแกน QR Code เพื่อเริ่มระบบ</p>
          </div>
        ) : (
          presentList.map((grad, index) => (
            <div key={grad.id} className={`bg-gray-800 border-l-4 border-green-500 p-6 rounded-lg shadow-lg transition-all duration-500 ${index === 0 ? 'scale-105 ring-2 ring-green-500/50' : 'opacity-90'}`}>
              <h2 className="text-2xl font-bold truncate">{grad.fullname}</h2>
              <div className="flex justify-between items-end mt-2">
                <div>
                  <p className="text-gray-400 text-sm">รหัส: <span className="font-mono text-white">{grad.student_id}</span></p>
                  <p className="text-sm text-green-400 mt-1">{grad.faculty}</p>
                </div>
                <p className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">
                  {new Date(grad.check_in_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}