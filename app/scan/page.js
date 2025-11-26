'use client';

import { useState, useEffect, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { supabase } from '../../utils/supabase';

export default function ScanPage() {
  // --- ระบบล็อกหน้าจอ (Passcode) ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passcode, setPasscode] = useState('');
  const SCAN_PASSWORD = '9999';

  const handlePasscodeChange = (e) => {
    const input = e.target.value;
    setPasscode(input);
    if (input === SCAN_PASSWORD) {
      setIsUnlocked(true);
      setPasscode('');
    }
  };

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passcode === SCAN_PASSWORD) {
      setIsUnlocked(true);
      setPasscode('');
    } else {
      alert('❌ รหัสผิดครับ!');
      setPasscode('');
    }
  };

  // --- ระบบสแกน & ค้นหา ---
  const [lastScanned, setLastScanned] = useState('');
  const [status, setStatus] = useState('ready'); // ready, processing, success, error
  const [manualSearch, setManualSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const isProcessingRef = useRef(false);

  // 🔊 ระบบเสียง
  const speak = (text) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 0.85; // ปรับให้ช้าลงอีกนิด ให้ดูสง่างาม
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      let thaiVoice = voices.find(v => v.lang === 'th-TH' && (v.name.includes('Male') || v.name.includes('Man')));
      if (!thaiVoice) thaiVoice = voices.find(v => v.lang === 'th-TH');
      if (thaiVoice) utterance.voice = thaiVoice;

      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  // 🔎 ระบบค้นหาเรียลไทม์
  useEffect(() => {
    if (!manualSearch.trim() || manualSearch.length < 2) {
      setSearchResult(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('graduates')
          .select('*')
          .or(`student_id.eq.${manualSearch},fullname.ilike.%${manualSearch}%`)
          .limit(1)
          .maybeSingle();
        setSearchResult(data || null);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [manualSearch]);

  // ⚙️ ฟังก์ชันหลัก: ประมวลผลการเช็คอิน
  const processCheckIn = async (studentId) => {
    if (isProcessingRef.current) return;
    if (studentId === lastScanned && status === 'success') return;

    isProcessingRef.current = true;
    setStatus('processing');
    setLastScanned(studentId);
    setSearchResult(null);
    setManualSearch('');

    try {
      const { data: student, error: searchError } = await supabase
        .from('graduates')
        .select('*')
        .eq('student_id', studentId)
        .single();

      if (searchError || !student) {
        speak('ไม่พบรายชื่อในระบบครับ');
        setStatus('error');
        throw new Error('ไม่พบข้อมูล');
      }

      // 1. กรณีเช็คอินไปแล้ว
      if (student.status === 'present') {
        speak(`บัณฑิต ${student.fullname} รายงานตัวแล้วครับ`);
        setStatus('error'); 
        setTimeout(() => {
            setStatus('ready');
            isProcessingRef.current = false;
        }, 2000);
        return;
      }

      // อัปเดตสถานะ
      const { error: updateError } = await supabase
        .from('graduates')
        .update({ status: 'present', check_in_at: new Date().toISOString() })
        .eq('id', student.id);

      if (updateError) throw updateError;

      setStatus('success');

      // 🔥 แก้ไขคำขานชื่อตรงนี้ 🔥
      // 1. จัดการชื่อปริญญา (เติมคำว่า "ปริญญา" ถ้ายังไม่มี)
      let degreeText = 'บัณฑิต'; 
      if (student.degree) {
        if (student.degree.trim().startsWith('ปริญญา')) {
           degreeText = student.degree;
        } else {
           degreeText = `ปริญญา${student.degree}`;
        }
      }

      // 2. จัดการชื่อคณะ (เติมคำว่า "คณะ" ถ้ายังไม่มี)
      const facultyText = student.faculty ? `คณะ${student.faculty}` : ''; 
      
      // 3. รวมประโยค: ปริญญา... คณะ... ชื่อ...
      const speechText = `${degreeText} ${facultyText} ${student.fullname}`;
      
      speak(speechText);

      setTimeout(() => {
          setStatus('ready');
          isProcessingRef.current = false;
      }, 5000); // เพิ่มเวลาเป็น 5 วินาที เผื่อชื่อยาว

    } catch (err) {
      console.error(err);
      if (status !== 'error') {
         setStatus('error');
         speak('เกิดข้อผิดพลาดในการบันทึกครับ');
      }
      setTimeout(() => {
          setStatus('ready');
          isProcessingRef.current = false;
      }, 2000);
    }
  };

  const handleScan = (result) => {
    if (result && result.length > 0) {
        processCheckIn(result[0].rawValue);
    }
  };

  const handleError = (error) => {
    console.warn("Scanner Error:", error);
  };

  // --- UI Section ---
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
          <div className="text-4xl mb-4">👮‍♂️</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">จุดสแกนบัณฑิต</h1>
          <form onSubmit={handleUnlock} className="space-y-4">
            <input 
              type="password" inputMode="numeric" pattern="[0-9]*" maxLength="4" 
              className="w-full text-center text-3xl tracking-widest p-3 border-2 border-gray-300 rounded-lg text-black font-bold focus:ring-4 focus:ring-blue-200 focus:border-blue-500 outline-none transition" 
              placeholder="••••" value={passcode} onChange={handlePasscodeChange} autoFocus 
            />
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center p-4 pt-10 pb-20">
      <button onClick={() => setIsUnlocked(false)} className="absolute top-4 right-4 text-xs text-gray-500 border border-gray-800 px-3 py-1 rounded hover:bg-gray-800 z-10 transition">
        🔒 ล็อก
      </button>

      <h1 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
        📸 สแกน QR Code
      </h1>
      
      <div className={`w-full max-w-xs border-4 rounded-2xl overflow-hidden relative shadow-2xl transition-colors duration-300 ${status === 'success' ? 'border-green-500 shadow-green-500/50' : status === 'error' ? 'border-red-500 shadow-red-500/50' : 'border-blue-500 shadow-blue-500/30'}`}>
        
        {/* Scanner Component */}
        <Scanner 
            onScan={handleScan} 
            onError={handleError} 
            formats={['qr_code']} 
            components={{
                audio: false, 
                onOff: true,  
                tracker: true 
            }}
            constraints={{
                facingMode: 'environment', 
                aspectRatio: { ideal: 1 }  
            }}
            scanDelay={500} 
            allowMultiple={true}
        />
        
        {status === 'processing' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 backdrop-blur-sm">
                <div className="animate-spin text-4xl">⏳</div>
            </div>
        )}
        {status === 'success' && (
            <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center z-20">
                <div className="text-4xl animate-bounce">✅</div>
            </div>
        )}
      </div>

      <div className="mt-6 text-center h-8">
        {status === 'ready' && <span className="text-green-400 font-bold animate-pulse text-lg">🟢 พร้อมสแกนครับ</span>}
        {status === 'processing' && <span className="text-yellow-400 font-bold text-lg">⏳ กำลังประมวลผล...</span>}
        {status === 'success' && <span className="text-blue-400 font-bold text-lg">🎉 เรียบร้อย!</span>}
        {status === 'error' && <span className="text-red-500 font-bold text-lg">❌ ตรวจสอบข้อมูล</span>}
      </div>

      <div className="w-full max-w-xs my-8 border-t border-gray-800"></div>

      {/* 🔎 ค้นหาด้วยมือ */}
      <div className="w-full max-w-xs bg-gray-900 p-5 rounded-2xl border border-gray-800 shadow-xl">
        <h2 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2"><span>⌨️</span> ค้นหาด่วน</h2>
        <form onSubmit={(e) => { e.preventDefault(); if(manualSearch.trim()) setManualSearch(manualSearch); }} className="flex gap-2">
          <input 
            type="text" placeholder="รหัส นศ. หรือ ชื่อ..." 
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition shadow-inner"
            value={manualSearch} onChange={(e) => setManualSearch(e.target.value)}
          />
          <button type="submit" disabled={isSearching} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center min-w-[70px]">
            {isSearching ? '⏳' : 'ค้นหา'}
          </button>
        </form>

        {searchResult && (
          <div className="mt-4 bg-gray-800 border border-blue-500/50 p-4 rounded-xl animate-fade-in-up shadow-lg">
            <p className="text-lg font-bold text-white">{searchResult.fullname}</p>
            <p className="text-sm text-gray-400 mb-3">{searchResult.student_id} | {searchResult.faculty}</p>
            <div className="flex items-center justify-between mb-3 text-xs bg-gray-900 p-2 rounded">
               <span>สถานะ:</span>
               {searchResult.status === 'present' ? <span className="text-green-400 font-bold">✅ มาแล้ว</span> : <span className="text-yellow-400 font-bold">รอเช็คอิน</span>}
            </div>
            <button 
              onClick={() => processCheckIn(searchResult.student_id)}
              disabled={searchResult.status === 'present'}
              className={`w-full py-3 rounded-lg font-bold text-sm transition ${searchResult.status === 'present' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-lg active:scale-95'}`}
            >
              {searchResult.status === 'present' ? 'เช็คอินไปแล้ว' : 'ยืนยันเช็คอิน ✅'}
            </button>
          </div>
        )}
      </div>

      <button onClick={() => speak('พร้อมใช้งานครับ')} className="mt-10 text-xs text-gray-600 hover:text-gray-400 underline transition">ทดสอบเสียง</button>
    </div>
  );
}
